# WDK RGB deposit test

Date: October 17, 2026. Network: Mutinynet / CustomSignet.

## Transfer

| Field | Value |
|---|---|
| Sender | Existing local RGB node on port 3001 |
| Recipient | WDK wallet, native CustomSignet state |
| Asset ID | `rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0` |
| Label | USDT, test asset |
| Precision | 6 |
| Amount | 1,000,000 atomic units = 1 test USDT |
| Recipient ID | `sbc:wvout:BTNSe80y-nVtNFc4-35dlRKE-T8OHcau-lNRczgn-aHJYViD-2y5KSQA` |
| Witness output | 1,000 test sats |
| Fee rate | 1 sat/vbyte |
| Required confirmations | 1 |
| Confirmed block | 3,512,721 |
| Transaction fee | 198 test sats |
| Transaction ID | `059b3f4f98b26dfe2afd644da2f09b29b9bffc0fc62fa0d6b42183992a69486a` |

## Result

Both wallets report `Settled` for the same transaction.
The sender moved from 99 to 98 test USDT, with 98,000,000 atomic units settled and spendable.
WDK reports 1,000,000 atomic units settled, future, and spendable for the exact asset ID above.
Its BTC balance includes the original 50,000 vanilla sats and the new 1,000-sat colored witness output.

Before settlement, this native version briefly reported a future balance of 2,000,000 units for the one-token receipt.
After settlement, it reported the correct 1,000,000 units. Projected balances alone must not credit a stake.

## Network correction

The original WDK binding generated a standard Signet invoice, with an `sb:` recipient.
The sender decoded that invoice as Signet. No USDT transfer used it.
Changing only the indexer URL was insufficient for RGB compatibility, although the earlier BTC funding test worked.

The native library supports `SignetCustom`. The [setup script](../wdk/prepare-native.mjs) adds explicit selection through a local adapter flag.
It checks the pinned binding's source hash before changing one line.
It keeps standard Signet key derivation and selects CustomSignet for the native RGB wallet.
The original wallet database remains intact. Separate CustomSignet state uses the same seed and found the previously funded BTC.

The sender decoded the new invoice as SignetCustom before sending.
It also checked the amount, recipient, expiry, transport endpoint, asset ID, and available balance.

## First asset receipt

The fresh WDK wallet rejected an invoice with a preselected asset because it had not imported that asset yet.
The successful invoice specifies 1,000,000 atomic units without an asset restriction.
The send request explicitly selects the known test USDT asset ID above.
The receiver imports the asset through its first consignment.

An expected asset ID in the wrapper's response is metadata, not an invoice restriction.
A future deposit service must check the actual received asset, amount, transaction, and settlement status before crediting a stake.

## Check the existing deposit

From the repository root:

```bash
cd wdk
npm run refresh
```

Refresh the sender separately:

```bash
kaleido asset refresh
kaleido asset transfers --txid 059b3f4f98b26dfe2afd644da2f09b29b9bffc0fc62fa0d6b42183992a69486a
```

The local send record is in the ignored `wdk/data/custom-signet/usdt-deposit-send.json` file.
The request was recorded before the send. Do not repeat it to refresh the transfer.

This step tests receipt only. WDK signing, an outgoing RGB transfer, vault endpoints, and challenge settlement remain separate steps.
