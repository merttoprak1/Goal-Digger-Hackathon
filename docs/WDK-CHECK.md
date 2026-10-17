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

## Configuration

| Setting | Value |
|---|---|
| WDK network | `signet` |
| Mutinynet indexer | `https://esplora.signet.kaleidoswap.com` |
| RGB transport | `rpcs://proxy.iriswallet.com/0.2/json-rpc` |
| WDK RGB commit | `ead3ae43b76501c435fdb60e320fdeb6d3b59e7e` |
| RGB Bare package | `0.3.0-beta.18` |
| Native release | `v0.3.0-beta.17`, as specified by that package's download script |

The existing node calls this chain `SignetCustom`. This WDK package accepts `signet` with an explicit indexer URL.
Do not pass `mutinynet` as its network name: this version silently maps unknown names to Regtest.
The lockfile fixes the dependencies used for this check.

## Wallet data

The check creates a separate test wallet in `wdk/data/`. Git ignores this directory.
It stores the test seed in `seed.txt`, with file permissions `0600`, inside a directory with permissions `0700`.
The seed is plaintext. This check is for test funds only.
Keep the seed and the full RGB data directory together. The seed alone does not restore RGB allocations.
The check never reads the existing node's seed or wallet database.

## Scope

The check creates an account, synchronizes it, and reads its address and Bitcoin balances.
It reports success only after synchronization and cleanup finish.
It avoids `getBalance()`, because that package method converts some errors into a zero balance.

This pinned package clears its private key string before its base cleanup method reads the account's key pair.
The check initializes the key pair before cleanup to avoid the resulting checksum error.
This local workaround does not change the dependency source.

A successful connection does not prove RGB deposit, signing, transfer, or payout compatibility.
The next step is one small test deposit into this WDK wallet, followed by a confirmed RGB transfer.

To check a connection failure:

```bash
WDK_INDEXER_URL=http://127.0.0.1:1 npm run check
```

That command must exit with an error. It must not report a connected wallet with a fabricated zero balance.
