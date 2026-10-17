# Private WDK deposit endpoint

The endpoint creates an RGB invoice and saves it under a payment ID.
It does not send funds, confirm a deposit, credit a stake, or pay a winner.

## Start

Run the existing WDK setup first, as described in [WDK-CHECK.md](WDK-CHECK.md).
Use Node.js 24 or later. From the repository root, start a separate private server:

```bash
read -s VAULT_API_TOKEN
export VAULT_API_TOKEN
node vault.mjs
```

Enter a private token at the prompt. The server refuses to start without a token.
It listens only on `127.0.0.1:4001`. Keep this token on the backend, outside frontend code.
The existing integration server on port 4000 remains separate.
Run one vault server. Avoid WDK CLI operations while it processes requests, because both use the same wallet database.

## Create a deposit invoice

```bash
curl http://127.0.0.1:4001/vault/deposits \
  -H "Authorization: Bearer $VAULT_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"paymentId":"challenge-1-creator","amountAtomic":"1000000"}'
```

The payment ID contains 1 to 80 letters, digits, underscores, or hyphens.
Send the amount as a positive integer string in atomic units. One test USDT equals `1000000` units.
This test endpoint accepts at most 100 test USDT per invoice. It always uses the previously tested asset ID.
The request body must not exceed 4 KB.

The response contains `paymentId`, `assetId`, `amountAtomic`, `status`, `invoice`, `recipientId`, and `expirationTimestamp`.
The status is `awaiting_payment`, which means the invoice exists. It does not mean any funds arrived.
Invoices require one confirmation and expire after one hour.

| HTTP status | Meaning |
|---|---|
| 201 | New invoice saved |
| 200 | Same request returned its saved invoice |
| 400 | Invalid payment ID, amount, or request body |
| 401 | Missing or incorrect token |
| 409 | Changed amount, or an uncertain earlier invoice request |
| 413 | Request body exceeds 4 KB |
| 415 | Incorrect content type |
| 503 | Wallet or storage operation failed |

An expired invoice remains attached to its payment ID. A retry does not replace it automatically.

## Records and failures

SQLite stores records in the ignored `wdk/data/vault.sqlite` database.
Keep the database and any journal files with the full wallet directory.
The server saves `unknown` before calling WDK. It saves the invoice only after WDK returns a usable response.
The wallet call has a 60-second timeout. An error or interruption leaves the payment ID uncertain.
Repeated requests return HTTP 409 for that ID rather than creating another invoice.
Reconcile uncertain records with the WDK transfer history before changing them. Do not delete records to retry.

The server processes wallet calls one at a time. Authentication applies to every request.
Ege must map each payment ID to a participant and challenge in his backend.
The next step is a deposit status endpoint that checks the received asset, amount, recipient, and confirmed transfer before crediting a stake.

## Checks

```bash
node --test vault.test.mjs assessment.test.mjs rgb-wallet.test.mjs
```

On October 17, 2026, all 10 tests passed.
The live check created a real WDK invoice for 1 test USDT and decoded it through the original RGB node.
The decoded network was SignetCustom, with the exact expected asset and amount.
A server restart returned the same saved invoice. The check sent no funds.
