# WDK RGB return transfer

Date: October 17, 2026. Network: Mutinynet / CustomSignet.

This check sends the previously received 1 test USDT from WDK back to the original local node.
WDK prepares the transaction, signs it locally, and submits it through its native RGB wallet.

## Transfer details

| Field | Value |
|---|---|
| Sender | WDK CustomSignet wallet |
| Recipient | Original local RGB node on port 3001 |
| Asset ID | `rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0` |
| Amount | 1,000,000 atomic units = 1 test USDT |
| Recipient ID | `sbc:wvout:BT5mD9QX-qN3ypC7-UUdyZVs-0a~YM~k-cqhaVnp-PDCouyF-RYj8~ig` |
| Bitcoin witness output | 1,000 test sats |
| Fee rate | 1 sat/vbyte |
| Required confirmations | 1 |
| Confirmed block | 3,512,740 |
| Actual transfer fee | 256 test sats |
| Transaction ID | `9941c47839385f00cc865965a1a118c2ee4fed78a179ac45313e5822ee3a2b6b` |

The SDK returned a fee estimate of 509 sats. The confirmed transaction's actual fee must come from the indexer, not that estimate.

## Result

Both wallets report `Settled` for the same return transaction.
The original node reports 99,000,000 atomic units settled, future, and spendable: 99 test USDT.
WDK reports zero settled, future, and spendable units for the same asset.
The full deposit and return sequence proves local WDK signing and RGB transfers with this test asset on Mutinynet.

Slot preparation and the return transfer cost 454 test sats in fees in total.
WDK retains 47,802 vanilla sats and 1,744 colored sats after the return.
Its BTC decrease matches the 1,000-sat witness output sent to the recipient and the fees.
All seven existing assessment and wallet tests also pass.

## Allocation outputs

The first send stopped in `sendBegin` with `InsufficientAllocationSlots`, before signing.
The refreshed transfer history contained only the settled incoming deposit. The WDK asset balance remained 1,000,000 settled and spendable units.
The earlier request record remains in `wdk/data/custom-signet/usdt-return-send-attempt-1.json`, with the reconciliation result.

WDK then created two empty, 1,000-sat allocation outputs in its own wallet.
It signed and broadcast transaction `fe9183fe92e560105364aaddabd44b2ff6eba631b9ce94a9c22d62b47e194458`.
That transaction confirmed in block 3,512,735 and cost 198 test sats in fees.
Only after confirmation did the return transfer proceed with the original recipient invoice.

## Bare signer correction

The pinned RGB SDK detected Node.js through the compatibility shim, even though it ran inside Bare.
The signer then tried to load unavailable Node.js dependencies.
The setup script checks the SDK's original source hash before correcting runtime selection and dynamic crypto imports for Bare.
It does not replace the signing algorithm or private keys.

During this correction, slot preparation preserved its unsigned transaction.
It resumed signing that same transaction rather than selecting inputs again.
The record marks the broadcast stage before the broadcast call. An uncertain broadcast never triggers automatic transaction creation.

## Repeat protection

The return command checks the invoice's network, recipient, asset, amount, expiry, and transport endpoint before signing.
It also requires the asset amount to be settled and spendable.
It saves the request before calling WDK and records the transaction ID afterward.
A saved request returns its existing record on a later call. A changed invoice or amount produces an error.
The repeated slot and return commands returned their existing records without creating another transaction.

The local journals and invoice remain in the ignored `wdk/data/custom-signet/` directory.
Do not delete those records to repeat a payment. Reconcile uncertain states against both wallets first.

From the repository root, check the existing WDK transfer:

```bash
cd wdk
npm run refresh
```

On the original node:

```bash
kaleido asset refresh
kaleido asset transfers --txid 9941c47839385f00cc865965a1a118c2ee4fed78a179ac45313e5822ee3a2b6b
```

The next step is a private vault API with durable payment records. Challenge settlement remains unimplemented.
