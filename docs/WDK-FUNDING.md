# WDK test BTC funding

Date: October 17, 2026. Network: Mutinynet, which the existing node calls `SignetCustom`.

This transfer funds the separate WDK wallet for later RGB tests.
It uses test BTC and does not transfer RGB USDT.

Status: confirmed in block 3,512,706.
After synchronization, WDK reports 50,000 vanilla sats as settled, future, and spendable.
The sender reports 789,518 vanilla sats as settled, future, and spendable.
These balances match the transfer amount and fee.

| Field | Value |
|---|---|
| Sender | Existing local RGB node on port 3001 |
| Recipient | Separate WDK wallet in `wdk/data/` |
| Receive address | `tb1pjzwv26nfvexm5cl29yhwajf0epxyrn5fk78a8uv9dsfct5ddkr8qmlm4l0` |
| Amount | 50,000 test sats |
| Fee rate | 1 sat/vbyte |
| Transaction fee | 155 test sats |
| Transaction ID | `76872ef8d8fa034a5797ff340c733b72778ec1043f4b2e9c9c3694442d5f5735` |

The sender had 839,673 vanilla test sats before this transfer.
The transaction assigns 50,000 sats to the WDK address and returns 789,518 sats as change.
The amount and fee sum to the sender's decrease of 50,155 sats.

The [Mutinynet indexer transaction](https://esplora.signet.kaleidoswap.com/tx/76872ef8d8fa034a5797ff340c733b72778ec1043f4b2e9c9c3694442d5f5735) gives the output and confirmation details.

Run the WDK balance check from the repository root:

```bash
cd wdk
npm run check
```

Each check can return a new receive address from the same wallet.
The funding transaction remains assigned to the address recorded above.
Do not repeat the send command to refresh the balance.

Keep the full ignored `wdk/data/` directory, including its seed and RGB database.
The next step is an RGB receive invoice and a deposit of 1 test USDT.
