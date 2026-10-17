# Execute a winner payout

The challenge API can execute the caller's prepared winning payout.
Execution can send test USDT from the WDK vault.
The automated tests use simulated transfers and temporary databases.

Use the winner's participant bearer token:

| Method | Route | Result |
| --- | --- | --- |
| POST | `/api/challenges/:id/payout-execution` | Execute or recover the saved payout. Send `{}`. |
| GET | `/api/challenges/:id/payout-execution` | Read only the caller's saved execution, or `null`. |

First create the final outcome, payout plan, and [winner invoice request](BACKEND-WINNER-INVOICES.md).
The browser cannot supply an amount, participant, payout ID, or replacement invoice.
The backend checks the caller's winning allocation and current funding ledger against the saved snapshot.
A changed ledger blocks execution with HTTP 409.

The backend saves an `unknown` execution record before the private vault call.
It then calls the existing vault execution endpoint with the saved payout ID.
The vault checks invoice validity, transfer history, and spendable assets before a new send.
Its durable attempt record prevents a second send for that payout ID.

An accepted response contains `execution.status: accepted` and the transaction ID in `execution.txid`.
The backend saves the full checked receipt.
Concurrent requests and later retries return the same accepted transaction.
The records survive a restart.

A timeout or invalid vault response leaves the local attempt `unknown`.
Retrying this route contacts the vault with the same payout ID.
The vault returns an existing accepted receipt or keeps an uncertain attempt on hold.
It does not repeat an uncertain transfer.
Never create another payout ID to bypass that hold.

If the vault rejects an expired invoice, the route returns HTTP 422.
The local record remains unknown because this field tracks the unresolved backend request.
It does not mean a transfer occurred.
Invoice replacement still needs a separate recovery policy.

GET reads the local record. It does not refresh blockchain settlement or send assets.
`accepted` means the vault accepted the send. It does not mean the payout settled.
Settlement checks remain the next step.

| HTTP status | Meaning |
| --- | --- |
| 200 | Saved accepted transaction |
| 400 | Body is not an empty object |
| 401 | Missing or invalid participant session |
| 403 | Caller has no winning allocation |
| 404 | Published challenge not found |
| 409 | Missing prepared payout, changed funds, conflict, or uncertain vault attempt |
| 422 | Vault rejected the invoice before a new send |
| 503 | Vault unavailable or response does not match the saved payout |

The backend retains a checked accepted receipt even if funds change during the vault call.
A later POST still blocks on that funding change.
GET keeps the receipt available for inspection.
The private vault token stays on the backend.
The local demo still uses participant sessions as its identity mechanism.
