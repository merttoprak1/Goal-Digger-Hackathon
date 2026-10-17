# Payout invoice validation

Endpoint: `POST /vault/payouts/validate` on the private vault server at `http://127.0.0.1:4001`.
Use the same backend bearer token as the [deposit endpoints](VAULT-API.md).

This endpoint decodes and checks an invoice. It does not open the WDK wallet, read a seed, reserve inputs, sign, or send funds.
The native RGB decoder runs in a separate Bare process with a ten-second timeout.

## Request

```bash
curl http://127.0.0.1:4001/vault/payouts/validate \
  -H "Authorization: Bearer $VAULT_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"invoice":"rgb:...","amountAtomic":"1000000"}'
```

Send only the full RGB invoice and the intended payout amount as an atomic integer string.
The amount must be positive and at most 100 test USDT. The request body must not exceed 4 KB.

## Accepted invoices

The first version requires all of these conditions:

- CustomSignet network, matching Mutinynet.
- The exact tested Nia asset ID: `rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0`.
- A witness recipient with the `sbc:wvout:` prefix.
- A fixed fungible amount that exactly matches `amountAtomic`.
- An expiry more than 60 seconds in the future.
- Exactly one transport endpoint: `rpcs://proxy.iriswallet.com/0.2/json-rpc`.

Generic invoices without an asset or fixed amount are unsupported for this first payout check.
Blind receive invoices and other proxies are also unsupported.
These restrictions keep the first payout flow aligned with the tested transfer configuration.

## Response

HTTP 200 returns `valid: true`, `network`, `assetId`, `amountAtomic`, `recipientId`, and `expirationTimestamp`.
HTTP 422 returns `valid: false` with a reason when decoding fails or an invoice fails a condition.
HTTP 400 means the request fields are invalid. HTTP 401 means the token is missing or incorrect.
HTTP 503 means the decoder or another service operation failed. It does not establish that the invoice is invalid.

Validation checks the encoded payment terms only. It does not check available funds, recipient ownership, or whether an invoice was already paid.
It does not authorize a challenge payout or reserve an invoice for later use.
A future send endpoint must validate again immediately before signing and enforce durable payment IDs to prevent duplicate payouts.
Ege's backend owns the winner, payout amount, recipient selection, and challenge outcome.

## Checks

```bash
node --test tests/payout-invoice.test.mjs tests/vault.test.mjs tests/stake-deposits.test.mjs tests/assessment.test.mjs tests/rgb-wallet.test.mjs
```

On October 17, 2026, all 17 tests passed.
The live check created one receive invoice on the original RGB node. It sent no funds.
The validator accepted that invoice for 1 test USDT.
It rejected a different requested amount, an expired version, and a malformed invoice through the actual native decoder.

The next step is a durable payout request record before adding any send operation.
