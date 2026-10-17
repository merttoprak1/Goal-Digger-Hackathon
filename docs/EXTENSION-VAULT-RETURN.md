# WDK vault to extension return

Date: October 17, 2026. Network: Mutinynet / CustomSignet.

WDK returned the [extension deposit](EXTENSION-VAULT-DEPOSIT.md) of 1 test USDT.
WDK reports `Settled`. The extension reports `Completed` for the same transaction.
The extension holds 100 test USDT again. WDK reports zero settled, future, and spendable test USDT.

| Field | Value |
|---|---|
| Asset ID | `rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0` |
| Amount | 1,000,000 atomic units = 1 test USDT |
| Recipient ID | `sbc:wvout:BervZw64-kgXPo2t-wT0rnaE-Y7FizhX-Y6xcTZu-pK~B_2J-uxcPDzw` |
| Transaction ID | `7b37f0b8d051df90005f232cd8a4e26da576a5aa92b054f0e5783d4c6484fbac` |
| Confirmed block | 3,512,979 |
| Extension requirement | 3 confirmations |
| Witness output | 1,000 test sats |
| Fee rate | 1 sat/vbyte |
| Actual transaction fee | 200 test sats |
| SDK fee estimate | 414 test sats |

## Checks

The extension created a witness invoice for the known USDT asset and an amount of 1.
The private invoice validator accepted the network, asset, amount, recipient, expiry, and RGB proxy.
The existing WDK return flow signed and sent the transfer locally.
The Mutinynet indexer confirmed its transaction and actual fee.
Both wallets then reported final settlement for the same recipient and transaction.

The test reused the existing return flow through a private script with separate journal paths.
The invoice, script, and send record remain in the ignored `wdk/data/custom-signet/` directory:

- `extension-return-invoice.json`
- `extension-return-check.mjs`
- `extension-usdt-return-send.json`

The earlier return to the local node keeps its original journal.
Do not remove journals or repeat a send to check settlement.
The private vault server stopped during the manual wallet operation and restarted afterward.

This test proves transfers in both directions between the extension and WDK.
It does not implement challenge payouts or add a payout execution endpoint.
