# Mert's tasks: QVAC and RGB

Branch: `qvac-RGB`. Complete one task, check it, then commit and push before starting the next task.

## Completed

- [x] Run the downloaded Qwen model locally through QVAC.
- [x] Check the unlocked RGB node with read-only requests.
- [x] Add GET /health for both services.
- [x] Add POST /qvac/ask with input limits and service errors.
- [x] Add POST /qvac/assess for the fixed math demonstration.
- [x] Add GET /rgb/wallet for cached balances and assets.

## 1. Add one QVAC request endpoint (complete)

Status: implemented and checked with the real local model.

Add `POST /qvac/ask`. Accept a short text prompt and return the local model's answer.

Limit request size and inference time. Return a clear service error when QVAC is unavailable.

Done when: a request through our server gets a real local answer. An unavailable model produces an error rather than a fabricated answer.

Suggested commit: `Add local QVAC request endpoint`.

## 2. Return a structured evidence assessment (complete)

Status: checked with the real local model, including unclear evidence and attempts to override the rule.

The fixed demo question is 17 + 8. QVAC extracts the numeric answer. The server returns `accepted`, `rejected`, or `unclear`, plus a reason.

Check the model's output format before returning it. Malformed output and service errors must remain technical errors, not challenge failures.

Done when: clear positive, clear negative, and incomplete examples produce usable assessments. Evidence containing instructions cannot override the fixed rule.

This first check assesses text content only. It cannot establish that a transcript or external source is authentic.

Ege's backend must own challenge rules, deadlines, and final outcomes. A client-supplied rule or model response must never authorize a payout.

Suggested commit: `Add structured local evidence assessment`.

## 3. Read RGB balances and assets (complete)

Status: checked against the live node, including exact amount handling and failure responses.

Add one read-only endpoint for the demo wallet's balances and RGB asset list. Return only the fields the app needs.

Done when: results match the node. Keep bitcoin and RGB amounts separate. Include each asset's actual identifier and precision.

An empty asset list must appear as empty. It must not appear as a funded USDT wallet.

Suggested commit: `Add read-only RGB wallet endpoint`.

## 4. Complete one real test transfer

Estimate: 45–90 minutes, depending on funding and confirmation time.

First agree with Ege on who controls the demo funds and which wallet receives them. Use test assets only.

Prepare a separate recipient, obtain test funds, and send one small RGB transfer. Record its status until the recipient confirms receipt.

Done when: the sender and recipient show the completed transfer and matching balance changes. Record the commands and asset details without wallet secrets.

The exact payment endpoint follows this experiment. Do not assume an accepted send request means settlement completed.

Suggested commit: `Document verified RGB test transfer`.

## 5. Connect one complete demo

Estimate: 45–60 minutes after the required teammate endpoints are ready.

Agree on endpoint names and response fields with Vesim and Ege. Connect their interface and challenge logic to Mert's local services.

Rehearse one success and one failure with real test transfers. A repeated settlement request must not pay twice.

Done when: one challenge runs from creation through proof and confirmed payout on Mert's laptop. Identify any remaining mocks in the README.

Suggested commit: `Connect local QVAC and RGB demo`.

## Later

Image evidence needs a separate capability check. The current [QVAC HTTP chat interface](https://docs.qvac.tether.io/cli/http-server/) is text-only, so it must not silently discard submitted images.

Add transcript or run verification, custom challenges, WDK, speech, and charity after the first complete demo works.

## Ownership

Mert owns the local integrations. Vesim owns the interface. Ege owns challenge storage, betting rules, deadlines, and settlement logic.

Keep changes on the assigned branch. Merge shared changes normally. Never stash, rebase, or force push.

## Next action

Start task 4 by agreeing on custody and a separate recipient wallet. Then complete one small transfer with test assets.
