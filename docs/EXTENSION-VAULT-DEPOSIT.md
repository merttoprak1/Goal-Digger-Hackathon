# Extension to WDK vault deposit

Date: October 17, 2026. Network: Mutinynet / CustomSignet.

The KaleidoSwap extension sent 1 test USDT to the private WDK vault.
The vault reports `settled` for the saved payment ID, asset, amount, recipient, and transaction.
The extension shows 99 test USDT after the transfer.

| Field | Value |
|---|---|
| Extension version | 0.4.0-beta.3 |
| Payment ID | `extension-vault-test-20261017-1` |
| Asset ID | `rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0` |
| Amount | 1,000,000 atomic units = 1 test USDT |
| Recipient ID | `sbc:wvout:BXhDxRoS-pKdMrTP-DDoDt3P-bm23nZf-nS7yxUT-VlMMG2P-g7OXlFA` |
| Transaction ID | `c3ca83e1aa52e8e42add0a4eb81cb0312a29b0e1d3a43bed6f87541f64772be2` |
| Confirmed block | 3,512,972 |
| Vault receipt status | `settled` |
| Receipt check | `2026-10-17T12:48:45.758Z` |

## Check

The private [deposit endpoint](VAULT-API.md) created the invoice for the payment ID above.
The extension decoded the invoice as a witness receipt for 1 USDT.
The user created UTXOs in the extension and approved the send.
The vault first reported `pending`, then `settled` after confirmation.
The Mutinynet indexer confirmed the same transaction in the block above.

This receipt tests the extension-to-vault deposit path. It does not credit a challenge stake or authorize a payout.
Keep the vault ledger and wallet data in the ignored `wdk/data/` directory.
Do not repeat the send to check its status. Use the authenticated GET endpoint for this payment ID.
