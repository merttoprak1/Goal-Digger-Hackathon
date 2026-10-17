# Payment API contract

Status: initial contract for later backend integration. The transfer endpoints below are not implemented.
The private WDK vault runs on port 4001. Its [payout invoice validator](PAYOUT-VALIDATION.md) is implemented without a send operation.

Ege's backend calls Mert's local integration server at `http://127.0.0.1:4000`. Vesim's interface displays the result through Ege's backend.

## 1. Request one transfer

Endpoint: `POST /rgb/transfers`.

```json
{
  "paymentId": "challenge-123-payout-ege",
  "invoice": "rgb:...",
  "amountAtomic": "1000000"
}
```

| Field | Meaning |
|---|---|
| `paymentId` | Ege creates one unique ID for the intended payment. Reuse it for every retry. |
| `invoice` | The recipient's full RGB receive invoice. |
| `amountAtomic` | A positive integer string. With precision 6, `1000000` means 1 token. |

The first implementation supports only the verified Mutinynet test asset:

```text
rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0
```

The adapter decodes the invoice and checks its asset, network, amount, and expiry before sending. It constructs the node request from the decoded fields.

Use the tested witness configuration: 1,000 test satoshis, fee rate 1 satoshi per virtual byte, and one confirmation. Reject unsupported recipient types initially.

Planned HTTP 202 response:

```json
{
  "paymentId": "challenge-123-payout-ege",
  "status": "pending",
  "nodeStatus": "WaitingCounterparty",
  "txid": "transaction ID returned by the node"
}
```

This response means the transfer is pending. A transaction ID alone does not establish settlement.

## 2. Read the existing transfer

Endpoint: `GET /rgb/transfers/:paymentId`.

Return HTTP 200 with the same fields and current status. An unknown payment ID returns 404.

| Status | Meaning |
|---|---|
| `pending` | The request is recorded, or the node is waiting for the recipient, broadcast, or confirmations. |
| `settled` | The node reports Settled. |
| `failed` | The node explicitly reports failure, or the request definitively failed before a transfer was created. |
| `unknown` | The send request might have reached the node, but its outcome is uncertain. Reconcile before another send. |

Allow null for `nodeStatus` and `txid` before the node supplies them. Reading status must never create a new transfer.

## Retry rules

Persist the payment ID and request before calling the node. Store the node's transaction ID and status when available.

The same payment ID with identical fields returns the existing record. Changed fields with that ID return HTTP 409.

A timeout after submission produces an unknown outcome. Never submit another transfer automatically because the first response was lost.

These rules must survive a server restart. Repeated requests must not pay twice.

## Ownership and access

Ege owns challenge outcomes, payout amounts, recipient selection, and the payment ID. Mert owns invoice checks, node calls, and transfer status.

The local model cannot authorize a payout. The payment adapter does not decide whether a challenge succeeded.

Before adding the send endpoint, configure a private bearer token for calls from Ege's backend. Keep the server on localhost and keep the token outside Git.

## Next small implementation

The read-only invoice validator is complete. It checks the invoice network, asset, amount, recipient type, expiry, and proxy.

Then add the durable payment record before implementing the send request.
