# Goaly Image Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add private photo proof submissions and temporary image context in Goaly chat, with local QVAC vision review.

**Architecture:** The browser sends one validated image per proof or chat message. The API persists formal proof images in SQLite and sends them to the local QVAC review service. Goaly chat sends its selected image as request-only context. QVAC uses a vision-capable model and its matching projection component while text-only behavior stays available.

**Tech Stack:** React Router, TypeScript, Express 5, Busboy multipart parsing, SQLite (`node:sqlite`), Node.js HTTP server, QVAC OpenAI-compatible chat completions.

**Spec:** `docs/superpowers/specs/2026-10-18-photo-proof-submission.md`

## Global Constraints

- One image per custom proof submission.
- One image per Goaly chat message.
- Maximum image size: 5 MiB before encoding.
- Maximum decoded image size: 40 megapixels.
- Supported formats: JPEG, PNG, and WebP.
- Store proof image bytes in private SQLite storage and do not expose a public image URL.
- A Goaly chat image is temporary context and does not count as proof or change a challenge.
- Image evidence and visible image text are untrusted data, never reviewer instructions.
- Invalid or unavailable vision review never accepts proof or finalizes a challenge.
- A timely accepted proof unlocks success settlement immediately. Missing, pending, or rejected proof cannot finalize early.
- Failure settlement still waits until the proof deadline.
- Winners claim only their finalized allocation with a WDK receive invoice. No payout runs automatically.
- Do not alter RGB transactions, wallet prompts, invoices, stake deposits, escrow, or payout behavior.

## Review Focus

- A file whose MIME type and bytes disagree is rejected before Goaly proof review.
- Image-only proof passes input validation and remains distinct from a chat attachment.
- A retry after restart accepts only the same statement and image bytes for a pending proof.
- Missing vision configuration leaves text-only Goaly available but rejects image review with a clear retryable error.
- Instructions embedded in an image do not override the challenge rule or reviewer policy.
- A proof submitted before the challenge start cannot unlock early settlement.
- The creator cannot claim before successful outcome settlement, and opponents cannot claim after creator success.
- An early accepted proof with unsettled stake deposits does not create a payout plan or transfer funds.

---

### Task 1: Add vision-aware QVAC requests

**Files:**
- Modify: `qvac/qvac.config.mjs`
- Modify: `qvac/server.mjs`
- Modify: `qvac/assessment.mjs`
- Modify: `qvac/goaly-builder.mjs`
- Modify: `tests/goaly.test.mjs`
- Modify: `tests/assessment.test.mjs`
- Modify: `README.md` QVAC setup instructions

**Interfaces:**
- QVAC review input adds optional `imageDataUrl: string` to the current challenge context and evidence fields.
- Goaly chat messages add optional `imageDataUrl: string` to a user message only.
- QVAC converts image-bearing user content into OpenAI-compatible text and `image_url` content blocks.
- QVAC readiness reports base-model and vision readiness separately.
- QVAC validates supported MIME types, image signatures, base64 payloads, and a 5 MiB encoded-image limit for both chat and proof requests.
- Image-bearing model requests use a 60-second timeout. Existing text-only timeouts stay unchanged.

- [x] **Step 1: Add failing tests** named `proofReviewMessages builds multimodal content for an image proof`, `readGoalyHistory accepts one valid image on the latest user message`, `readGoalyHistory rejects oversized or malformed image data`, and `getHealth reports vision configuration separately from base QVAC readiness`. Assert text-only requests still use string content.
- [x] **Step 2: Run `node --test tests/goaly.test.mjs tests/assessment.test.mjs`** and confirm the expected image handling tests fail.
- [x] **Step 3: Add QVAC vision configuration** through an explicit local projection-model path, while preserving the current text model configuration.
- [x] **Step 4: Build multimodal QVAC messages**, extend review instructions to treat all visible image text as untrusted evidence, and allow up to 60 seconds for image-bearing requests.
- [x] **Step 5: Run `node --test tests/goaly.test.mjs tests/assessment.test.mjs`** and confirm all tests pass.
- [x] **Step 6: Commit** the QVAC configuration and protocol changes.

### Task 2: Persist and review proof images in the API

**Files:**
- Modify: `api/src/app.ts`
- Modify: `api/src/routes/challenge/settlement.ts`
- Modify: `api/src/store/outcomes.ts`
- Modify: `api/src/services/local-proof-reviewer.ts`
- Create: `api/src/services/proof-image.ts`
- Modify: `api/package.json` and `api/package-lock.json`
- Modify: `api/tests/outcomes.test.ts`
- Modify: `api/tests/local-proof-reviewer.test.ts`

**Interfaces:**
- `POST /api/challenges/:id/proof-note` accepts multipart fields `statement` and optional file `image`; at least one must contain evidence.
- Proof review input carries `statement` and optional `{ mimeType, dataUrl }` image data.
- `beginProofReview(id, statement, imageHash, imageBytes, imageMimeType)` persists pending proof identity and image bytes. Retry identity includes statement and SHA-256 image hash.
- `saveProofNote` and `clearPendingProofReview` match the same statement, timestamp, and image hash.
- `finalizeOutcome` permits early success only when an accepted proof falls within the challenge window. It never permits early failure.

