# Challenge board

Open `/challenges`. The page reads the live challenge API on port 4002.
The amber demo banner is gone. Profile lists the signed-in participant's live challenges.

## What the board shows

A participant session is required. The page uses the same access key as Payouts, stored as `goal-digger-participant-token`.
Create a participant or restore a key on this page. Disconnect clears only the saved key. It does not revoke the server session.

The list is the newest 100 records from `GET /api/challenges`.
That list contains the signed-in participant's drafts and every published challenge.
Each card shows the creator display name, the creator stake, and the eligible pool.
A zero eligible pool is shown as a dash. The card does not start a deposit or a payout.

Open a card to read the saved terms, both pool figures, and the three deadlines.
An unknown or private draft returns the challenge-not-found state.
A missing session asks you to sign in on the board.

## Custom draft

`/challenges/new` saves one custom draft for the current participant.
The request uses template `custom` and proof method `custom`.
The stake is converted to atomic test USDT, with a limit of 100.
The proof deadline is the selected horizon. The start is one hour earlier. Betting closes one minute before the start.
Visibility, charity, and forfeit choices on that form are not stored.
Saving a draft does not move funds.

## Checks

The board helper tests cover amount mapping, the authenticated list request, invalid records, and draft deadlines.
API tests confirm a published challenge lists the creator display name.
