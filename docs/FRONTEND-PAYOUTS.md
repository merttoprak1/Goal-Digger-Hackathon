# Frontend winner payouts

Open `/payouts` from the main navigation.
This screen uses the live challenge API. The challenge board uses the same participant session.
The development proxy sends `/api` requests to localhost port 4002.
The QVAC proxy stays on port 4000.

## Winner flow

1. Restore the participant session that created the challenge or placed the stake.
2. Select a completed challenge.
3. Select **Check my payout** if no payout plan exists yet.
4. Create a fresh receive invoice in the Mutinynet RGB wallet for the exact displayed test USDT amount.
5. Paste the invoice and select **Save receive invoice**.
6. Select **Claim USDT** to execute the saved payout.

The screen shows the exact amount with up to six decimal places.
It includes the returned stake.
Only an explicit claim click starts execution.
Loading a page or refreshing a record does not send funds.
The backend checks the participant and allocation before it prepares or executes a payout.
A participant without a winning allocation sees a message instead of a claim form.

The invoice stays fixed after the backend binds it.
An uncertain preparation can recover with **Recover saved request**.
An uncertain execution offers **Retry payout request**, which uses the same saved payout ID.
The vault prevents a second send for an uncertain attempt.
Accepted transfers show the transaction ID and state that settlement is not confirmed yet.
The screen does not claim that an accepted transfer settled.

## Participant sessions

The browser saves only the participant token under `goal-digger-participant-token`.
On refresh, the screen checks that token with `/api/me`.
It then reads the current server records.
A winner can copy their access key to restore the same participant elsewhere.
Disconnect clears the local token and payout view. It does not revoke the server session.
The key is a Goal Digger session token, not a wallet seed phrase.

A new demo participant gets a new identity.
Reusing a display name does not recover another identity or its stakes.
The challenge board reads the same participant session and the live challenge list.
A draft saved there is a real challenge record. It does not create a stake or a claim.

## Local setup

Run the API on port 4002 and the frontend on port 5173.
The API needs its private `VAULT_API_TOKEN` to prepare and execute real test payouts.
Never put that token in a `VITE_` variable.
Use `API_TARGET` to override the development proxy when needed.
Production hosting must route `/api` to the challenge backend.

## Checks

The frontend helper tests cover authenticated requests, exact write bodies, uncertain responses, invalid receipts, service errors, and session storage.
The frontend type check and production build pass.
Browser checks used a separate API on port 4012 with a temporary database and simulated vault operations.
They covered session restore, exact payout display, invoice saving, claiming, and recovery after refresh.
No live funds moved during these checks.
