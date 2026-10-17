import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BoardError,
  createBoardClient,
  customDraft,
  filterBoardChallenges,
  toBoardChallenge,
} from "../app/lib/board.ts";

const token = "a".repeat(64);
const live = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Wake up",
  template: "wake_up",
  proofMethod: "timed_math",
  creatorId: "creator",
  creatorDisplayName: "Mert",
  status: "open",
  proofSource: "Server answer and time",
  proofDeadline: "2026-10-18T07:05:00.000Z",
  startsAt: "2026-10-18T07:00:00.000Z",
  bettingCutoff: "2026-10-18T06:59:00.000Z",
  successRule: "Solve the fresh math problem",
  creatorStakeAtomic: "1000000",
  confirmedPoolAtomic: "3000000",
  eligiblePoolAtomic: "3000000",
};

test("maps a live challenge to stake and eligible pool amounts", () => {
  const card = toBoardChallenge(live);
  assert.equal(card.creator, "Mert");
  assert.equal(card.stakeUsdt, "1");
  assert.equal(card.poolUsdt, "3");
  assert.equal(card.statusLabel, "Open");
  assert.equal(card.templateEmoji, "⏰");
  assert.equal(toBoardChallenge({ ...live, eligiblePoolAtomic: "0" }).poolUsdt, null);
});

test("board filters use live status and creator fields", () => {
  const open = toBoardChallenge(live);
  const succeeded = toBoardChallenge({
    ...live,
    id: "settled",
    status: "succeeded",
  });
  const mine = toBoardChallenge({
    ...live,
    id: "mine",
    creatorId: "viewer",
  });
  const draft = toBoardChallenge({ ...live, id: "draft", status: "draft" });
  const all = [open, succeeded, mine, draft];

  assert.deepEqual(filterBoardChallenges(all, "all"), all);
  assert.deepEqual(filterBoardChallenges(all, "active"), [open, mine]);
  assert.deepEqual(filterBoardChallenges(all, "settled"), [succeeded]);
  assert.deepEqual(filterBoardChallenges(all, "created", "viewer"), [mine]);
  assert.deepEqual(filterBoardChallenges(all, "created"), []);
});

test("submits custom proof and returns Goaly's structured review", async () => {
  const client = createBoardClient({
    fetchService: async () => Response.json({
      saved: true,
      review: {
        verdict: "accepted",
        reason: "The evidence supports the stated goal.",
        reviewer: "local-qvac",
      },
    }),
  });
  const result = await client.saveProof(token, live.id, "I completed the stated goal.");
  assert.deepEqual(result, {
    saved: true,
    review: {
      verdict: "accepted",
      reason: "The evidence supports the stated goal.",
      reviewer: "local-qvac",
    },
  });
});

test("lists challenges with the participant token and never sends a body", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createBoardClient({
    fetchService: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ challenges: [live] });
    },
  });
  const cards = await client.list(token);
  assert.equal(cards[0].title, "Wake up");
  assert.equal(calls[0].url, "/api/challenges?limit=100&offset=0");
  assert.equal(calls[0].init?.method, "GET");
  assert.equal(calls[0].init?.body, undefined);
  assert.equal(
    new Headers(calls[0].init?.headers).get("Authorization"),
    `Bearer ${token}`,
  );
});

test("publishes with an empty JSON body and the participant token", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createBoardClient({
    fetchService: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ challenge: live });
    },
  });
  const card = await client.publish(token, live.id);
  assert.equal(card.title, "Wake up");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.body, "{}");
  assert.equal(
    new Headers(calls[0].init?.headers).get("Authorization"),
    `Bearer ${token}`,
  );
});

