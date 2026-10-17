# Closed Mutinynet Pilot Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current tunneled Mutinynet pilot safer to operate by restricting access, protecting proof submissions during Goaly outages, exposing truthful readiness, and documenting repeatable launch and recovery checks.

**Architecture:** Keep wallet, challenge, proof, and settlement authority in the API. Add a server-side Basic Auth gate to the Vite pilot server, persist unresolved custom-proof reviews so deadlines cannot silently turn an outage into a loss, and report API readiness from live database, vault, and QVAC/RGB checks. Finish with a runbook tied to the actual local services and recovery behavior.

**Tech Stack:** TypeScript, React Router/Vite, Express, Node `node:sqlite`, QVAC, WDK vault, Node test runner, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-goaly-proof-controller.md`; current pilot process in `docs/HANDOFF-RUN.md`.

## Global Constraints

- No `git stash`, rebase, amend, reset, or force-push; each completed step is a new append-only commit.
- Keep the original checkout’s uncommitted work out of this branch and all commits.
- Mutinynet only; Goaly never approves wallet requests, moves funds, or finalizes outcomes.
- A proof submission made before its deadline must not become a creator loss only because QVAC is unavailable.
- The temporary Vite/tunnel setup is for a closed test pilot and is not production hosting.
- Never expose access passwords or vault credentials to browser JavaScript, logs, or committed files.

## Review Focus

- Missing pilot password or invalid Basic Auth must deny access before serving app/API content; cover config failure, unauthorized, authorized, and disabled-local modes in Task 1.
- A QVAC outage after timely custom evidence must leave a durable pending review and block failure finalization; cover restart, retry, and accepted/rejected completion in Task 2.
- Database, vault, QVAC, or RGB unavailability must make readiness return non-ready without changing liveness; cover each dependency failure in Task 3.
- An interrupted wallet approval/publication must never instruct a second payment; the Task 4 runbook must require Activity and server reconciliation before any retry.
- Backup recovery must include both API and WDK vault SQLite databases and explicitly require stopping services; cover the commands and verification in Task 4.

---

### Task 1: Gate the tunneled pilot server

**Files:**
- Create: `frontend/app/lib/pilot-access.ts`
- Modify: `frontend/vite.config.ts`
- Test: `frontend/tests/pilot-access.test.ts`
- Modify: `frontend/.env.example`

**Interfaces:**
- Produces `pilotAccessConfig(env)` and `createPilotAccessMiddleware(config)`; Vite installs the middleware for dev-server requests when `PILOT_MODE=true`.
- `PILOT_MODE=true` requires a non-empty `PILOT_ACCESS_PASSWORD`; the password is checked server-side with constant-time byte comparison. Disabled local development remains unchanged.

- [ ] **Step 1: Write failing tests** for required password validation and middleware behavior: missing password rejected, unauthorized request returns 401 with a Basic challenge, valid `pilot:<password>` continues, disabled mode continues.
- [ ] **Step 2: Run** `node --experimental-strip-types --test tests/pilot-access.test.ts` from `frontend/`; confirm the new exports are missing.
- [ ] **Step 3: Implement** the config and middleware, install it in Vite’s dev server, and document the two pilot environment variables without a default password.
- [ ] **Step 4: Run** the focused test, then `npm test`, `npm run typecheck`, and `npm run build` from `frontend/`.
- [ ] **Step 5: Commit** `feat: gate the closed pilot web server`.

### Task 2: Preserve timely proof while Goaly is unavailable

**Files:**
- Modify: `api/src/store/outcomes.ts`
- Modify: `api/src/routes/challenge/settlement.ts`
- Test: `api/tests/outcomes.test.ts`

**Interfaces:**
- The proof store gains `beginProofReview(id, statement)`, `getProofReview(id)`, `saveProofNote(id, statement, submittedAt, review)`, and `clearPendingProofReview(id, statement, submittedAt)`.
- Existing accepted custom proof is terminal and cannot be overwritten. One pending review per challenge is durable; only the exact same evidence can retry it. New evidence still requires an open proof window. One in-process Goaly review runs per challenge at a time.
- `finalizeOutcome` returns HTTP 409 `PROOF_REVIEW_PENDING` while a timely custom proof is unresolved. Successful accepted/rejected/unclear reviews resolve the pending row; only accepted proof is success-eligible.

- [ ] **Step 1: Write failing API tests** for QVAC failure leaving a pending record, finalization being blocked during pending review, same-evidence retry resolving it after restart, changed evidence being blocked while pending, accepted proof not being overwritten, and duplicate concurrent reviews being rejected.
- [ ] **Step 2: Run** `npm test -- --run tests/outcomes.test.ts` from `api/`; confirm the outage/finalization tests fail against the current store.
- [ ] **Step 3: Implement** durable pending-review state and exact-evidence retry; use the original submission timestamp for deadline eligibility and retain an accepted proof as terminal.
- [ ] **Step 4: Run** the focused tests, then `npm test`, `npm run typecheck`, and `npm run lint` from `api/`.
- [ ] **Step 5: Commit** `fix: hold outcomes for pending proof review`.

### Task 3: Report live API readiness

**Files:**
- Modify: `api/src/routes/health.ts`
- Modify: `api/src/routes/index.ts`
- Modify: `api/src/app.ts`
- Modify: `api/src/store/sessions.ts`
- Modify: `vault/vault.mjs`
- Modify: `vault/stake-deposits.mjs`
- Test: `api/tests/readiness.test.ts`
- Test: `tests/stake-deposits.test.mjs`
- Test: `tests/vault.test.mjs` (or the existing vault HTTP test file)

**Interfaces:**
- Keep `GET /api/health` as liveness. Add `GET /api/health/ready` that checks a live SQLite query, the authenticated vault health endpoint, and QVAC’s `/health` response (which includes RGB node status).
- Readiness returns `{status:"ready", checks:{database:"ok",vault:"ok",qvac:"ok",rgb:"ok"}}` with HTTP 200 only when every check passes; otherwise HTTP 503 with per-check `unavailable` statuses and no secrets.
- Add authenticated `GET /health` to the vault service and `stakes.health()` to its adapter. Health calls have bounded timeouts.

- [ ] **Step 1: Write failing tests** for healthy readiness, each dependency outage, unchanged liveness during dependency outage, vault health authentication, and no credential leakage in responses.
- [ ] **Step 2: Run** the focused API/vault tests and confirm the readiness behavior is absent.
- [ ] **Step 3: Implement** database, vault, and QVAC/RGB checks with bounded timeouts and per-component status.
- [ ] **Step 4: Run** the focused tests, then API and root suites, API typecheck, and lint.
- [ ] **Step 5: Commit** `feat: add dependency-aware pilot readiness checks`.

### Task 4: Publish the closed-pilot operating checklist

**Files:**
- Create: `docs/CLOSED-MUTINYNET-PILOT.md`
- Modify: `docs/HANDOFF-RUN.md`
- Modify: `docs/HANDOFF-DEMO.md`
- Modify: `frontend/README.md`

**Interfaces:**
- Document exact startup commands, `PILOT_MODE` and password handling, readiness checks, two-wallet payment/publication reconciliation, Goaly outage behavior, testnet-only limits, shutdown, and recovery.
- Include SQLite `.backup` examples for both `api/data/api.sqlite` and `wdk/data/vault.sqlite`, plus restore steps that stop services first and verify readiness before use.
- Correct obsolete claims that Goaly does not review proofs, the app uses mock data, or publication is automatic without a confirmed payment.

- [ ] **Step 1: Update** the run and demo docs from the current code behavior and include explicit go/no-go checks for a closed pilot.
- [ ] **Step 2: Verify** every command and endpoint against the checked-in scripts/configuration; run `git diff --check` and review all changed documentation.
- [ ] **Step 3: Commit** `docs: add closed Mutinynet pilot runbook`.
