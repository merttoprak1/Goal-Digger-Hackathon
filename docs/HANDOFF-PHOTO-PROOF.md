# Handoff: Goaly photo proof and creator claim

Last updated: 2026-10-18

## Workspace state

- Repository: `/Users/mert/Documents/Hackathon/Goal-Digger-Hackathon/.worktrees/main-integration`
- Branch: `main`
- Last committed base: `adbd478` (`feat: accept and review image proof submissions`)
- The current implementation is **uncommitted and unpushed**.
- The worktree already had unrelated in-progress Goaly builder and UI edits. Preserve all current changes. Do not reset, stash, rebase, amend, or force-push. The user's hackathon workflow requires append-only history and no branch deletion.

## What is implemented in the working tree

- A shared accessible picker supports JPEG, PNG, and WebP, up to 5 MiB and 40 megapixels, with local preview, remove, replace, and validation feedback.
- The challenge proof form accepts a statement, photo, or both. It uploads formal evidence to the API for local Goaly review.
- Goaly chat has its own photo picker. Chat images are temporary context; only the latest user image is sent to QVAC, and earlier attachments are stripped from later turns.
- The API exposes a creator-authenticated `GET /api/challenges/:id/proof-note` that returns only saved verdict, reason, and reviewer. It never returns stored image bytes. This restores the accepted state after refresh.
- Once Goaly accepts timely custom proof, the creator can settle before the deadline. Settlement still requires all stake deposits to be resolved. It does not transfer funds automatically.
- Claim UI now requires a finalized outcome and the viewer's actual allocation from the payout plan. Only the creator can claim on success; allocated opponents can claim after failure.
- README text and the implementation plan were updated for photo review and vision setup.

## Important files

- `frontend/app/components/image-picker.tsx`
- `frontend/app/lib/proof-image.ts`
- `frontend/app/components/goaly-dock.tsx`
- `frontend/app/lib/goaly.ts`
- `frontend/app/lib/board.ts`
- `frontend/app/lib/payouts.ts`
- `frontend/app/routes/challenge.tsx`
- `api/src/routes/challenge/settlement.ts`
- `api/tests/outcomes.test.ts`
- `frontend/tests/goaly-image.test.ts`
- `frontend/tests/proof-image.test.ts`
- `docs/superpowers/plans/2026-10-18-goaly-image-input.md`

Goaly-related files were already dirty before this implementation began, including `frontend/app/components/goaly-dock.tsx`, `frontend/app/lib/goaly.ts`, `frontend/tests/goaly.test.ts`, `qvac/goaly-builder.mjs`, `qvac/server.mjs`, and `tests/goaly.test.mjs`. Other UI files also remain modified. Review `git status --short` and the full diff before staging; do not assume every change in those files belongs to the photo-proof work.

## Verification already completed

- `npm test --prefix frontend` — 80 passed
- `npm run typecheck --prefix frontend` — passed
- `npm run build --prefix frontend` — passed
- `npm test --prefix api` — 100 passed
- `npm run typecheck --prefix api` — passed
- `npm run test:payments --prefix frontend` — 34 passed
- `node --test tests/goaly.test.mjs tests/assessment.test.mjs tests/qvac-image-input.test.mjs` — 26 passed
- `git diff --check` — passed

## Suggested next actions

1. Review the photo-proof and payout diff, especially changes mixed into the pre-existing Goaly builder files.
2. Decide whether to commit this implementation as a separate append-only commit. Stage only reviewed changes and preserve the other dirty work.
3. Update `docs/HANDOFF-DEMO.md` and `docs/CLOSED-MUTINYNET-PILOT.md` if they are the runbook participants will use; they currently describe written-only proof and deadline-only settlement.
4. Do a live test with the vision model configured: submit photo-only proof, verify the creator can see the accepted verdict after reload, settle early, and confirm the creator claim uses the actual payout allocation. Then test rejection and failure after deadline.

## Product limits to retain

- Goaly assesses evidence; it does not independently verify external websites or decide payouts outside the configured success rule.
- A photo in chat is not a proof submission.
- Early success settlement remains an explicit participant action. Claiming still requires a WDK receive invoice and explicit claim flow.
- Do not test with mainnet funds. The pilot uses Mutinynet assets.
