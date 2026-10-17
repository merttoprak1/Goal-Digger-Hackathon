# Goaly as the proof reviewer

## Goal

Use Goaly’s local QVAC-backed review service to assess every proof method that the product currently accepts, while keeping the API authoritative for proof state, challenge outcomes, and settlement.

## User-facing behavior

- A proof submission is reviewed against the challenge’s stated success rule and configured proof method.
- The reviewer returns one structured verdict: `accepted`, `rejected`, or `unclear`, with a concise reason tied to the submitted evidence.
- `accepted` means the evidence is eligible for the API’s existing outcome checks; it does not itself finalize the challenge or release funds.
- `rejected` means the evidence does not support the success rule. The API records the review and applies its existing retry/deadline rules.
- `unclear` means the evidence cannot be assessed confidently. The challenge remains unresolved, and the user may submit clearer evidence while the proof window is open.
- Timed-math submissions continue to receive an independent deterministic answer check in the API. A model verdict cannot override a wrong answer or inconsistent challenge/question context.
- Written/custom evidence must receive an `accepted` review before it can count as proof.

## Scope

The initial implementation covers proof methods that have a working submission and outcome path in the current app: timed math and custom written evidence. The contract’s `official_result` and `activity_record` values are not treated as supported proof flows until the product has source-specific retrieval and verification for them. The UI and API must not imply that Goaly can verify arbitrary websites, screenshots, or external activity automatically.

## Trust boundaries

- QVAC/Goaly is an evidence assessor, not a wallet, escrow, or settlement authority.
- The API validates challenge ownership, proof window, proof method, question/rule association, response schema, and deterministic proof checks.
- Only the API can persist proof state or calculate/finalize an outcome. Existing settlement authorization and payout controls remain unchanged.
- Reviewer output is untrusted input. Invalid or unavailable reviewer responses fail closed: no proof is accepted, no challenge is finalized, and no funds move.
- Evidence and challenge content are data, not instructions. The reviewer must not follow directives embedded in user-submitted evidence.

## Review contract

The shared reviewer accepts a normalized challenge context (challenge id, proof method, success rule, deadline/window), the proof prompt when applicable, and submitted evidence. It returns a schema-validated verdict and bounded reason. The backend stores the verdict, reviewer identity/version when available, and submission timestamp alongside the proof record. It does not store model chain-of-thought.

For timed math, the deterministic API check remains required in addition to reviewer output. A math proof is eligible only if both checks agree that the submitted answer is correct and belongs to the active challenge prompt. For custom evidence, only `accepted` can satisfy the proof predicate. `rejected` and `unclear` remain non-success states.

## Failure and retry behavior

- QVAC timeout, malformed JSON, unsupported verdict, wrong challenge/rule association, or reviewer service error leaves proof unaccepted and returns a clear retryable error where the submission window permits.
- A transient reviewer failure must not erase a previously recorded valid proof or create duplicate proof entries.
- A rejected or unclear review may be retried with new evidence while the challenge’s existing window rules permit it.
- Rechecking a payment/deposit remains separate from proof review and cannot be triggered by a reviewer verdict.

## Acceptance criteria

1. Every currently supported proof submission reaches the shared Goaly/QVAC reviewer with challenge-specific context.
2. Timed math still fails if deterministic answer validation fails, even when the reviewer returns `accepted`.
3. Custom evidence cannot satisfy the outcome unless its stored reviewer verdict is `accepted` and it meets the existing deadline rules.
4. `rejected` and `unclear` never finalize a challenge or trigger settlement.
5. Reviewer outages and malformed responses fail closed without losing or duplicating proof records.
6. Unsupported contract proof methods are rejected as unsupported rather than presented as Goaly-verified.
7. Tests cover all three verdicts, malformed/unavailable reviewer responses, deterministic math disagreement, resubmission, and proof-to-outcome behavior.

## Out of scope

- Letting Goaly create wallet invoices, approve wallet prompts, move funds, choose winners, or execute payouts.
- Automatically browsing or authenticating third-party lottery, exam, fitness, or activity websites.
- Changing settlement, escrow, custody, or payout policy.
- Treating free-form chat responses as proof verdicts.

## Open implementation details

- Reuse the existing QVAC assessment endpoint or add a versioned review operation behind it; keep one backend reviewer interface for all supported proof methods.
- Persist a compact review record in the existing proof store, following current repository data conventions.
- Preserve a human-readable reason in the UI without exposing internal prompts or model reasoning.
