# Demo the challenge

Use one shared app. Each person has a participant and a separate wallet.

## Participant and wallet

On Challenges, choose New participant and type a name. Open Payouts and copy the access key. That key is the login. Keep it private. A new name does not recover an old key.

The Wallet screen reads a KaleidoSwap wallet on Mutinynet. It does not create a wallet and it does not send funds. Each person pays invoices from their own wallet.

## Create a challenge

1. Open Create Challenge.
2. Type the title, the success rule, and the proof source.
3. Choose Public Arena when other people should bet. Solo lets people see the challenge and refuses their stakes.
4. Set the proof deadline. It must be at least 2 hours ahead. Betting closes one hour and one minute before that time.
5. Choose Create challenge and deposit.

The challenge page shows an RGB invoice for the creator stake. Pay it from the creator's KaleidoSwap wallet. Choose Check payment.

The server publishes the challenge after that stake is confirmed. Other people can then see it on Challenges, even before they create a participant.

A challenge with no confirmed creator stake stays private.

## Bet against it

A colleague creates a participant and opens the public challenge. They enter an amount and choose Bet against. `1` is 1 test USDT. The limit is 100 test USDT.

They pay the new invoice from their own wallet and choose Check bet payment. The creator cannot bet against their own challenge.

## Prize shares

The challenge page shows two outcomes:

- The creator proved the goal. The creator receives the whole pool.
- The creator missed the goal. Opponents share the pool in proportion to their stakes.

The creator can save a proof statement before the deadline. After the deadline, a signed-in participant chooses Settle prize.

Each winner pastes a WDK receive invoice and chooses Claim share with WDK. WDK pays that share from the operator vault.

## Screens

| Screen | Behavior |
|---|---|
| Challenges | Published challenges, plus your own drafts when you are signed in |
| Create Challenge | Sends a custom challenge and opens the deposit invoice |
| Challenge | Stake invoice, bets, deadline, prize shares, and WDK claim |
| Payouts | Same participant key, and winner claims for settled challenges |
| Profile | Your own challenges |
| Wallet | Reads the KaleidoSwap test USDT balance |
| Proofs, Ledger | Placeholder screens |

Goaly can help write the plan. The saved challenge uses the fields on the form. Goaly does not move funds.
