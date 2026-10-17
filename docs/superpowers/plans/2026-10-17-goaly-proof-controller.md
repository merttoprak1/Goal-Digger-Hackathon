# Goaly Proof Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every currently supported proof submission through Goaly/QVAC and require API-validated review before custom evidence can satisfy a challenge.

**Architecture:** Keep the existing deterministic timed-math assessment and add a challenge-context written-evidence assessment through QVAC. The API stores reviewer verdicts, makes only accepted custom evidence outcome-eligible, and never delegates finalization or settlement to Goaly.

**Tech Stack:** TypeScript, Express, Zod, SQLite, Node test runner/Vitest, QVAC service in Node.js.

**Spec:** `docs/superpowers/specs/2026-10-17-goaly-proof-controller.md`

## Global Constraints

- Only currently implemented proof methods, timed math and custom written evidence, enter the initial shared review flow.
- Timed math requires the existing deterministic API answer check to agree with Goaly.
- Only API code may persist proof state or calculate/finalize an outcome.
- Invalid or unavailable reviewer responses fail closed; user evidence is data, never instructions.
- Goaly cannot approve wallet payments, move funds, select winners, or execute payouts.

## Review Focus

- Evidence containing prompt injection must be treated as data and cannot change the rule or output schema; test malicious evidence.
- QVAC malformed, unavailable, timeout, or unsupported responses must not count as proof; test invalid and unavailable reviewer results.
- Rejected/unclear written evidence must not create a success outcome; test each verdict and resubmission.
- A model acceptance must not override a wrong timed-math answer; test disagreement with deterministic validation.
- Unsupported enum proof methods must remain blocked from submission/finalization; test `official_result` and `activity_record`.

---

### Task 1: Add structured QVAC review for custom evidence

**Files:**
- Modify: `qvac/assessment.mjs`
- Modify: `qvac/server.mjs`
- Modify: `api/src/services/local-proof-reviewer.ts`
- Modify: `api/src/config/env.ts`
- Modify: `api/src/app.ts`
- Modify: `api/src/routes/challenge/context.ts`
- Test: `tests/assessment.test.mjs`
- Test: `api/tests/local-proof-reviewer.test.ts`
- Modify: `api/.env.example`

**Interfaces:**
- Consumes: current `localProofReviewer` math interface.
- Produces: `ProofReviewInput` variants for timed math and custom proof, with common `ProofReview` verdicts `accepted | rejected | unclear`; custom context includes challenge id, success rule, and evidence. Reviewer verifies response rule/context and returns bounded reason.

- [x] **Step 1: Write failing unit tests** for QVAC custom assessment (accepted, rejected, unclear, injection-containing evidence) and API response validation/context mismatch.
- [x] **Step 2: Run** `node --test ../tests/assessment.test.mjs` and `npm test -- --run tests/local-proof-reviewer.test.ts` from `api/`; confirm the new cases fail because custom review is unsupported.
- [x] **Step 3: Implement** a strict structured QVAC review format and server operation while preserving the existing timed-math `/qvac/assess` behavior; extend the shared API reviewer to call it for custom proof and reject malformed/context-mismatched results.
- [x] **Step 4: Run** `node --test ../tests/assessment.test.mjs` and `npm test -- --run tests/local-proof-reviewer.test.ts` from `api/`; expect all tests to pass.

### Task 2: Gate custom proof outcomes on accepted review

**Files:**
- Modify: `api/src/routes/challenge/settlement.ts`
- Modify: `api/src/store/outcomes.ts`
- Modify: `api/src/routes/challenge/context.ts` if types require it
- Test: `api/tests/outcomes.test.ts`

**Interfaces:**
- Consumes: Task 1’s `ProofReviewer` and `ProofReview` interface.
- Produces: `POST /:id/proof-note` invokes Goaly with challenge context and returns `{saved, review:{verdict,reason,reviewer}}`; only accepted/rejected reviews are stored; custom success requires an accepted stored review within the existing deadline.

- [x] **Step 1: Write failing API tests** for accepted custom proof success, rejected custom proof failure, unclear proof not saved and retryable, and QVAC unavailable not recording proof.
- [x] **Step 2: Run** `npm test -- --run api/tests/outcomes.test.ts`; confirm the new review and outcome assertions fail.
- [x] **Step 3: Implement** review-before-save for written proof, persist verdict/reason/reviewer with the statement and timestamp, and require accepted verdict in `provedCustom`.
- [x] **Step 4: Run** `npm test -- --run api/tests/outcomes.test.ts`; expect all tests to pass.

### Task 3: Surface Goaly’s custom-proof review and verify integrations

**Files:**
- Modify: `frontend/app/lib/board.ts`
- Modify: `frontend/app/routes/challenge.tsx`
- Test: `frontend/tests/board.test.ts` (or the existing proof-flow test if present)
- Modify: `docs/BACKEND-MATH-PROOFS.md` only if its description becomes inaccurate

**Interfaces:**
- Consumes: Task 2’s `{saved, review:{verdict,reason,reviewer}}` response.
- Produces: UI status/reason for accepted or rejected review; unclear and service errors remain actionable retry states.

- [x] **Step 1: Write a failing frontend test** that verifies the custom proof client parses and exposes the review verdict and reason.
- [x] **Step 2: Run** `npm test -- --test-name-pattern='submits custom proof'`; confirm the new assertion fails on the current `{saved}` response schema.
- [x] **Step 3: Implement** the response schema and display the review reason/status after submission without implying that the model settles or transfers funds.
- [x] **Step 4: Run** `npm test` and `npm run typecheck` in `frontend/`, then run the full API and QVAC suites and API typecheck; expect all to pass.

### Review follow-up

- [x] Recheck the proof deadline after QVAC returns so a slow review cannot overwrite an earlier accepted proof after the deadline.
- [x] Align QVAC custom success-rule validation with the API's 1000-character limit and test the maximum Unicode rule/evidence payload.
- [x] Increase only the written-proof API parser limit to 16 KB; retain the 4 KB limit for other API requests.
- [x] Treat both the success rule and submitted evidence as untrusted data in the QVAC review prompt.

---
