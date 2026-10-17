# Winner receive invoices

A winner can attach a receive invoice to their exact saved allocation.
This step prepares a private vault request. It does not send funds.

Use the winner's participant bearer token:

| Method | Route | Result |
| --- | --- | --- |
| POST | `/api/challenges/:id/payout-request` | Check and save the caller's invoice, then prepare the vault request. |
| GET | `/api/challenges/:id/payout-request` | Read only the caller's saved claim, or `null`. |

The POST body contains only `invoice`:

```json
{"invoice":"<fresh RGB receive invoice>"}
```

The invoice must start with `rgb:` and contain no more than 3,000 characters.
The final outcome and payout plan must exist first.
The caller must have a winning allocation.
The server chooses the challenge, participant, amount, and stable payout ID.
A caller cannot supply those fields or claim another participant's award.

The private vault checks CustomSignet, the supported test USDT asset, the exact amount, expiry, witness recipient, and proxy.
The backend checks that the vault response matches the allocation.
Invalid invoices do not create a local binding.
The private vault token stays on the backend.

The database binds one invoice to each challenge award before the request reaches the vault.
The payout ID derives from the challenge and participant IDs.
The database also prevents recipient reuse across awards.
Concurrent requests cannot attach different invoices to the same award.

The response contains `claim`, including the invoice, amount, validation result, and stable payout ID.
Its `payout` field is `null` until the backend confirms the prepared vault record.
A lost response can leave this field empty even when the vault saved the request.
Retry the same invoice to recover the same request.
Do not generate a replacement payout ID.

A successful response includes `claim.payout.status: prepared`.
Identical retries return the saved record, including after a restart.
The backend checks the current funds against the fixed snapshot before every POST.
It also checks funds after invoice validation and after the vault response.
GET returns the saved record for inspection. It does not authorize execution.

| HTTP status | Meaning |
| --- | --- |
| 400 | Invalid body or extra fields |
| 401 | Missing or invalid participant session |
| 403 | Caller has no winning allocation |
| 404 | Published challenge not found |
| 409 | Missing plan, changed funds, bound invoice conflict, reused recipient, or test limit |
| 422 | Invoice failed validation |
| 503 | Private vault unavailable or response does not match |

The existing private vault limits one payout to 100 test USDT.
Larger allocations remain on hold. This step does not split an award.
After a binding exists, requests cannot replace its invoice, including after an uncertain vault response.
An expired bound invoice needs a separate recovery policy before replacement.
Preparing a payout does not reserve assets or prove wallet ownership.
The local demo uses participant sessions as its identity mechanism.
The next step must check eligibility and invoice validity again before execution.
