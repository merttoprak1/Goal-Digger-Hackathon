import { test } from "node:test";
import assert from "node:assert/strict";
import { BoardError, createBoardClient, customDraft, toBoardChallenge } from "../app/lib/board.ts";

const token = "a".repeat(64);
const live = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Wake up",
  template: "wake_up",
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
    forfeit: "donate",
    charity: "Water.org",
    now,
    timeZone: "Europe/Rome",
  });
  assert.equal(draft.template, "custom");
  assert.equal(draft.visibility, "solo");
  assert.equal(draft.charity, "Water.org");
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
          forfeit: "burn",
          now,
        },
      }),
    BoardError,
  );
});
