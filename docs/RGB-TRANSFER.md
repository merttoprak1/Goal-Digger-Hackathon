# RGB test transfer

Date: October 17, 2026. Network: Mutinynet, reported by the node as SignetCustom.

## Transfer details

| Field | Value |
|---|---|
| Sender | Mert's local RGB node |
| Recipient | Ege's RGB wallet |
| Asset ID | `rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0` |
| Asset label | USDT, test asset |
| Precision | 6 |
| Amount | 1,000,000 atomic units, equal to 1 test USDT |
| Recipient type | Witness |
| Bitcoin witness output | 1,000 test satoshis |
| Requested fee rate | 1 satoshi per virtual byte |
| Required confirmations | 1 |
| Transaction ID | `2544e91de7ca74cda8c0a00b4e674564b7ecde7795c735d8d849d14209d8674b` |

## Verification

The sender began with 100 test USDT. The node accepted one transfer of 1 test USDT.

Ege supplied matching receiver output showing ReceiveWitness and the same transaction ID and amount. His reported status was WaitingBroadcast.

After the sender refreshed, its status changed from WaitingCounterparty to WaitingConfirmations. Its projected asset balance became 99 test USDT.

The sender then reported Settled. Its settled, projected, and spendable balances all became 99 test USDT.

The recipient's final status and updated balance still need confirmation. Task 4 remains in progress.

## Check the existing transfer

On either laptop, refresh the existing transfer:

```bash
kaleido asset refresh
kaleido asset transfers --txid 2544e91de7ca74cda8c0a00b4e674564b7ecde7795c735d8d849d14209d8674b
```

Read the asset balance:

```bash
kaleido asset balance 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0'
```

Refresh and balance commands do not create another transfer. Do not send again while this transfer is pending.

## CLI compatibility finding

The installed CLI passed the full RGB invoice into the recipient ID field. The node rejected that request before transferring assets.

The successful request used the decoded recipient ID, asset ID, amount, witness data, expiry, and transport endpoint through POST /sendrgb.

A future payment adapter must decode and check invoices before constructing a send request. It must record the resulting transaction ID before attempting a retry.
