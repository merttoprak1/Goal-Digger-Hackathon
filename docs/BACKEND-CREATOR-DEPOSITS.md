# Backend step 3: creator deposits

The backend attaches one creator deposit to each saved challenge draft.
The participant session determines ownership. The saved draft determines the amount.
This step does not open public betting or execute payouts.

## Configure

Run the private WDK vault on port 4001.
Set `VAULT_API_TOKEN` in the backend process to the same private token, then restart the API on port 4002.
Never place this token in frontend variables, browser storage, or a URL.
Without a configured token, funding operations return HTTP 503. Session and draft routes still work.

The backend reuses the existing durable stake adapter.
It stores stake bindings and credits alongside participants and challenges in `api/data/api.sqlite`.
The vault keeps its own invoice and transfer records separately.

## Create the invoice

`POST /api/challenges/<challengeId>/creator-deposit` requires the creator's participant bearer token and an empty JSON object.
It returns the vault invoice, payment ID, asset ID, atomic amount, recipient, expiry, and invoice status.
The stable payment ID is `creator-<challengeId>`.
Repeated calls return the saved invoice and cannot select another amount or participant.
An unexpired betting cutoff is required before creating the first invoice.
A saved invoice remains available on retry after the cutoff, so the backend does not lose track of an existing payment.
Do not pay an old invoice after its betting cutoff or expiry.

| HTTP status | Meaning |
|---|---|
| 200 | Existing or newly created invoice returned |
| 400 | Body contains fields or is not an empty JSON object |
| 401 | Invalid or missing participant session |
| 404 | Unknown draft or a different participant owns it |
| 409 | Betting cutoff passed before invoice creation |
| 503 | Vault configuration, service, or invoice operation unavailable |

## Check and credit

`GET /api/challenges/<challengeId>/creator-deposit` requires the same participant session.
Create the invoice first. Otherwise, the status check returns HTTP 409.
The adapter checks the actual asset, amount, invoice, recipient, and settled transfer before saving a credit.
Pending or unavailable transfers do not create credits. A repeated settled check returns the existing credit.

The response contains `status`, `credit`, `newlyCredited`, `confirmedPoolAtomic`, and `eligibleToOpen`.
A credited creator stake before the cutoff produces status `credited`.
An initial credit at or after the cutoff produces `review_required` and remains in the ledger.
This conservative rule uses the first backend credit time, not a claimed payment time from the browser.
A payment that settled earlier but was first checked late also requires review.
There is no automatic loss, refund, or replacement transfer.

`eligibleToOpen` is true only for a credited, timely creator stake while the cutoff remains in the future.
It is an eligibility signal. It does not publish the challenge or accept opponent bets.
A service failure returns HTTP 503, never a fabricated funding or loss result.
Previously saved credits remain available after a vault outage.

## Challenge reads

Challenge detail and list responses derive `confirmedPoolAtomic` from the credit ledger.
A timely creator credit gives status `funded`. A late credit gives `funding_review`.
Unfunded drafts retain status `draft` and a zero pool.
These projections remain correct after restart, even if vault credentials are temporarily unavailable.
They are private drafts until a later publication step.

## Checks

All 17 API tests passed. The three existing stake adapter tests also passed.
Tests use the real SQLite adapter with simulated vault responses and do not move funds.
They cover saved amounts, ownership, invoice retries, pending transfers, credit uniqueness, late funding, cutoff rules, outages, and persisted pools.
Type checking, lint, and the production build passed.
The next small step is publishing a funded challenge and accepting authenticated opponent deposits before the cutoff.