test("timed-math proof requests use the participant token and exact API payloads", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createBoardClient({
    fetchService: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/proofs"))
        return Response.json({ proofs: [], accepted: false });
      if (String(url).endsWith("/math/problem"))
        return Response.json({
          problem: {
            id: "problem-1",
            left: 12,
            right: 34,
            operator: "+",
            createdAt: "2026-10-17T12:00:00.000Z",
            expiresAt: "2026-10-18T12:00:00.000Z",
          },
        });
      return Response.json({
        proof: {
          problemId: "problem-1",
          answer: "46",
          status: "accepted",
          submittedAt: "2026-10-17T12:01:00.000Z",
          reason: "Correct answer received during the proof window.",
        },
      });
    },
  });
  const id = "challenge-1";
  assert.deepEqual(await client.mathProofs(token, id), { proofs: [], accepted: false });
  const problem = await client.createMathProblem(token, id);
  assert.equal(problem.problem.left + problem.problem.right, 46);
  const proof = await client.submitMathAnswer(token, id, {
    problemId: problem.problem.id,
    answer: "46",
  });
  assert.equal(proof.proof.status, "accepted");
  assert.equal(calls[0].url, `/api/challenges/${id}/proofs`);
  assert.equal(calls[1].url, `/api/challenges/${id}/math/problem`);
  assert.equal(calls[1].init?.body, "{}");
  assert.equal(calls[2].init?.body, JSON.stringify({ problemId: "problem-1", answer: "46" }));
  for (const call of calls)
    assert.equal(new Headers(call.init?.headers).get("Authorization"), `Bearer ${token}`);
});

test("rejects an invalid challenge record instead of showing a partial card", async () => {
  const client = createBoardClient({
    fetchService: async () =>
      Response.json({ challenges: [{ ...live, creatorStakeAtomic: "1.5" }] }),
  });
  await assert.rejects(
    client.list(token),
    (error) => error instanceof BoardError && error.code === "INVALID_RESPONSE",
  );
});

test("builds a custom draft with ordered future deadlines and an atomic stake", () => {
  const now = Date.parse("2026-10-17T12:00:00.000Z");
  const draft = customDraft({
    title: "Read daily",
    successRule: "Read 30 minutes",
    stake: "5.5",
    proofDeadline: "2026-10-20T12:00:00.000Z",
    proofSource: "A dated photo",
    visibility: "solo",
    now,
    timeZone: "Europe/Rome",
  });
  assert.equal(draft.template, "custom");
  assert.equal(draft.visibility, "solo");
  assert.equal("forfeit" in draft, false);
  assert.equal("charity" in draft, false);
  assert.equal(draft.proofMethod, "custom");
  assert.equal(draft.creatorStakeAtomic, "5500000");
  assert.equal(draft.proofDeadline, "2026-10-20T12:00:00.000Z");
  assert.equal(draft.timezone, "Europe/Rome");
  assert.ok(Date.parse(draft.bettingCutoff) < Date.parse(draft.startsAt));
  assert.ok(Date.parse(draft.startsAt) < Date.parse(draft.proofDeadline));
  assert.ok(Date.parse(draft.bettingCutoff) > now);
  assert.throws(
    () =>
      customDraft({
        ...{
          title: "Read daily",
          successRule: "Read",
          stake: "101",
          proofDeadline: "2026-10-20T12:00:00.000Z",
          proofSource: "A dated photo",
          visibility: "public",
          now,
        },
      }),
    BoardError,
  );
});

test("creates a custom challenge without charity or forfeiture fields", async () => {
  const sent: Record<string, unknown>[] = [];
  const client = createBoardClient({
    fetchService: async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ challenge: live });
    },
  });
  await client.createCustom(token, {
    title: "Read daily",
    successRule: "Read 30 minutes",
    stake: "5",
    proofDeadline: "2026-10-20T12:00:00.000Z",
    proofSource: "A dated photo",
    visibility: "public",
    now: Date.parse("2026-10-17T12:00:00.000Z"),
  });
  assert.equal(sent[0].visibility, "public");
  assert.equal("forfeit" in sent[0], false);
  assert.equal("charity" in sent[0], false);
});
