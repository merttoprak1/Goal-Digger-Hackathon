# Extension and vault endpoint round trip

Date: October 17, 2026. Network: Mutinynet / CustomSignet.

The extension deposited 1 test USDT through the vault deposit endpoint.
The vault returned that amount through the saved payout, execution, and settlement endpoints.
The deposit and payout status checks both reported `settled`.
The extension reported `Completed` for the return and showed 100 test USDT again.

| Field | Value |
|---|---|
| Asset ID | `rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0` |
| Amount in each direction | 1,000,000 atomic units = 1 test USDT |
| Deposit payment ID | `extension-full-flow-20261017-1` |
| Return payout ID | `extension-full-flow-return-20261017-1` |
| Demo challenge reference | `demo-full-flow-20261017` |
| Participant reference | `mert-extension` |
| Deposit transaction | `c692a150e2f38a66091c85070213928b0471f1310b9646d8a57023d8dada1d85` |
| Deposit block | 3,513,015 |
| Deposit witness output | 1,200 test sats |
| Deposit transaction fee | 256 test sats |
| Return transaction | `177ed143c41c98a005d7d8502949dcaa5dcf788b9dbb4ee4da23dcd859719064` |
| Return block | 3,513,022 |
| Return witness output | 1,000 test sats |
| Return transaction fee | 200 test sats |
| Return recipient | `sbc:wvout:BehVAFqM-8gE8i~R-YsIBK3p-nE1sIV~-xkyi7Pf-ysJaCi5-371hYjQ` |

## Endpoint checks

1. `POST /vault/deposits` saved the deposit invoice.
2. The user approved the extension send. `GET /vault/deposits/<paymentId>` reported the exact incoming transfer as `settled`.
3. The extension generated a fresh witness invoice for 1 USDT. `POST /vault/payouts` validated and saved it as `prepared`.
4. `POST /vault/payouts/<payoutId>/execute` returned `accepted` and the return transaction ID.
5. `GET /vault/payouts/<payoutId>/status` reported `pending`, then `settled` for that same transaction.

An identical execution retry returned the original transaction ID and attempt time without another send.
The payout attempt time remained `2026-10-17T13:14:40.960Z`.
The settlement endpoint reported `settled` at `2026-10-17T13:15:47.380Z`, with `executionStatus: "accepted"`.
The extension then completed its three-confirmation requirement.
The indexer supplied the actual transaction fees above.

## Scope and records

The demo challenge and participant references test the payment API. They do not represent an authorized challenge award or a credited stake.
The test checks a token deposit and return, not challenge outcome calculation.
SQLite keeps the deposit, payout request, execution claim, and settlement snapshot in the ignored `wdk/data/vault.sqlite` database.
The native payout journal remains at `wdk/data/custom-signet/payouts/extension-full-flow-return-20261017-1.json`.
Keep these records with the wallet data. Do not delete them or send again to check settlement.

The automatic approval service initially could not review the payout request because of a usage limit.
That request did not execute. After the user resumed, the test saved one payout request and executed it once.
