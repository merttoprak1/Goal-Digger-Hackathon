# Stake deposit adapter

This backend module binds a payment ID to one challenge, participant, and amount.
It checks the private WDK vault and saves one stake credit after an exact settled deposit.
It does not create challenges, decide eligibility, enforce betting deadlines, or pay winners.

Ege's `feat/backend` branch contained only documents when this adapter was added.
The adapter is ready for that backend to import. No challenge API is connected yet.

## Use from the backend

Start the [private vault server](VAULT-API.md) separately on localhost port 4001.
Keep its token on the backend. Use Node.js 24 or later.

```js
import { openStakeDeposits } from './stake-deposits.mjs';

const deposits = openStakeDeposits({
  databasePath: './data/stakes.sqlite',
  token: process.env.VAULT_API_TOKEN
});

const invoice = await deposits.bind({
  paymentId: 'challenge-1-creator',
  challengeId: 'challenge-1',
  participantId: 'mert',
  amountAtomic: '1000000'
});

// Return invoice.invoice to this participant through the backend.
const result = await deposits.confirm('challenge-1-creator');
const credits = deposits.listCredits('challenge-1');
// Close during backend shutdown, after pending calls finish.
deposits.close();
```

Before calling `bind`, the backend must check the participant, challenge rules, betting cutoff, and expected stake amount.
Supply the binding from trusted backend records, not directly from an untrusted client body.
The backend must also apply its deadline policy before accepting a credit through `confirm`.
This adapter does not establish when a transfer first confirmed relative to a challenge deadline.

## Saved records

The binding is immutable for each payment ID. A changed participant, challenge, or amount produces an error.
The binding is saved before the invoice request. The vault handles retries with that same payment ID.
A saved invoice returns directly on repeated binding calls.

Confirmation checks the payment ID, asset, amount, invoice, recipient, settlement status, and transaction ID.
Pending or uncertain deposits return their status with `newlyCredited: false` and `credit: null`.
Invalid responses and service errors throw an error without creating a credit.
A settled deposit returns `status: credited`, its saved `credit`, and whether this call created the credit.

SQLite saves the credit atomically. Each payment ID can have one credit.
The combination of asset ID, transaction ID, and recipient ID also has a unique constraint.
That constraint prevents another payment ID from crediting the same incoming transfer receipt.
Different recipients in a single Bitcoin transaction can still represent separate deposits.

Use `listCredits(challengeId)` as the authoritative list of confirmed contributions.
Sum its atomic amount strings with `BigInt` to calculate the confirmed pool.
Do not increment a separate pool total solely from `newlyCredited`: a crash between two databases could lose that update.
If the backend maintains another balance table, integrate both changes in one database transaction or use a durable event handoff.

Repeated confirmation of an existing credit returns that saved credit, including after a restart.
It does not recheck chain state or reverse an earlier credit automatically.
Keep the database and its journal files. Keep the vault and wallet backups separately, as described in the vault guide.

## Checks

```bash
node --test stake-deposits.test.mjs vault.test.mjs assessment.test.mjs rgb-wallet.test.mjs
```

The tests cover concurrent confirmation, restart recovery, immutable bindings, incorrect deposit fields, service failures, and reused transfer receipts.
The live check bound the existing unpaid WDK invoice through the real private vault.
It reported `awaiting_payment` and created zero credits. Its stake database was temporary.
No funds moved during this adapter check.

The next integration step is for Ege's challenge backend to call this adapter under its own eligibility and deadline rules.
