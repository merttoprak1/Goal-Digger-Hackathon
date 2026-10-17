# Fixed betting shares and payout plans

Betting closes at the saved `bettingCutoff` time.
The API blocks new bets at that time, even without a close request.
The database stays SQLite for the local demo.

Use the participant bearer token for these routes:

| Method | Route | Result |
| --- | --- | --- |
| POST | `/api/challenges/:id/close-betting` | Save the confirmed stakes and exact shares. Send `{}`. |
| GET | `/api/challenges/:id/betting-snapshot` | Read the saved snapshot, or `null`. |
| POST | `/api/challenges/:id/payout-plan` | Save the payout calculation after a final outcome. Send `{}`. |
| GET | `/api/challenges/:id/payout-plan` | Read the saved plan, or `null`. |

Any signed-in participant can request these steps for a published challenge.
The server supplies the amounts and participant IDs. Requests cannot supply shares, winners, or amounts.
These routes do not call the vault or send assets.

## Shares at the cutoff

The close request succeeds only at or after the betting cutoff.
It includes confirmed credits recorded before that cutoff.
The backend requires the exact creator stake and at least one opponent.
Late credits, unresolved invoices, or unmatched stake bindings return HTTP 409 for review.
A credit at the exact cutoff is late.
The credit time is the first backend confirmation time, which can be later than blockchain settlement.

Each opponent gets a fraction with two integer strings:

`numerator = opponent stake`

`denominator = total opponent stakes`

The snapshot also stores `poolAtomic`, `opponentTotalAtomic`, the full stake receipts, `bettingCutoff`, and `sealedAt`.
The creator stake enters the pool but does not enter the opponent denominator.
Fractions stay exact. Display percentages do not control payouts.

The snapshot uses the cutoff as its boundary, even when the close request arrives later.
No scheduler creates the snapshot yet. A caller must request closure.
Outcome finalization also creates the snapshot if it does not exist.
Retries and restarts preserve the same saved snapshot.

## Payout calculation

After creator success, the creator receives the full pool.
After creator failure, each opponent receives `pool × numerator / denominator`.
These amounts include the returned stake.

For example, the creator stakes 5 USDT and two opponents stake 5 and 10 USDT.
The pool contains 20 USDT. Opponent shares are one third and two thirds.
On failure, their payouts are 6.666667 and 13.333333 USDT.
On success, the creator receives 20 USDT.

All calculations use integer atomic units. One test USDT has 1,000,000 atomic units.
The calculation first rounds each opponent payout down to a whole atomic unit.
It assigns remaining units to the largest division remainders.
Equal remainders use ascending participant ID order.
The allocations always sum to the exact pool amount.
This version deducts no platform fee from the RGB asset pool.

The backend saves each snapshot and plan in a database transaction.
Before plan creation or retry, it compares the current ledger with the snapshot and final outcome.
Changed funds return HTTP 409. They cannot silently change saved shares or payouts.
GET returns saved records for inspection, even if funds later need review.
A saved plan alone does not authorize a transfer.
The later execution step must repeat the funds check and bind each winner to a receive invoice.
