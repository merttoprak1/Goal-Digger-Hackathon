# Backend step 4: publication and opponent stakes

A creator can publish a funded challenge before its betting cutoff.
Signed-in opponents can then read its proof terms and create deposits against the creator's success.
This step does not evaluate evidence or authorize payouts.

## Publish

`POST /api/challenges/<id>/publish` requires the creator's participant bearer token and an empty JSON object.
The creator stake must already be credited before the cutoff. Its funding status must be `funded`.
The endpoint saves one publication time and returns the projected challenge.
A repeated publication request returns the same saved publication.
An unfunded, late-funded, or closed challenge returns HTTP 409 before publication.
Another participant cannot publish a private draft and receives HTTP 404.

Challenge list responses now include the signed-in participant's drafts and all published challenges.
A participant can read another creator's published challenge by ID, while unpublished drafts remain private.
The existing list limits remain unchanged.
There is no edit endpoint. Saved proof terms, stake amounts, and deadlines cannot be changed through the API.

## Opponent deposit

`POST /api/challenges/<id>/opponent-deposit` requires the opponent's session and this exact JSON body:

```json
{ "amountAtomic": "2000000" }
```

The amount is a positive integer string with a limit of 100 test USDT.
The backend accepts only bets against success. A supplied `side`, participant ID, or payment ID is rejected.
A creator cannot bet against their own challenge. Self-bets return HTTP 409.
The challenge must be published, open, and free from funding review before a new invoice request.
Betting closes at the saved cutoff, before the challenge starts.

Each participant can create one opponent stake per challenge.
The backend saves its amount and stable payment ID before requesting the vault invoice.
Retries return the same invoice. A changed amount returns HTTP 409, including after restart.
An existing invoice remains retrievable after cutoff for audit purposes. Do not pay it after cutoff.
An invoice request interrupted before a usable invoice returns must use the same challenge, participant, and amount on retry.
The vault retains its existing protections against duplicate invoice creation.

`GET /api/challenges/<id>/opponent-deposit` checks only the caller's own saved stake.
It requires a saved invoice and returns HTTP 409 if none exists.
A settled matching transfer credits one stake through the existing durable adapter.
Pending transfers do not enter the confirmed pool. Repeated confirmations cannot increase the pool twice.
Vault errors return HTTP 503 and do not create a funded bet.

## Pool and cutoff states

Challenge reads contain these additional fields:

- `publishedAt`: the saved publication time, or null.
- `confirmedPoolAtomic`: all confirmed credits, including funds that need review.
- `eligiblePoolAtomic`: credits first recorded before the betting cutoff.
- `reviewRequired`: true when any confirmed credit was first recorded at or after cutoff.

An open published challenge reports `open`. After cutoff it reports `betting_closed`.
A late credit changes its projected status to `funding_review`.
Late funds remain in the ledger but cannot automatically count toward payout eligibility.
The conservative cutoff rule uses the backend's first credit time, not a timestamp claimed by a browser.
A transfer that settled earlier but was first checked late also needs review.
No review status authorizes a loss, refund, replacement transfer, or payout.

## Checks and next step

All 23 API tests passed. Type checking, lint, and the production build passed.
The tests use the real SQLite credit adapter with simulated vault responses. No funds moved.
They cover publication ownership, funding eligibility, public access, self-bets, amount conflicts, cutoff checks, retries, persistence, late credits, and confirmed pool totals.
The next small step is a server-generated timed math proof with submission times and creator-only attempts.
