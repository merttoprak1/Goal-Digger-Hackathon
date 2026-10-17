# Challenge outcomes

The backend saves a final outcome for published `wake_up` challenges with `timed_math` proof.
This step does not send payouts.

Use the participant bearer token for both routes:

| Method | Route | Result |
| --- | --- | --- |
| POST | `/api/challenges/:id/finalize` | Derive and save the outcome. Send `{}`. |
| GET | `/api/challenges/:id/outcome` | Read the saved outcome, or `null` before finalization. |

Any signed-in participant can trigger finalization after the proof deadline.
The server checks its own time and stored proof receipts.
An accepted answer within the proof window means `success`.
No accepted answer means `failure`, including missing or rejected proof.
The browser cannot supply an outcome or a timestamp.
Other proof methods return HTTP 409 until their assessment rules exist.

Finalization requires the exact creator stake and at least one confirmed opponent stake.
All credits must precede the betting cutoff.
Unresolved invoices, unmatched stake bindings, and late credits block finalization with HTTP 409.
These cases need a separate funds policy, including challenges with no opponents.
The backend does not discard deposits or assume a refund.

The saved outcome includes `challengeId`, `status`, `proofId`, `poolAtomic`, `stakes`, and `finalizedAt`.
Each stake contains its participant, payment, atomic amount, asset, transaction, recipient, and credit time.
The pool uses integer arithmetic.
SQLite saves the outcome and stake snapshot in one transaction.
Retries and restarts return the same saved outcome.
Challenge details show `succeeded` or `failed` after finalization.
Late credits still cause `funding_review` in the challenge details.

Finalization needs an explicit request. No scheduler runs this step yet.
A later payout step must check the current funds against the saved snapshot before it sends assets.
Timed math proves a response during the window. It does not prove when the creator woke up.
