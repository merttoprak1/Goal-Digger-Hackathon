# Closed Mutinynet pilot

This runbook is for a small, invited testnet pilot on the demo Mac. Stakes and wallet transfers use Mutinynet test USDT and test BTC only. Do not use mainnet assets, real money, or production credentials. The Vite development server is not production hosting.

## Go/no-go checks

Start the pilot only when all of these checks pass:

- Set `PILOT_MODE=true` and a strong, unique `PILOT_ACCESS_PASSWORD` in `frontend/.env`. The password stays server-side. Vite prompts for Basic Auth; the username is `pilot`. A production build cannot use this gate and needs upstream access control.
- Open `http://127.0.0.1:4002/api/health/ready`. It must return HTTP 200 and `database`, `vault`, `qvac`, and `rgb` checks must each say `ok`. `GET /api/health` is only an API liveness check. Readiness confirms the vault service and its database respond; it does not prove WDK can transfer funds.
- Complete the two-wallet smoke test below with small testnet amounts. Verify both outgoing transfers in KaleidoSwap Activity and both credits in the app before using a larger test amount.
- Take a paired backup of the API and vault databases. Keep the WDK seed and complete CustomSignet data directory in a separate, encrypted, access-controlled backup. The seed alone cannot restore RGB allocations.
- Keep each participant's access key private. It restores that participant's session; display names do not recover sessions. The server stores only a token hash, and sessions expire after seven days.

Stop the pilot if readiness is degraded, an invoice amount or recipient differs from the agreed test, a wallet result is uncertain, or a payment cannot be reconciled. Do not approve the same wallet payment again until KaleidoSwap Activity and the saved invoice status have been checked.

## Start services

Run one process per terminal from the repository root. Keep the RGB node unlocked on port 3001.

1. Start the local model server:

   ```bash
   qvac serve --openai --config qvac/qvac.config.mjs
   ```

2. Start Goaly and the RGB health proxy:

   ```bash
   node qvac/server.mjs
   ```

   Check `http://127.0.0.1:4000/health`. Its `qvac` and `rgb` fields must both report `ok`.

3. Create the private vault token once, then start the vault with that token:

   ```bash
   openssl rand -hex 24 > /tmp/goal-digger-vault-token
   chmod 600 /tmp/goal-digger-vault-token
   VAULT_API_TOKEN="$(cat /tmp/goal-digger-vault-token)" node vault/vault.mjs
   ```

   Keep the token file private. Do not paste its contents into chat, the browser, or a committed file.

4. Start the API with the same token:

   ```bash
   cd api
   VAULT_API_TOKEN="$(cat /tmp/goal-digger-vault-token)" npm run dev
   ```

   The API listens on `127.0.0.1:4002` and stores challenge and deposit-credit records in `api/data/api.sqlite`.

5. Create `frontend/.env` from `.env.example`. Set `PILOT_MODE=true` and set `PILOT_ACCESS_PASSWORD` to a newly generated value from `openssl rand -hex 32`. Do not prefix either name with `VITE_`. The local env file is ignored by Git. Then start the frontend:

   ```bash
   cd frontend
   API_TARGET=http://127.0.0.1:4002 \
   QVAC_API_TARGET=http://127.0.0.1:4000 \
   npm run dev -- --host 127.0.0.1
   ```

   Confirm the readiness endpoint returns HTTP 200 before sharing access.

## Share the pilot

Only start the temporary tunnel after the password gate is enabled and readiness is green:

```bash
ssh -n -T -o ServerAliveInterval=30 -o StrictHostKeyChecking=accept-new \
  -R 80:localhost:5173 stable@proxy.tunnl.gg output=json
```

Share the resulting HTTPS URL and the Basic Auth password with invited testers through a separate trusted channel. The tunnel URL is public; the password gate controls the app. Everyone who knows the shared password can open the pilot, so the password does not replace each participant's private access key. If the browser does not show the `pilot` login prompt, stop and do not share the URL.

Keep the Mac awake. The tunnel may expire or stop after inactivity. Do not point a public domain at the Vite development server.

## Stop the pilot

Stop the tunnel first so no new participants can connect. Press `Ctrl+C` in the tunnel terminal, then stop Vite, the API, the vault, the Goaly/RGB health service, and the QVAC model server with `Ctrl+C` in each terminal. Keep the RGB node and wallet data available until all vault operations have stopped. Do not force-quit a service while an invoice or payout is being reconciled.

## Two-wallet smoke test

Use a creator wallet and a different opponent wallet. Agree on a small amount before either payment. The backend limit is 100 test USDT per stake.

1. Create a public challenge with a clear, measurable rule, a supported proof type, and a future deadline. The creator's participant session owns the draft.
2. On the challenge page, choose **Approve stake in wallet**. Check the asset, amount, recipient, and Bitcoin fee in KaleidoSwap before confirming.
3. Wait for the app to confirm the payment and publish the challenge. If the app reports a timeout or HTTP 520, choose **Check payment**. This checks the same saved invoice and retries publication; it does not send another payment. Confirm the outgoing transfer in KaleidoSwap Activity before any wallet retry.
4. From the second participant and wallet, open the published challenge, request an opponent invoice, confirm the matching amount in KaleidoSwap, then choose **Check bet payment**. Verify the second wallet's Activity and the confirmed pool in the challenge.
5. Submit the agreed proof before the deadline. Goaly reviews timed-math and custom written submissions; the API checks the proof method, deadline, and stored verdict before it can finalize an outcome. Goaly never approves a wallet payment, selects a winner, or moves funds.
6. After the deadline, verify the outcome and proportional prize shares. For a payout smoke test, use a separate testnet receive invoice and check the actual wallet Activity and payout status.

