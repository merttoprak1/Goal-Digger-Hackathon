# WDK connection check

Checked on October 17, 2026: a clean install connected to Mutinynet and synchronized a fresh wallet with zero balances.
An unavailable indexer produced exit code 1. The existing assessment and wallet tests passed all seven checks.

This separate check runs WDK on Mert's Apple Silicon Mac through the Bare runtime.
It uses the RGB package commit from the mentor's [sandbox](https://github.com/UTEXO-Protocol/utexo-rgb-wdk-sandbox).

## Run

From the repository root:

```bash
cd wdk
npm ci --ignore-scripts --allow-git=all --legacy-peer-deps
npm run prepare-native
npm run check
```

Use Node.js 24 or later for setup. The check itself runs in Bare, not Node.js.
The native setup downloads only the Mac ARM addon and checks its SHA-256 hash against the tested binary.
It also applies a checked, one-line change to the pinned WDK binding for explicit CustomSignet selection.
The setup refuses to patch a binding that differs from the pinned source.

## Configuration

| Setting | Value |
|---|---|
| WDK key network | `signet` |
| Native RGB network | `SignetCustom` |
| Mutinynet indexer | `https://esplora.signet.kaleidoswap.com` |
| RGB transport | `rpcs://proxy.iriswallet.com/0.2/json-rpc` |
| WDK RGB commit | `ead3ae43b76501c435fdb60e320fdeb6d3b59e7e` |
| RGB Bare package | `0.3.0-beta.18` |
| Native release | `v0.3.0-beta.17`, as specified by that package's download script |

The original WDK binding maps `signet` to standard Signet, even with a Mutinynet indexer URL.
That setting can read test BTC but generates RGB invoices with the wrong network.
Our setup adds an explicit `GOAL_DIGGER_CUSTOM_SIGNET` flag to select native `SignetCustom` while retaining Signet key derivation.
The check sets that flag and refuses to run without the adapter change.
The sender checks the decoded invoice network before a transfer. Correct CustomSignet recipients start with `sbc:`, not `sb:`.
Do not pass `mutinynet` as its network name: this version silently maps unknown names to Regtest.
The lockfile fixes the dependencies used for this check.

## Wallet data

The check creates a separate test wallet in `wdk/data/`. Git ignores this directory.
It stores the test seed in `seed.txt`, with file permissions `0600`, inside a directory with permissions `0700`.
The seed is plaintext. This check is for test funds only.
Keep the seed and the full RGB data directory together. The seed alone does not restore RGB allocations.
The check never reads the existing node's seed or wallet database.
CustomSignet state lives in `wdk/data/custom-signet/` and uses the same test seed.
The original standard Signet database remains in place. The CustomSignet wallet found the previously funded 50,000 test sats after synchronization.

## Scope

The check creates an account, synchronizes it, and reads its address and Bitcoin balances.
It reports success only after synchronization and cleanup finish.
It avoids `getBalance()`, because that package method converts some errors into a zero balance.

This pinned package clears its private key string before its base cleanup method reads the account's key pair.
The check initializes the key pair before cleanup to avoid the resulting checksum error.
The key initialization workaround is separate from the CustomSignet adapter change.

A successful connection does not prove RGB deposit, signing, transfer, or payout compatibility.
See [the deposit record](WDK-DEPOSIT.md) for the separate RGB receipt test.

## RGB receive check

```bash
npm run receive
npm run refresh
```

The receive command creates one witness invoice for 1,000,000 atomic units and saves it in the ignored CustomSignet directory.
It returns the same saved invoice on later calls. It never sends funds or replaces an expired invoice automatically.
The first invoice has no asset restriction because the fresh wallet does not know the asset until its first consignment.
The sender must select the exact test USDT asset ID. The wrapper's asset label alone does not constrain the invoice.
The refresh command checks the imported asset's balance and transfers. It does not create another transfer.
Neither command implements vault endpoints or authorizes a payout.

To check a connection failure:

```bash
WDK_INDEXER_URL=http://127.0.0.1:1 npm run check
```

That command must exit with an error. It must not report a connected wallet with a fabricated zero balance.
