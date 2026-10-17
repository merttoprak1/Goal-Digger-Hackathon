# Run a two-wallet challenge demo

Use one shared pilot app and two separate participants and KaleidoSwap wallets. The app and both wallets must be on Mutinynet. Follow [the closed-pilot runbook](CLOSED-MUTINYNET-PILOT.md) to start the services, enable the password gate, verify readiness, and recover from payment or proof-review errors.

## Access and wallets

Open the invited pilot URL and authenticate as `pilot` with the shared pilot password. Each person then creates a participant and keeps their own access key private. A display name cannot restore a lost key; the server session expires after seven days.

The Wallet screen reads the connected KaleidoSwap Mutinynet wallet. It does not create a wallet or send funds. Each person pays only their own invoice from their own wallet.

## Create and fund a challenge

1. Choose **Create Challenge** and enter a title, measurable success rule, proof source, test USDT stake, and deadline.
2. Choose Public Arena for opponent bets or Solo to refuse them.
3. Create the challenge. The app saves a draft, requests the creator invoice, and opens the wallet approval.
4. Before confirming in KaleidoSwap, check the test asset, amount, recipient, and Bitcoin fee. The challenge becomes visible only after the vault confirms the creator payment and the API publishes it.
5. The app checks and publishes automatically after confirmation. If a timeout or HTTP 520 interrupts the response, use **Check payment**. It checks the saved invoice and can retry publication; it does not send another wallet payment.

If the result is uncertain, check KaleidoSwap Activity and the invoice status before any other action. Never approve a second send to clear a browser or tunnel error.

## Bet from the second wallet

1. The opponent signs in with their own participant key and opens the public challenge.
2. Enter the opponent's amount. `1` is 1 test USDT; the per-stake limit is 100 test USDT.
3. Request the invoice, confirm its amount and recipient in the second KaleidoSwap wallet, then use **Check bet payment**.
4. Confirm the outgoing Activity entry and the updated confirmed pool before continuing.

The creator cannot bet against their own challenge. Solo challenges do not accept opponent stakes. A late or conflicting deposit is held for review and does not enter the eligible pool automatically.

## Submit proof and settle

Submit the proof before the deadline. Current supported proof flows are timed math and custom written evidence. Goaly reviews the submission; the API verifies the challenge, proof method, deadline, and stored verdict, then controls outcome finalization. Goaly cannot approve a wallet transaction, choose a winner, or move funds.

For custom challenges, the proof source is descriptive context. Goaly reviews written text; it does not browse or authenticate an official lottery site, screenshots, fitness services, or other external records. Do not use an externally verifiable claim as if the app checks that external source.

If QVAC is unavailable after a timely custom submission, the API keeps that same proof pending and blocks failure finalization. Restart Goaly/QVAC and retry the exact same evidence. New or changed evidence remains closed after the deadline. An unclear or rejected verdict is not success.

After the deadline, a participant can settle the outcome. The creator receives the pool only after eligible proof is accepted. Otherwise, opponents share it in proportion to their confirmed stakes. A winner can submit a WDK receive invoice to claim a share; verify the payout status and actual wallet Activity.

## Current screens

| Screen | Behavior |
|---|---|
| Challenges | Published challenges and the signed-in participant's drafts |
| Create Challenge | Goaly-assisted custom challenge builder and creator stake payment |
| Challenge | Terms, creator payment, opponent stake, proof review, outcome, and payout |
| Payouts | Participant access key and winner claims |
| Profile | Signed-in participant's challenges and summary |
| Wallet | Reads the connected Mutinynet test USDT balance |
| Proofs, Ledger | Placeholder screens |

All stakes in this pilot are testnet assets. A successful demo is not evidence that mainnet custody, identity, external proof verification, or production deployment is ready.