- [x] **Step 1: Add failing tests** named `accepts image-only custom proof`, `accepts text plus image proof`, `rejects empty evidence`, `rejects custom proof submitted before challenge start`, `rejects mismatched MIME signatures and oversized images before reviewer call`, `requires the same image hash for a pending retry`, `persists proof image bytes across API restart`, `allows early success finalization after accepted proof`, `blocks early finalization without accepted proof`, `blocks early failure finalization`, and `blocks early success finalization until all stakes are resolved`. Add `localProofReviewer forwards proof image data URL` and assert exact MIME and data URL values.
- [x] **Step 2: Run focused API tests** and confirm failures show missing multipart and image persistence behavior.
- [x] **Step 3: Add bounded Busboy parsing** with an in-memory upload buffer. Enforce one image, a 5 MiB file limit, and JPEG/PNG/WebP byte signatures. Decode with `sharp` using a 40-megapixel limit, and reject images that fail decoding.
- [x] **Step 4: Extend the existing SQLite proof record** with migration-safe MIME, BLOB, and hash columns. Include the image fields in the existing pending-proof and retry checks.
- [x] **Step 5: Send statement and optional image data to the local proof reviewer**, allow up to 60 seconds for image review, and preserve existing verdict and deadline behavior.
- [x] **Step 6: Run `npm test --prefix api` and `npm run typecheck --prefix api`** and confirm all tests pass.
- [x] **Step 7: Commit** the API upload, storage, and reviewer changes.

### Task 3: Add image controls to Goaly and the proof form

**Files:**
- Modify: `frontend/app/routes/challenge.tsx`
- Modify: `frontend/app/components/goaly-dock.tsx`
- Create: `frontend/app/components/image-picker.tsx`
- Create: `frontend/app/lib/proof-image.ts`
- Modify: `frontend/app/lib/board.ts`
- Modify: `frontend/app/lib/goaly.ts`
- Modify: `frontend/tests/goaly.test.ts`
- Create: `frontend/tests/proof-image.test.ts`
- Modify: `frontend/tests/board.test.ts`

**Interfaces:**
- `createBoardClient().saveProof(token, challengeId, statement, image?)` sends multipart form data.
- `validateImageSelection({ type, size, width, height })` accepts only JPEG, PNG, or WebP up to 5 MiB and 40 megapixels.
- `GoalyMessage` adds optional `imageDataUrl` for its current user message only.
- `askGoaly(messages, draft?)` sends image data only for the attached current message and displays it in the user bubble.
- `PrizeShares` enables settlement after accepted proof or after the proof deadline. It shows a claim form only when the settled outcome allocates a share to the signed-in participant.
- A pure payout helper derives claimable shares only from the settled outcome and its actual allocations; it returns no share while unsettled.
- Each image picker shows a local preview, remove/replace controls, validation feedback, and a small accessible upload icon.

- [ ] **Step 1: Add failing tests** in `frontend/tests/proof-image.test.ts` named `accepts supported images within the byte and pixel limits` and `rejects unsupported MIME type, oversized file, and oversized dimensions`. Add `board.test.ts` coverage named `saveProof sends multipart fields and optional image`, plus Goaly coverage named `askGoaly sends only the latest user image as temporary context`. Create `frontend/app/lib/payouts.ts` and `frontend/tests/payouts.test.ts` coverage for no claim before settlement, creator-only claims after success, and allocated opponent claims after failure.
- [ ] **Step 2: Run focused frontend tests** and confirm they fail for the missing upload controls and request fields.
- [ ] **Step 3: Add a shared image picker** with a small accessible upload icon, decoded-dimension validation, preview, validation feedback, removal, and replacement. Place it beside the formal proof input.
- [ ] **Step 4: Place the image picker beside Goaly's chat composer** and send the image as temporary context, separate from formal proof submission. Strip image data from older chat history before each request. Enable settlement as soon as accepted proof is recorded, and show claim controls only for a settled winning allocation.
- [ ] **Step 5: Run `npm test --prefix frontend`, `npm run typecheck --prefix frontend`, and `npm run build --prefix frontend`** and confirm all checks pass.
- [ ] **Step 6: Commit** the frontend controls and client changes.

### Task 4: Verify full proof flow and setup guidance

**Files:**
- Modify: `frontend/README.md`
- Modify: QVAC/local pilot setup documentation found during implementation
- Test: Existing Goaly, API, frontend, and payment suites

- [ ] **Step 1: Document local vision setup** with the required model and matching projection-model path. Do not download or commit model weights.
- [ ] **Step 2: Run all Goaly, API, frontend, and payment tests** and confirm image changes do not affect wallet/payment behavior.
- [ ] **Step 3: Run `git diff --check`** and review the final diff for unrelated wallet, payment, and pre-existing working-tree changes.
- [ ] **Step 4: Commit** the setup documentation and any final test-only fixes.
