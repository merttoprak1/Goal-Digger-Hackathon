# Backend step 5: timed math proof

The server generates a fresh addition problem for a published wake-up challenge.
Only its creator can request a problem or submit an answer.
The server checks the answer and records the submission time locally.
This establishes a timely response. It does not prove that someone was asleep or woke up.

## Request a problem

`POST /api/challenges/<id>/math/problem` requires the creator's session and an empty JSON object.
The challenge must use `wake_up` and `timed_math`, be published, and have no funding review flag.
The saved start time is inclusive. The proof deadline is exclusive.
Requests before the start or at or after the deadline return HTTP 409.
A different participant receives HTTP 404.

The response contains a `problem` with a generated ID, `left`, `right`, `operator: "+"`, creation time, and `expiresAt`.
Operands are random integers from 10 through 99. The response does not contain an expected answer.
Repeated requests return the same unanswered problem.
A unique database index allows only one unanswered problem per challenge.

## Submit

`POST /api/challenges/<id>/math/submit` accepts these exact fields:

```json
{ "problemId": "<ID from the server>", "answer": "25" }
```

The answer must be an integer string with at most six digits and an optional minus sign.
The example value is illustrative. Solve the actual problem from the server.
The backend rejects supplied timestamps, verdicts, and extra fields.
The problem must belong to this creator's challenge.

A correct answer during the saved window returns a proof with status `accepted`.
An incorrect answer returns `rejected`. Both responses use HTTP 200 and include a reason and server submission time.
A wrong answer consumes that problem. The creator can request another fresh problem before the deadline.
There is no automatic challenge loss after one wrong answer.
Once the challenge has an accepted proof, it cannot generate or accept another new proof.

A retry with the same problem and answer returns the original receipt without another attempt.
A changed answer for a consumed problem returns HTTP 409.
An identical retry after the deadline can return its old receipt. It does not create a late proof.
An unknown problem returns HTTP 404. Invalid bodies return HTTP 400.
The database write also checks the saved time window before recording a new receipt.

## Read proof receipts

`GET /api/challenges/<id>/proofs` returns the creator's proof receipts and an `accepted` boolean.
Other participants cannot read this private attempt history.
Problems and receipts persist in `math_problems` within the existing API SQLite database.
Restarting the server does not reset accepted proofs or consumed problems.

This deterministic check does not call QVAC or trust a model verdict.
The separate Goaly chat remains planning advice. The earlier QVAC assessment demonstration remains available separately.
Exam, run, and custom evidence methods remain unimplemented.
A successful math check does not automatically establish every free-text claim in a challenge's success rule.
The wake-up demonstration uses the timed-response rule only.

## Checks and next step

All 29 API tests passed. Type checking, lint, and the production build passed.
Tests cover creator access, fresh problem IDs, one active problem, start and deadline boundaries, wrong-answer retries, accepted-answer persistence, idempotent receipts, and the database write boundary.
No funds moved.
The next small step is a durable challenge outcome: success from an accepted timed proof, or failure after the deadline without one.
Funding review and technical errors must not authorize payouts.
