# Execute a saved vault payout

The private vault can execute a saved payout through the local WDK wallet.
It records the attempt before WDK starts. It never automatically repeats an uncertain send.
Use the bearer token and private server described in [VAULT-API.md](VAULT-API.md).

## Execute

First save a [payout request](PAYOUT-REQUESTS.md) with a fresh recipient invoice.
Then call the execution endpoint for that payout ID:

```bash
curl http://127.0.0.1:4001/vault/payouts/challenge-1-creator-payout/execute \
  -H "Authorization: Bearer $VAULT_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

The body must be an empty JSON object. Execution uses the saved asset, recipient, amount, and invoice.
It checks the invoice again for network, amount, asset, recipient, expiry, and proxy.
An expired or changed invoice returns HTTP 422 before the attempt starts.
A decoder outage before the attempt returns HTTP 503 and leaves the request `prepared`.

SQLite saves an `unknown` attempt before the WDK process starts.
A unique constraint lets only one caller claim the payout, even across server instances.
The server serializes wallet calls. Run one vault server and avoid manual WDK commands while it processes requests.

WDK refreshes the wallet and checks settled and spendable USDT before sending.
It also rejects a recipient already present in its outgoing transfer history.
The sender uses 1 sat/vbyte and a 1,000-test-sat witness output.
The wallet needs enough test BTC for that output and its transaction fee.
It does not create allocation outputs automatically.

## Results and retries

| HTTP status | Meaning |
|---|---|
| 200 | WDK accepted the transfer, or a retry returned its existing transaction ID |
| 400 | Body is not an empty JSON object |
| 401 | Missing or incorrect token |
| 404 | Unknown payout ID |
| 409 | Existing attempt remains uncertain and needs reconciliation |
| 413 | Body exceeds 4 KB |
| 415 | Incorrect content type |
| 422 | Invoice failed the check before the attempt |
| 503 | Decoder, wallet, process, or storage operation failed |

A successful response contains the saved payout fields, `status: "accepted"`, `txid`, and `attemptedAt`.
`accepted` does not mean confirmed or settled. Use the separate [status endpoint](PAYOUT-SETTLEMENT.md) to check settlement.
The response from `GET /vault/payouts/<payoutId>` includes the latest execution record and any previous settlement check.
The original request remains immutable. POST retries to save the request still return its original `prepared` record.

If the sender times out, crashes, returns invalid data, or fails before a usable transaction ID returns, the attempt stays `unknown`.
This includes insufficient funds or allocation slots discovered inside WDK after the database claim.
Repeated execution calls return HTTP 409 without another WDK send.
Use GET and inspect both wallets before any manual repair.
There is no automatic reset, cancellation, or resend endpoint.

If a send succeeds but its final database update fails, the attempt also remains uncertain.
Reconcile the native journal with the WDK transfer history and recipient before changing its state.
Never delete an uncertain record to retry a payout.

## Storage and authority

SQLite stores attempts separately from immutable requests in `wdk/data/vault.sqlite`.
The WDK wrapper creates a private journal at `wdk/data/custom-signet/payouts/<payoutId>.json`.
It refuses to overwrite an existing journal. The native sender saves `unknown` before the transfer and `accepted` afterward.
Keep these records with the full wallet directory and seed backup.

Ege's backend must authorize the winner, amount, and challenge state before execution.
The vault does not compute winners, reserve a challenge pool, or verify participant ownership.
Use one stable payout ID per intended award. Different IDs and invoices can still pay the same person twice.
The bearer token grants payout authority and must remain outside the frontend.

## Checks

```bash
node --test payout-execution.test.mjs payout-transfer.test.mjs payout-requests.test.mjs vault.test.mjs payout-invoice.test.mjs stake-deposits.test.mjs assessment.test.mjs rgb-wallet.test.mjs
```

On October 17, 2026, all 31 tests passed without a live transfer.
They cover concurrent execution, restarts, uncertain results, database claims across server instances, invoice checks, spendable balances, and transfer arguments.
Use the separate [status endpoint](PAYOUT-SETTLEMENT.md) for a fresh check against WDK transfer history.
