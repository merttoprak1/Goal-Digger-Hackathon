# Photo proof submission for Goaly

## Goal

Let a participant submit one photo, written proof, or both, then let the local Goaly reviewer assess the evidence against the challenge success rule. Keep the API authoritative for proof state and outcomes. Keep wallet, invoice, payment, and settlement behavior unchanged.

## User-facing behavior

- The custom proof form accepts a written statement, one image, or both. It requires at least one of these inputs.
- A small image-upload icon appears beside the custom proof input and beside Goaly's chat input.
- The proof and chat image pickers accept JPEG, PNG, and WebP images up to 5 MiB and 40 megapixels. Each UI shows a local preview and lets the user remove or replace the image before submit.
- A chat image gives Goaly conversational context only. It does not submit proof, change a challenge, or create a review record.
- The API rejects empty evidence, unsupported media types, corrupt images, and images larger than 5 MiB with clear client errors.
- On submit, Goaly reviews the statement and image together with the challenge-specific success rule. Image-only proof is valid input. The UI shows the existing accepted, rejected, or unclear result behavior.
- A custom proof may only be submitted at or after the challenge start and before its proof deadline.
- An accepted proof unlocks challenge settlement immediately, without waiting for the proof deadline. A rejected, unclear, or pending proof does not unlock early settlement.
- After settlement, the creator can claim the full success pool with their WDK receive invoice. The API prepares and executes the payout only through the existing explicit claim flow.
- A failed challenge still waits until the proof deadline before opponents can claim their shares.
- The API preserves submitted image evidence with the proof record so a pending review can be retried after a process restart.
- If the local vision model is unavailable or misconfigured, the API fails closed and tells the user that review is unavailable. It does not accept text-only evidence as a substitute for an image the user submitted.

## Data flow

1. The proof form submits `statement` and optional `image` as `multipart/form-data` to the existing custom proof endpoint. At least one field must contain evidence.
2. The API validates the challenge, proof window, evidence presence, image signature, MIME type, and size before review.
3. The API stores proof image bytes in a private SQLite attachment record linked to the proof. It does not expose a public image URL.
4. The API sends the normalized image data and written statement to the local QVAC review service.
5. The Goaly chat form sends a text message and optional image to the local QVAC chat service. The chat image is not persisted by the API.
6. QVAC sends text and image content to a configured vision-capable local model. The reviewer treats all visible image text as untrusted evidence, never as instructions.
7. The API validates the structured proof verdict and applies existing proof and outcome rules.
8. If Goaly accepts proof, the challenge page enables settlement at once. The API permits early finalization only when a valid proof is accepted, and it creates the payout plan after the participant selects settle.
9. The winner submits a WDK receive invoice to claim their allocation. The creator receives the full pool after success. Failure outcomes remain locked until the proof deadline.

## Limits and storage

- One image per custom proof submission.
- One image per Goaly chat message.
- Maximum image size: 5 MiB before encoding.
- Maximum decoded image size: 40 megapixels.
- Supported formats: JPEG, PNG, and WebP. Reject SVG, animated formats, and files whose bytes do not match the declared supported image type.
- Store image bytes in SQLite with the proof record. Keep proof metadata and existing verdict fields. Do not store public URLs or model chain-of-thought.
- Preserve the existing one-proof-per-challenge and retry semantics. A pending review retry must use the same statement and image bytes. A user may replace evidence only where existing retry rules allow it.
- A successful challenge can finalize before its proof deadline only after a timely accepted proof. A failure outcome cannot finalize before the proof deadline.
- The creator claim form appears only after successful settlement. The payout API remains responsible for checking the signed-in participant's winning allocation.

## Local model configuration

- Configure QVAC with a vision-capable model and its matching image projection component as required by the installed QVAC runtime.
- Keep the existing text model path working for chat and challenge drafting.
- Keep chat attachments temporary in browser memory and in the request body only. Do not include prior images again in later chat turns.
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
2. Both proof and chat UIs show a small upload icon, preview the selected image, and support remove or replace.
3. A chat image reaches Goaly as temporary context and never counts as a formal proof submission.
4. The API accepts valid JPEG, PNG, and WebP images up to 5 MiB and 40 megapixels, and rejects empty evidence, corrupt images, unsupported images, and oversized images before review.
5. Valid proof image bytes persist with the proof record across API restart and remain private.
6. The local reviewer receives both written and visual evidence with the exact challenge success rule.
7. The reviewer returns only the existing structured verdicts. Invalid or unavailable image review fails closed.
8. Existing text-only proof submissions, text-only Goaly chat, and proof retry semantics continue to work.
9. A timely accepted proof unlocks settlement before the proof deadline. Pending, rejected, or missing proof cannot finalize early.
10. After successful settlement, the creator can submit a WDK receive invoice and claim the full pool. Losing participants cannot claim after a successful outcome.
11. Failure settlement remains unavailable until the proof deadline, and only allocated winners can claim.
12. Tests cover image validation, persistence, retry identity, reviewer payload shape, chat image context, vision unavailability, prompt-injection text in an image, early success settlement, delayed failure settlement, creator payout, and unchanged text-only behavior.
13. Existing wallet and payment tests pass unchanged.

## Out of scope

- OCR as a separate service, external image hosting, public image links, or image editing tools.
- Multiple images per submission, videos, PDFs, HEIC conversion, or automatic website verification.
- Changes to wallet approval, payment confirmation, betting, settlement, or payout.
