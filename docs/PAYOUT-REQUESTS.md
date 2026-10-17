# Private vault payout requests

This step saves a validated payout request in SQLite before any transfer.
It does not send USDT, reserve funds, or decide who wins a challenge.
Use the private vault server and bearer token described in [VAULT-API.md](VAULT-API.md).

## Save a request

`POST /vault/payouts` accepts these exact fields:

```json
{
  "payoutId": "challenge-1-creator-payout",
  "challengeId": "challenge-1",
  "participantId": "creator-1",
  "amountAtomic": "1000000",
  "invoice": "<fresh RGB witness invoice from the recipient>"
}
```

IDs contain 1 to 80 letters, digits, underscores, or hyphens.
The payout ID `validate` is reserved for the existing validation endpoint.
The amount is a positive integer string with a limit of 100 test USDT.
One test USDT equals `1000000` atomic units.
The invoice must pass the existing [invoice checks](PAYOUT-VALIDATION.md).
Requests must use JSON and must not exceed 4 KB. Invoices must not exceed 3,000 characters.

The response contains the request fields, asset ID, recipient ID, expiry, creation time, and status `prepared`.
The vault stores it in the ignored `wdk/data/vault.sqlite` database.
It saves one record for concurrent retries. Records survive server restarts.

| HTTP status | Meaning |
|---|---|
| 201 | New validated request saved |
| 200 | Identical retry returned the original record |
| 400 | Invalid fields, IDs, amount, or JSON |
| 401 | Incorrect or missing bearer token |
| 409 | Changed details for a saved ID, or an RGB recipient already attached to another request |
| 413 | Request body exceeds 4 KB |
| 415 | Incorrect content type |
| 422 | Invoice failed validation |
| 503 | Decoder or storage unavailable |

A retry cannot change the challenge, participant, amount, or invoice.
A unique database constraint prevents two request IDs from sharing the same asset and RGB recipient.
Invalid invoices and decoder failures do not create a payout record.

## Read a request

`GET /vault/payouts/<payoutId>` requires the same bearer token.
It returns the saved record, or HTTP 404 for an unknown ID.
It does not call the wallet or decode the invoice again.
An identical POST retry also returns the original record if its invoice later expires.

`prepared` means only that the request passed validation when the vault saved it.
It does not mean the invoice remains valid, funds exist, or a transfer succeeded.
A future execution step must check these conditions again before signing.

## Backend responsibilities

Ege's backend must choose one stable payout ID for each intended challenge award.
It must authenticate the participant and check the winner, amount, and challenge state before creating a request.
The vault trusts those backend references. It does not verify them against a challenge database.
Use a fresh invoice for each intended payout.
Different invoices and request IDs can still describe the same intended award, so backend IDs must remain stable.
This table does not track transfers from the earlier manual test scripts.

## Checks

```bash
node --test payout-requests.test.mjs vault.test.mjs payout-invoice.test.mjs stake-deposits.test.mjs assessment.test.mjs rgb-wallet.test.mjs
```

On October 17, 2026, all 21 tests passed.
The new tests cover authentication, input validation, decoder failures, concurrent requests, immutable retries, recipient reuse, and persistence after restart.
The tests use temporary databases and do not send funds.

The next small step is an explicit execution operation with a durable transfer journal.
