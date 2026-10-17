# Frontend wallet connection

The `qvac-RGB` branch includes Vesim's frontend from commit `5ae3813` through a normal merge.
The new `/wallet` route reads the KaleidoSwap extension directly.
Challenge screens still use mock data while Ege builds the backend.
A visible banner labels this state. Vault keys and tokens remain outside the frontend.

## Start

Use Node.js 24 or later from the repository root:

```bash
npm ci --prefix frontend
npm run dev --prefix frontend -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/wallet` in Chrome with the KaleidoSwap extension enabled.
Select Mutinynet and unlock the extension before connecting.
Click Connect Wallet. Disable all optional signing and payment capabilities in the permission prompt.
Read-only wallet information remains available.

The screen calls `enable`, `getInfo`, and `listAssets` only.
It displays the reported network and available amount for the exact supported test USDT asset ID.
It does not use the ticker alone to identify USDT or convert large atomic amounts to floating point.
An absent asset appears as `Asset not present`. A failed read displays an error, not a zero balance.
Refresh after transfers or network changes. The displayed value is a snapshot.
After a successful connection, the page remembers only a connection flag in local storage.
On reload, it waits up to five seconds for extension injection and reads fresh wallet data.
It does not store balances, keys, or vault tokens.
Forget connection clears this flag. Revoke site permissions in the extension if needed.
A locked extension or revoked permission can still require user action.
The extension reports `signet` for Mutinynet, so the network label alone cannot distinguish it from standard Signet.
Check the extension settings before any transfer.

The wallet screen does not submit deposits or execute payouts.
The existing WDK vault remains private on port 4001.
A future backend route must authenticate participants and authorize each challenge payment.
Do not expose the vault token through Vite variables or frontend code.
The challenge screens no longer claim DLC enforcement or non-custodial multisig escrow.
Goal Digger operates the WDK vault and controls its keys.

## Checks

```bash
node --test frontend/app/lib/wallet.test.ts
npm run typecheck --prefix frontend
npm run build --prefix frontend
node --test *.test.mjs
```

The five wallet tests passed, including connection restoration after reload and failed restoration.
All 35 existing integration tests passed during the frontend integration.
Type checking and the production build passed. Chrome displayed the Wallet route and its connection button.
This step did not approve a new extension connection or send funds.
