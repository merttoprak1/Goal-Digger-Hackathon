# Photo proof submission for Goaly

## Goal

Let a participant submit one photo, written proof, or both, then let the local Goaly reviewer assess the evidence against the challenge success rule. Keep the API authoritative for proof state and outcomes. Keep wallet, invoice, payment, and settlement behavior unchanged.

## User-facing behavior

- The custom proof form accepts a written statement, one image, or both. It requires at least one of these inputs.
- The image picker accepts JPEG, PNG, and WebP images up to 5 MiB. The UI shows a local preview and lets the participant remove or replace the image before submission.
- The API rejects empty evidence, unsupported media types, corrupt images, and images larger than 5 MiB with clear client errors.
- On submit, Goaly reviews the statement and image together with the challenge-specific success rule. Image-only proof is valid input. The UI shows the existing accepted, rejected, or unclear result behavior.
- The API preserves submitted image evidence with the proof record so a pending review can be retried after a process restart.
- If the local vision model is unavailable or misconfigured, the API fails closed and tells the user that review is unavailable. It does not accept text-only evidence as a substitute for an image the user submitted.

## Data flow

1. The browser submits `statement` and optional `image` as `multipart/form-data` to the existing custom proof endpoint. At least one field must contain evidence.
2. The API validates the challenge, proof window, evidence presence, image signature, MIME type, and size before review.
3. The API stores the image bytes in a private SQLite proof attachment record linked to the challenge proof. It does not expose a public image URL.
4. The API sends the normalized image data and written statement to the local QVAC review service.
5. QVAC sends text and image content to a configured vision-capable local model. The reviewer treats all visible image text as untrusted evidence, never as instructions.
6. The API validates the structured verdict and applies existing proof and outcome rules.

## Limits and storage

- One image per custom proof submission.
- Maximum image size: 5 MiB before encoding.
- Supported formats: JPEG, PNG, and WebP. Reject SVG, animated formats, and files whose bytes do not match the declared supported image type.
- Store image bytes in SQLite with the proof record. Keep proof metadata and existing verdict fields. Do not store public URLs or model chain-of-thought.
- Preserve the existing one-proof-per-challenge and retry semantics. A pending review retry must use the same statement and image bytes. A user may replace evidence only where existing retry rules allow it.

## Local model configuration

- Configure QVAC with a vision-capable model and its matching image projection component as required by the installed QVAC runtime.
- Keep the existing text model path working for chat and challenge drafting.
- Report vision readiness separately from base QVAC readiness. Image submissions fail closed when vision readiness is false.
- Do not download or commit model weights as part of the application change. Document the local configuration needed to enable vision.

## Trust and privacy

- Only the existing challenge creator may submit proof, under the existing session and challenge rules.
- Do not publish uploaded images through a static route.
- Treat the image, extracted text, and written statement as untrusted input. Prompt instructions inside evidence cannot change the challenge rule or reviewer policy.
- Reviewer failures, invalid output, and vision errors never accept proof or finalize a challenge.
- Do not alter RGB transactions, wallet prompts, invoices, stake deposits, escrow, or payout behavior.

## Acceptance criteria

1. The custom proof form can submit text only, image only, or text plus an image.
2. The UI previews an image before submit and supports removing or replacing it.
3. The API accepts valid JPEG, PNG, and WebP images up to 5 MiB, and rejects empty evidence, corrupt images, unsupported images, and oversized images before calling Goaly.
4. Valid image bytes persist with the proof record across API restart and remain private.
5. The local reviewer receives both written and visual evidence with the exact challenge success rule.
6. The reviewer returns only the existing structured verdicts. Invalid or unavailable image review fails closed.
7. Existing text-only proof submissions and proof retry semantics continue to work.
8. Tests cover image validation, persistence, retry identity, reviewer payload shape, vision unavailability, prompt-injection text in an image, and unchanged text-only behavior.
9. Existing wallet and payment tests pass unchanged.

## Out of scope

- OCR as a separate service, external image hosting, public image links, or image editing tools.
- Multiple images, videos, PDFs, HEIC conversion, or automatic website verification.
- Changes to wallet approval, payment confirmation, betting, settlement, or payout.