The current proof flows are timed math and custom written evidence. A custom statement is reviewed as text; Goaly does not browse or authenticate an official lottery site, a screenshot, a health record, or arbitrary third-party activity. A model verdict is not external verification.

## Payment and proof recovery

- `awaiting_payment` means the vault has not credited the invoice. `pending` means wait and check the same invoice. `credited` means the app may publish or join the pool. A tunnel error alone does not prove that a wallet payment failed.
- After a wallet confirmation or uncertain response, check KaleidoSwap Activity and use **Check payment** or **Check bet payment**. Never create a second wallet send to work around an API or tunnel error. The saved payment ID keeps invoice retries bound to the original amount and recipient.
- If Goaly is unavailable after timely custom evidence is submitted, the API stores a pending review and blocks outcome finalization. Restart Goaly/QVAC and retry the exact same statement. New or changed evidence is not accepted after the deadline. A pending review is not a success verdict.
- An accepted proof cannot be replaced. Rejected or unclear evidence does not succeed; clearer evidence can be submitted while the proof window remains open.
- Stop if the app shows a funding review, an unexpected asset/recipient, a conflicting transfer, or an unresolved payout. Preserve the invoice, challenge ID, wallet Activity entry, and transaction ID for operator reconciliation.

## Back up and restore

Pause new participant activity and reconcile open payments and payouts. Stop the tunnel, Vite, the API, and the vault before making the paired backup. `api/data/api.sqlite` contains participant, challenge, deposit-binding, and credit records. `wdk/data/vault.sqlite` contains vault invoices and transfer records.

```bash
PILOT_BACKUP_DIR="$HOME/goal-digger-backups"
PILOT_BACKUP_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$PILOT_BACKUP_DIR"
chmod 700 "$PILOT_BACKUP_DIR"
sqlite3 api/data/api.sqlite ".backup '$PILOT_BACKUP_DIR/api-$PILOT_BACKUP_STAMP.sqlite'"
sqlite3 wdk/data/vault.sqlite ".backup '$PILOT_BACKUP_DIR/vault-$PILOT_BACKUP_STAMP.sqlite'"
sqlite3 "$PILOT_BACKUP_DIR/api-$PILOT_BACKUP_STAMP.sqlite" "PRAGMA integrity_check;"
sqlite3 "$PILOT_BACKUP_DIR/vault-$PILOT_BACKUP_STAMP.sqlite" "PRAGMA integrity_check;"
```

Both integrity checks must print `ok`. Protect the backup directory and do not commit it. Back up the WDK seed and complete `wdk/data/custom-signet/` separately using encrypted storage. Never send wallet seeds or vault tokens to Goaly.

After the backup checks pass, restart the services and require readiness to return HTTP 200 before reopening the tunnel.

To restore, stop the API and vault first. Restore both database files from the same backup timestamp, keep the pre-restore files until verification is complete, then restart the services and require readiness to return HTTP 200. Reconcile every open invoice and recent wallet Activity entry before resuming the pilot. Restore wallet seed and RGB data only from their matching protected backup; a database restore alone does not restore wallet keys or allocations.

For a file-based restore, set the timestamp of the paired backup you want to recover, make copies of the current databases, then copy both backup files into place while the API and vault remain stopped:

```bash
PILOT_BACKUP_DIR="$HOME/goal-digger-backups"
PILOT_RESTORE_STAMP=20261018T120000Z
PILOT_RESTORE_ATTEMPT="$(date -u +%Y%m%dT%H%M%SZ)"
cp -p api/data/api.sqlite "api/data/api.sqlite.pre-restore-$PILOT_RESTORE_ATTEMPT"
cp -p wdk/data/vault.sqlite "wdk/data/vault.sqlite.pre-restore-$PILOT_RESTORE_ATTEMPT"
cp "$PILOT_BACKUP_DIR/api-$PILOT_RESTORE_STAMP.sqlite" api/data/api.sqlite
cp "$PILOT_BACKUP_DIR/vault-$PILOT_RESTORE_STAMP.sqlite" wdk/data/vault.sqlite
sqlite3 api/data/api.sqlite "PRAGMA integrity_check;"
sqlite3 wdk/data/vault.sqlite "PRAGMA integrity_check;"
```

Replace the example timestamp with the matching backup pair. Both integrity checks must print `ok` before services restart. If either check fails, restore the two pre-restore copies and investigate before restarting.

## Pilot verification

Run these checks from the repository root before each pilot session:

```bash
npm test --prefix api
npm run typecheck --prefix api
npm run lint --prefix api
node --test tests/*.test.mjs
node --experimental-strip-types --test frontend/tests/*.test.ts
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

The readiness endpoint and automated tests do not replace the two-wallet smoke test. Keep the test small, confirm both wallet transfers, confirm the challenge is published, submit proof, and verify the outcome/payout before inviting more participants.
