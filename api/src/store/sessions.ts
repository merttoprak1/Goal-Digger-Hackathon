import { mathProofs } from "./math-proofs.js";
import { outcomes } from "./outcomes.js";
import type { ChallengeDraftInput } from "../contracts/challenge.js";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
export interface Participant {
  id: string;
  displayName: string;
  createdAt: string;
}
export function openSessions(databasePath: string, now: () => number = () => Date.now()) {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  chmodSync(databasePath, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS participants(id TEXT PRIMARY KEY,display_name TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,participant_id TEXT NOT NULL REFERENCES participants(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,creator_id TEXT NOT NULL REFERENCES participants(id),created_at TEXT NOT NULL,result TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS publications(challenge_id TEXT PRIMARY KEY REFERENCES challenges(id),published_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS opponent_stakes(challenge_id TEXT NOT NULL REFERENCES challenges(id),participant_id TEXT NOT NULL REFERENCES participants(id),payment_id TEXT NOT NULL UNIQUE,amount TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(challenge_id,participant_id));
 CREATE INDEX IF NOT EXISTS challenges_owner ON challenges(creator_id,created_at,id);`);
  const hash = (token: string) => createHash("sha256").update(token).digest("hex");
  return {
    ...mathProofs(db, now),
    ...outcomes(db, now),
    checkReady() {
      db.prepare("SELECT 1").get();
      return true;
    },
    create(displayName: string) {
      const participant: Participant = {
        id: randomUUID(),
        displayName,
        createdAt: new Date(now()).toISOString(),
      };
      const token = randomBytes(32).toString("hex");
      const expiresAt = now() + 7 * 24 * 60 * 60 * 1000;
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("INSERT INTO participants VALUES(?,?,?)").run(
          participant.id,
          displayName,
          participant.createdAt,
        );
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
          hash(token),
          participant.id,
          expiresAt,
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return { participant, token, expiresAt: new Date(expiresAt).toISOString() };
    },
    find(token: string): Participant | null {
      if (!/^[a-f0-9]{64}$/.test(token)) return null;
      const row = db
        .prepare(
          "SELECT p.* FROM sessions s JOIN participants p ON p.id=s.participant_id WHERE s.token_hash=? AND s.expires_at>?",
        )
        .get(hash(token), now());
      return row
        ? {
            id: String(row.id),
            displayName: String(row.display_name),
            createdAt: String(row.created_at),
          }
        : null;
    },
    nameOf(id: string) {
      const row = db.prepare("SELECT display_name FROM participants WHERE id=?").get(id);
      return row ? String(row.display_name) : "Unknown participant";
    },
    publication(id: string) {
      const row = db
        .prepare("SELECT published_at FROM publications WHERE challenge_id=?")
        .get(id);
      return row ? String(row.published_at) : null;
    },
    publish(id: string) {
      db.prepare("INSERT OR IGNORE INTO publications VALUES(?,?)").run(
        id,
        new Date(now()).toISOString(),
      );
    },
    getPublished(id: string) {
      const row = db
        .prepare(
          "SELECT c.result FROM challenges c JOIN publications p ON p.challenge_id=c.id WHERE c.id=?",
        )
        .get(id);
      return row ? JSON.parse(String(row.result)) : null;
    },
    getOpponentStake(challengeId: string, participantId: string) {
      const row = db
        .prepare(
          "SELECT * FROM opponent_stakes WHERE challenge_id=? AND participant_id=?",
        )
        .get(challengeId, participantId);
      return row
        ? {
            paymentId: String(row.payment_id),
            amountAtomic: String(row.amount),
            createdAt: String(row.created_at),
          }
        : null;
    },
    bindOpponentStake(challengeId: string, participantId: string, amount: string) {
      const paymentId =
        "opponent-" +
        createHash("sha256")
          .update(challengeId + ":" + participantId)
          .digest("hex");
      db.prepare("INSERT OR IGNORE INTO opponent_stakes VALUES(?,?,?,?,?)").run(
        challengeId,
        participantId,
        paymentId,
        amount,
        new Date(now()).toISOString(),
      );
      const row = db
        .prepare(
          "SELECT payment_id,amount FROM opponent_stakes WHERE challenge_id=? AND participant_id=?",
        )
        .get(challengeId, participantId)!;
      return { paymentId: String(row.payment_id), amountAtomic: String(row.amount) };
    },
    listStakeCredits(challengeId: string) {
      if (
        !db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='stake_credits'",
          )
          .get()
      )
        return [];
      return db
        .prepare(
          "SELECT d.payment_id,d.participant_id,d.amount,c.credited_at FROM stake_deposits d JOIN stake_credits c ON c.payment_id=d.payment_id WHERE d.challenge_id=?",
        )
        .all(challengeId)
        .map((row) => ({
          paymentId: String(row.payment_id),
          participantId: String(row.participant_id),
          amountAtomic: String(row.amount),
          creditedAt: String(row.credited_at),
        }));
    },
    createChallenge(creatorId: string, input: ChallengeDraftInput) {
      const challenge = {
        ...input,
        id: randomUUID(),
        creatorId,
        status: "draft" as const,
        confirmedPoolAtomic: "0",
        createdAt: new Date(now()).toISOString(),
      };
      db.prepare("INSERT INTO challenges VALUES(?,?,?,?)").run(
        challenge.id,
        creatorId,
        challenge.createdAt,
        JSON.stringify(challenge),
      );
      return challenge;
    },
    getChallenge(creatorId: string, id: string) {
      const row = db
        .prepare("SELECT result FROM challenges WHERE id=? AND creator_id=?")
        .get(id, creatorId);
      return row ? JSON.parse(String(row.result)) : null;
    },
    listChallenges(creatorId: string, limit: number, offset: number) {
      return db
        .prepare(
          "SELECT c.result FROM challenges c WHERE c.creator_id=? OR EXISTS(SELECT 1 FROM publications p WHERE p.challenge_id=c.id) ORDER BY c.created_at DESC,c.id DESC LIMIT ? OFFSET ?",
        )
        .all(creatorId, limit, offset)
        .map((row) => JSON.parse(String(row.result)));
    },
    listPublished(limit: number, offset: number) {
      return db
        .prepare(
          "SELECT c.result FROM challenges c JOIN publications p ON p.challenge_id=c.id ORDER BY p.published_at DESC,c.id DESC LIMIT ? OFFSET ?",
        )
        .all(limit, offset)
        .map((row) => JSON.parse(String(row.result)));
    },
    revoke(token: string) {
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(token));
    },
    close() {
      db.close();
    },
  };
}
