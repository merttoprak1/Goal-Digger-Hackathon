# Check vault payout settlement

The private vault can check whether WDK settled an accepted payout.
This check does not send funds or repeat execution.

## Check status

```bash
curl http://127.0.0.1:4001/vault/payouts/challenge-1-creator-payout/status \
  -H "Authorization: Bearer $VAULT_API_TOKEN"
```

The endpoint requires the private bearer token and a saved payout ID.
It returns HTTP 404 for an unknown ID and HTTP 405 for methods other than GET.

| Status | Meaning |
|---|---|
| `prepared` | No execution attempt exists. WDK was not queried. |
| `unknown` | Execution is uncertain, or usable matching history is missing. |
| `pending` | The exact outgoing transfer awaits acknowledgement, broadcast, or confirmation. |
| `settled` | The exact outgoing transfer matches and WDK reports `Settled`. |
| `failed` | The exact matching outgoing transfer reports `Failed`. |
| `review_required` | Duplicate matches, a different transaction, or incorrect amount data needs review. |

For an accepted execution, each request refreshes WDK and reads outgoing transfer history.
The check requires the saved asset, witness recipient, transaction ID, and exact requested amount.
Outgoing RGB transfers can have empty `assignments`, so the check uses `requestedAssignment.Fungible` for the amount.
A wallet balance or a transaction confirmation alone cannot report payout settlement.

The response contains the saved payout fields, current `status`, saved `txid`, `executionStatus`, and `checkedAt`.
`executionStatus` remains `accepted` after settlement. The check does not change the execution claim.
Prepared and uncertain executions return `checkedAt: null` without querying WDK.
An uncertain attempt remains blocked for manual reconciliation, even if a transfer might exist.

## Stored results and outages

SQLite stores the latest successful status check in `payout_status`, separate from payout requests and execution attempts.
`GET /vault/payouts/<payoutId>` includes this last check under `settlement` when available.
That nested result is an audit snapshot. Use the status endpoint for a fresh wallet check.
The status endpoint does not return a cached settlement when WDK is unavailable. It returns HTTP 503.
The earlier audit snapshot remains intact.
A later check can report `pending` again if WDK no longer reports settlement.

Execution retries still return the saved transaction ID without another send.
A failed or uncertain transfer does not authorize a replacement payout.
There is no automatic reset, refund, or resend operation.

## Checks

```bash
node --test payout-settlement.test.mjs payout-execution.test.mjs payout-transfer.test.mjs payout-requests.test.mjs vault.test.mjs payout-invoice.test.mjs stake-deposits.test.mjs assessment.test.mjs rgb-wallet.test.mjs
```

On October 17, 2026, all 35 tests passed.
They cover exact transfer matching, pending and failed states, conflicting history, service outages, fresh checks, and preservation of execution claims.
The native status reader and settlement matcher also checked the earlier [WDK return](EXTENSION-VAULT-RETURN.md) of 1 test USDT.
They reported `settled` for transaction `7b37f0b8d051df90005f232cd8a4e26da576a5aa92b054f0e5783d4c6484fbac`.
This check created no payout record and sent no funds.
