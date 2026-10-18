import { test } from "node:test";
import assert from "node:assert/strict";
import * as confirmation from "../app/lib/payment-confirmation.ts";

test("waits for credited funds before publishing or joining", async () => {
  for (const action of ["publish", "join"]) {
    const events: string[] = [];
    const statuses = ["awaiting_payment", "pending", "credited"];
    await confirmation.waitForStake({
      check: async () => ({ status: statuses.shift()! }),
      onStatus: (status: string) => { events.push(status); },
      complete: async () => { events.push(action); },
      signal: new AbortController().signal,
      pause: async () => {},
    });
    assert.deepEqual(events, ["awaiting_payment", "pending", "credited", action]);
  }
});

test("review, failure, and unknown status never publish", async () => {
  for (const status of ["review_required", "failed", "unknown"]) {
    let completed = false;
    await assert.rejects(confirmation.waitForStake({
      check: async () => ({ status }),
      complete: async () => { completed = true; },
      signal: new AbortController().signal,
    }));
    assert.equal(completed, false);
  }
});

test("unmount stops polling before completion", async () => {
  const abort = new AbortController();
  let completed = false;
  await confirmation.waitForStake({
    check: async () => { abort.abort(); return { status: "credited" }; },
    complete: async () => { completed = true; },
    signal: abort.signal,
  });
  assert.equal(completed, false);
});

test("pending payment timeout offers recovery without claiming success", async () => {
  let completed = false;
  await assert.rejects(confirmation.waitForStake({
    check: async () => ({ status: "pending" }),
    complete: async () => { completed = true; },
    signal: new AbortController().signal,
    maxChecks: 2,
    pause: async () => {},
  }), /confirmation/);
  assert.equal(completed, false);
});

test("an unpaid invoice does not imply a broadcast transfer", () => {
  assert.equal(confirmation.stakeProgress("awaiting_payment"), "The vault has not received the stake payment yet.");
  assert.match(confirmation.stakeProgress("pending"), /confirmation/);
});
