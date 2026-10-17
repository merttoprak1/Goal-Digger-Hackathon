import type { DatabaseSync } from "node:sqlite";

function provedMath(db: DatabaseSync, id: string, startsAt: string, proofDeadline: string) {
  const proof = db
    .prepare(
      "SELECT id,result FROM math_problems WHERE challenge_id=? AND json_extract(result,'$.status')='accepted'",
    )
    .all(id)
    .find((row) => {
      const receipt = JSON.parse(String(row.result));
      const submittedAt = Date.parse(receipt.submittedAt);
      return submittedAt >= Date.parse(startsAt) && submittedAt < Date.parse(proofDeadline);
    });
  return proof ? String(proof.id) : null;
}

function provedCustom(db: DatabaseSync, id: string, proofDeadline: string) {
  const row = db
    .prepare(
      "SELECT submitted_at FROM custom_proofs WHERE challenge_id=? AND review_verdict='accepted'",
    )
    .get(id);
  if (!row) return null;
  return Date.parse(String(row.submitted_at)) < Date.parse(proofDeadline) ? id : null;
}
import { ApiError } from "../middlewares/error-handler.js";
import { bettingBook } from "./betting.js";
import { payoutPlans } from "./payout-plans.js";

export function outcomes(db: DatabaseSync, now: () => number) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS challenge_outcomes(challenge_id TEXT PRIMARY KEY REFERENCES challenges(id),result TEXT NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS custom_proofs(challenge_id TEXT PRIMARY KEY REFERENCES challenges(id),statement TEXT NOT NULL,submitted_at TEXT NOT NULL,review_verdict TEXT NOT NULL DEFAULT 'unclear',review_reason TEXT NOT NULL DEFAULT '',reviewer TEXT NOT NULL DEFAULT '')",
  );
  const proofColumns = new Set(
    db.prepare("PRAGMA table_info(custom_proofs)").all().map((row) => String(row.name)),
  );
  if (!proofColumns.has("review_verdict"))
    db.exec("ALTER TABLE custom_proofs ADD COLUMN review_verdict TEXT NOT NULL DEFAULT 'unclear'");
  if (!proofColumns.has("review_reason"))
    db.exec("ALTER TABLE custom_proofs ADD COLUMN review_reason TEXT NOT NULL DEFAULT ''");
  if (!proofColumns.has("reviewer"))
    db.exec("ALTER TABLE custom_proofs ADD COLUMN reviewer TEXT NOT NULL DEFAULT ''");
  const book = bettingBook(db, now);
  const getOutcome = (id: string) => {
    const row = db
      .prepare("SELECT result FROM challenge_outcomes WHERE challenge_id=?")
      .get(id);
    return row ? JSON.parse(String(row.result)) : null;
  };
  const getProofReview = (id: string) => {
    const row = db
      .prepare(
        "SELECT statement,submitted_at,review_verdict,review_reason,reviewer FROM custom_proofs WHERE challenge_id=?",
      )
      .get(id);
    return row
      ? {
          statement: String(row.statement),
          submittedAt: String(row.submitted_at),
          reviewVerdict: String(row.review_verdict),
          reason: String(row.review_reason),
          reviewer: String(row.reviewer),
        }
      : null;
  };
  return {
    getOutcome,
    getProofReview,
    beginProofReview(id: string, statement: string) {
      const previous = getProofReview(id);
      if (previous?.reviewVerdict === "accepted") {
        if (previous.statement !== statement) {
          throw new ApiError(
            409,
            "An accepted proof is already saved for this challenge.",
            "PROOF_ACCEPTED",
          );
        }
        return {
          status: "accepted" as const,
          submittedAt: previous.submittedAt,
          review: {
            verdict: "accepted" as const,
            reason: previous.reason,
            reviewer: "local-qvac" as const,
          },
        };
      }
      if (previous?.reviewVerdict === "pending") {
        if (previous.statement !== statement) {
          throw new ApiError(
            409,
            "The previous proof is still awaiting Goaly review. Retry the same evidence first.",
            "PROOF_REVIEW_PENDING",
          );
        }
        return { status: "pending" as const, submittedAt: previous.submittedAt };
      }

      const submittedAt = new Date(now()).toISOString();
      db.prepare(
        "INSERT INTO custom_proofs(challenge_id,statement,submitted_at,review_verdict,review_reason,reviewer) VALUES(?,?,?,'pending','','') ON CONFLICT(challenge_id) DO UPDATE SET statement=excluded.statement,submitted_at=excluded.submitted_at,review_verdict='pending',review_reason='',reviewer=''",
      ).run(id, statement, submittedAt);
      return { status: "pending" as const, submittedAt };
    },
    saveProofNote(
      id: string,
      statement: string,
      submittedAt: string,
      review: { verdict: "accepted" | "rejected"; reason: string; reviewer: "local-qvac" },
    ) {
      const result = db
        .prepare(
          "UPDATE custom_proofs SET review_verdict=?,review_reason=?,reviewer=? WHERE challenge_id=? AND statement=? AND submitted_at=? AND review_verdict='pending'",
        )
        .run(review.verdict, review.reason, review.reviewer, id, statement, submittedAt);
      const current = getProofReview(id);
      if (result.changes === 0) {
        if (current?.reviewVerdict === "accepted" && current.statement === statement) {
          return {
            review: {
              verdict: "accepted" as const,
              reason: current.reason,
              reviewer: "local-qvac" as const,
            },
            submittedAt: current.submittedAt,
          };
        }
        throw new ApiError(
          409,
          "This proof review changed while Goaly was responding. Retry its saved evidence.",
          "PROOF_REVIEW_PENDING",
        );
      }
      return { review, submittedAt };
    },
    clearPendingProofReview(id: string, statement: string, submittedAt: string) {
      db.prepare(
        "DELETE FROM custom_proofs WHERE challenge_id=? AND statement=? AND submitted_at=? AND review_verdict='pending'",
      ).run(id, statement, submittedAt);
    },
    getBettingSnapshot: book.getBettingSnapshot,
    closeBetting: book.closeBetting,
    ...payoutPlans(db, now, book, getOutcome),
    finalizeOutcome(id: string) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const previous = getOutcome(id);
        if (previous) {
          db.exec("COMMIT");
          return previous;
        }
        const row = db
          .prepare(
            "SELECT c.result FROM challenges c JOIN publications p ON p.challenge_id=c.id WHERE c.id=?",
          )
          .get(id);
        if (!row) throw new ApiError(404, "Published challenge not found.", "NOT_FOUND");
        const challenge = JSON.parse(String(row.result));
        const custom =
          challenge.template === "custom" && challenge.proofMethod === "custom";
        if (!custom && (challenge.template !== "wake_up" || challenge.proofMethod !== "timed_math"))
          throw new ApiError(
            409,
            "This challenge does not use timed math proof.",
            "WRONG_PROOF_METHOD",
          );
        const finalizedAt = now();
        if (finalizedAt < Date.parse(challenge.proofDeadline))
          throw new ApiError(
            409,
            "The proof deadline has not passed.",
            "PROOF_WINDOW_OPEN",
          );
        if (
          custom &&
          db
            .prepare(
              "SELECT 1 FROM custom_proofs WHERE challenge_id=? AND review_verdict='pending'",
            )
            .get(id)
        ) {
          throw new ApiError(
            409,
            "A timely proof is waiting for Goaly review. Restore Goaly and retry the same evidence before finalizing.",
            "PROOF_REVIEW_PENDING",
          );
        }
        const snapshot = book.sealInsideTransaction(id);
        const stakes = snapshot.stakes;
        const proved = custom
          ? provedCustom(db, id, challenge.proofDeadline)
          : provedMath(db, id, challenge.startsAt, challenge.proofDeadline);
        const outcome = {
          challengeId: id,
          status: proved ? "success" : "failure",
          proofId: proved,
          poolAtomic: stakes
            .reduce((total, s) => total + BigInt(s.amountAtomic), 0n)
            .toString(),
          stakes,
          finalizedAt: new Date(finalizedAt).toISOString(),
        };
        db.prepare("INSERT INTO challenge_outcomes VALUES(?,?)").run(
          id,
          JSON.stringify(outcome),
        );
        db.exec("COMMIT");
        return outcome;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
