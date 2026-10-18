> **Note:** This commit changes only this README. It was pushed after the 13:00 submission deadline so that the README describes the code that was already submitted. No code changed.

# Goal Digger — Bet on yourself. Settle on Bitcoin.

**Team:** Bounty Hunters

| Name | GitHub | Responsibility |
|---|---|---|
| Mert Toprak | [@merttoprak1](https://github.com/merttoprak1) | QVAC, RGB, WDK, and integration |
| Vesim Karadag | [@Vesimspace](https://github.com/Vesimspace) | Frontend and UX |
| Ege Okyay | [@Ege-Okyay](https://github.com/Ege-Okyay) | Challenge rules and settlement |

## Idea

You stake USDT on a goal. Friends bet USDT against you. A local AI judges your proof. RGB pays the winner on Bitcoin.

1. **Describe.** Chat with Goaly, the local assistant. It fills the title, success rule, proof source, stake, deadline, and visibility. You check every field.
2. **Stake.** You pay the stake in the KaleidoSwap extension. The challenge goes public only after that RGB payment settles.
3. **Bet against.** Friends stake against you before the betting cutoff. Only settled transfers join the pool.
4. **Prove.** You send text or a photo. QVAC returns `accepted`, `rejected`, or `unclear`. If the proof is not accepted, you can try again before the proof deadline. An accepted proof closes the challenge early.
5. **Get paid.** If you succeed, you take the whole pool. If you fail, opponents split the pool in proportion to their stakes. The winner's wallet creates a receive invoice, and the WDK vault sends that USDT share.

Example: the creator stakes 1 USDT, and two opponents stake 1 and 2 USDT. The pool is 4 USDT. If the creator succeeds, the creator gets 4 USDT. If not, the opponents get 1.333333 and 2.666667 USDT.

## Architecture

| Port | Service | Folder |
|---|---|---|
| 5173 | Web app (React Router 7, Vite). Proxies `/api` and `/qvac` | `frontend/` |
| 4002 | Challenge API (Express, Zod, SQLite): challenges, bets, proofs, payouts | `api/` |
| 4000 | Goaly server: prompts, JSON schemas, and input checks for QVAC | `qvac/` |
| 11434 | QVAC model server (Qwen3.5-2B Q4, plus a vision projector) | `qvac/qvac.config.mjs` |
| 4001 | Vault: private, token-protected. Invoices, deposit checks, payouts | `vault/` |
| — | WDK RGB wallet on the Bare runtime. Called by the vault | `wdk/` |
| 3001 | RGB Lightning Node. Funding source and health check | external |

The user's wallet is the KaleidoSwap browser extension. The web app talks to it through `window.rgb` and `postMessage`. The user approves every stake in KaleidoSwap.

All transfers are RGB witness transfers of test USDT on Mutinynet (Bitcoin signet). They have real transaction IDs.

## RGB operations

- **One invoice per stake.** The vault creates a witness receive invoice for each stake. Its recipient ID links the payment to one participant and one challenge.
- **Wallet send.** The app sends `REQUEST_ASSET_SEND` with witness data to KaleidoSwap. The user approves one popup. Nobody copies an address.
- **Transfer status.** The vault reads `WaitingCounterparty`, `WaitingConfirmations`, `Settled`, and `Failed` for each invoice. Only transfers settled before the betting cutoff count in the pool. A wrong amount or a duplicate transfer stops the challenge for review.
- **Payout.** The winner's KaleidoSwap wallet creates a witness receive invoice (`witnessReceive`). The vault decodes it, checks the asset and the amount, and sends the share with WDK.
- **Read the node.** `GET /rgb/wallet` on port 4000 reads BTC balances and RGB assets from the RGB Lightning Node. It never sends funds.

## QVAC features

- **Local OpenAI-compatible server.** `qvac serve --openai` serves Qwen3.5-2B (Q4_K_M GGUF) as the model `goal-digger`.
- **Vision.** A matching projection model (`QVAC_PROJECTION_MODEL_PATH`) lets the same model read photo proof and chat images.
- **Structured output.** Every model call uses `temperature: 0` and a strict JSON schema.
  - `/qvac/builder` turns the chat into a challenge draft. A **Create goal** button appears only when every field is confirmed.
  - `/qvac/review` checks text or photo proof against the challenge's success rule. It returns a verdict and a reason.
  - `/qvac/assess` reads the answer to a fresh math problem for the wake-up template. Code checks if the answer is correct.
- **Input safety.** The prompts treat rules, proof text, and image content as data, not instructions. The server rejects any model output that does not match the schema.
- **No money access.** Goaly returns only a verdict. It cannot publish a challenge, approve a payment, or move funds.

## WDK features

The vault wallet is a WDK RGB wallet: `@tetherto/wdk-wallet` 1.0.0-beta.8, `@utexo/wdk-wallet-rgb`, and `@utexo/rgb-lib-bare`. It runs on the Bare runtime (`wdk/check.mjs`).

- `receiveAsset` (witness) creates one invoice per stake.
- `refreshWallet` and `listTransfers` check deposits and payouts against the chain.
- `decodeRGBInvoice` checks the winner's invoice, and `transfer` signs and sends the share.
- `npm run prepare-native` patches the RGB binding so the wallet uses Mutinynet (CustomSignet).

Safety:

- The vault listens only on `127.0.0.1` and requires a bearer token.
- The vault writes each payout to a journal once (`flag: "wx"`). It never sends a payout again automatically.
- Settlement is checked again from WDK transfer history.
- The seed stays in `wdk/data/seed.txt` with `0600` permissions. Git ignores the `data/` folder.

## Install and run

Requirements: macOS, Node.js 24 or later, the QVAC CLI, an unlocked RGB Lightning Node on port 3001, and the KaleidoSwap extension in Chrome with a node-less RGB wallet on Mutinynet.

1. Download Qwen3.5-2B-Q4_K_M with QVAC. The config finds it in `~/.qvac/models`. For photo proof, also download its matching projection model.

2. Install dependencies:

   ```bash
   npm install --prefix api
   npm install --prefix frontend
   npm install --prefix wdk
   npm run prepare-native --prefix wdk
   ```

3. Start each service in its own terminal, from the repository root:

   ```bash
   QVAC_PROJECTION_MODEL_PATH=/path/to/mmproj.gguf qvac serve --openai --config qvac/qvac.config.mjs
   ```

   ```bash
   node qvac/server.mjs
   ```

   ```bash
   openssl rand -hex 24 > /tmp/goal-digger-vault-token
   chmod 600 /tmp/goal-digger-vault-token
   VAULT_API_TOKEN="$(cat /tmp/goal-digger-vault-token)" node vault/vault.mjs
   ```

   ```bash
   cd api && VAULT_API_TOKEN="$(cat /tmp/goal-digger-vault-token)" npm run dev
   ```

   ```bash
   cp frontend/.env.example frontend/.env
   cd frontend && API_TARGET=http://127.0.0.1:4002 QVAC_API_TARGET=http://127.0.0.1:4000 npm run dev -- --host 127.0.0.1
   ```

4. Check `http://127.0.0.1:4002/api/health/ready`. It must return HTTP 200 with `database`, `vault`, `qvac`, and `rgb` all `ok`.

5. Open `http://127.0.0.1:5173`.

If port 11434 is in use, add `--port 11435` to the QVAC command, and start the Goaly server with `QVAC_BASE_URL=http://127.0.0.1:11435`.

Before you share the app through a tunnel, set `PILOT_MODE=true` and a unique `PILOT_ACCESS_PASSWORD` in `frontend/.env`. See [docs/CLOSED-MUTINYNET-PILOT.md](docs/CLOSED-MUTINYNET-PILOT.md) for the full runbook, backups, and recovery.

### Tests

```bash
npm test --prefix api
npm run typecheck --prefix api
node --test tests/*.test.mjs
node --experimental-strip-types --test frontend/tests/*.test.ts
npm run typecheck --prefix frontend
```

## Built during the hackathon

Everything was built during the event, in dated commits:

- The web app: challenge board, Goaly challenge builder, challenge page, wallet, and rewards screens.
- The Challenge API: participant sessions, drafts, creator and opponent deposits, proofs, outcomes, betting snapshots, payout plans, and payout execution.
- The Goaly server: chat, challenge builder, proof review (text and photo), and timed math.
- The vault and the WDK RGB wallet integration on Mutinynet.

## Mocked, simulated, or hard-coded

- **Test assets only.** Every stake and payout uses test USDT on Mutinynet. The asset ID is hard-coded (`rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0`), and one stake is limited to 100 test USDT.
- **One custodial vault.** One WDK wallet holds every pool. It is not a non-custodial escrow.
- **Goaly runs on the demo machine.** In the product, Goaly and QVAC run on the goal creator's computer, so the proof stays there. For this demo, they run on the same machine as the API and the vault.
- **Proof authenticity.** The model reads the evidence. It cannot prove that a photo or a document is genuine.
- **Templates.** The web app creates custom challenges. The API also runs the wake-up template with timed math proof. The `exam` and `run` template names exist in the API, but they have no proof flow yet.
- **Access.** The pilot password gate protects only the Vite development server. It is not production hosting.

## Prior work

None. Everything in this repository was built during the hackathon: the environment setup, the code, the wallets, and the design. Nothing existed before the event.

## Next steps

- Mainnet USDT on RGB.
- Non-custodial escrow instead of our vault wallet.
- Stake any RGB asset that is already in KaleidoSwap, not only USDT.
- Proof integrations: Strava runs, exam results, and wake-up apps.
