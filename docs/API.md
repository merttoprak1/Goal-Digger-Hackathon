# Shared API contract

Status: first milestone. Challenge creation and retrieval work. Betting, evidence checks, and payments are future work.

## Local development

The React app uses port 5173. The Express API uses port 4000, leaving port 3001 for the RGB node.

The Vite development server proxies `/api` to Express. Both servers bind to localhost. This version has no accounts or authentication.

Use Node.js 24 or later. The server uses built-in SQLite. The default database path is `data/goal-digger.sqlite`, which Git ignores.

## Ownership

| Owner | Files | Responsibility |
|---|---|---|
| Vesim | `client/` | Forms, challenge details, evidence screens, and payment status |
| Ege | `server/` | Challenge storage, betting rules, deadlines, and settlement |
| Mert | Future `server/integrations/` | QVAC and RGB adapters on Mert's laptop |
| All three | `shared/contracts.ts` | Agree on changes before changing a shared field |

The shared TypeScript file defines the implemented request and response types. It also defines the runtime request schema.

## Implemented endpoints

| Method | Path | Result |
|---|---|---|
| GET | `/api/health` | API availability and integration state |
| POST | `/api/challenges` | Create an unfunded wake-up challenge draft |
| GET | `/api/challenges` | Return the latest 100 drafts, newest first |
| GET | `/api/challenges/:id` | Return one saved draft |

### Create a draft

Send `Content-Type: application/json` with this body. Replace the sample dates with future dates before trying it.

```json
{
  "template": "wake_up",
  "creatorName": "Mert",
  "title": "I will wake up at 07:00",
  "requestedStakeUsdt": "5",
  "timezone": "Europe/Rome",
  "bettingClosesAt": "2030-01-02T06:00:00+01:00",
  "startsAt": "2030-01-02T07:00:00+01:00",
  "proofDeadline": "2030-01-02T07:05:00+01:00"
}
```

The response is HTTP 201 with a `Location` header and a `challenge` object containing the request fields and these additions:

```json
{
  "id": "server-generated UUID",
  "status": "draft",
  "createdAt": "server-generated UTC timestamp",
  "termsEditable": false,
  "proof": {
    "method": "timed_math",
    "source": "A fresh problem and server-recorded answer and submission time.",
    "successRule": "Submit the correct answer during the proof window.",
    "retryRule": "Unclear evidence allows another attempt before the proof deadline.",
    "failureRule": "No accepted proof by the deadline means the creator loses."
  },
  "funding": {
    "status": "not_connected",
    "network": "mutinynet",
    "confirmedPoolUsdt": null
  }
}
```

The API defines proof terms. Clients cannot submit their own status, verdict, or funding fields. Saved drafts cannot be edited in this milestone.

The detail response is `{ "challenge": ... }`. The list response is `{ "challenges": [...] }`.

### Validation

- Only `wake_up` is implemented. The other templates follow in a later step.
- A creator name contains 1–80 characters. A title contains 3–120 characters after whitespace trimming.
- `requestedStakeUsdt` is a positive decimal string with at most six digits before and six digits after the decimal point.
- This amount expresses intent only. It does not establish asset precision, funding, or a balance.
- Dates require a UTC suffix or explicit offset. The timezone must be a valid IANA identifier.

The betting cutoff must be in the future and no later than the challenge start. The proof deadline must follow the start.

Before accepting funds, replace planned amounts with integer atomic units and the actual RGB asset identifier and precision. Never calculate payouts with floating-point numbers.

### Errors

Errors use this envelope:

```json
{
  "error": {
    "code": "INVALID_CHALLENGE",
    "message": "Check the challenge details.",
    "fields": {
      "proofDeadline": ["The proof deadline must follow the start time."]
    }
  }
}
```

Validation errors return 400. Malformed JSON returns 400. Bodies over 16 KB return 413. Missing resources and unsupported endpoints return 404.

Unexpected failures return 500 without internal details. The optional `fields` map uses request field names.

### Health

```json
{
  "status": "ok",
  "integrations": {
    "rgb": "not_connected",
    "qvac": "not_connected"
  }
}
```

This response describes the app integrations. It does not probe whether an external node or model is running.

## Next API steps: proposed, not implemented

| Action | Proposed path | Important rule |
|---|---|---|
| Fund creator stake | `POST /api/challenges/:id/funding` | Activate only after receipt confirmation |
| Bet against creator | `POST /api/challenges/:id/bets` | Reject late bets and bets from the creator |
| Submit evidence | `POST /api/challenges/:id/evidence` | Accept retries only within the proof window |
| Read evidence result | `GET /api/challenges/:id/evidence/:evidenceId` | Distinguish accepted, rejected, unclear, and service error |
| Read payouts | `GET /api/challenges/:id/settlement` | Distinguish pending, confirmed, and failed transfers |

Before implementing these routes, agree on participant identity, custody, asset precision, idempotency, and service-failure behavior.

Proposed records:

- Bet: challenge ID, participant ID, atomic amount, payment ID, and confirmation status.
- Evidence: challenge ID, local evidence reference, submission timestamp, verdict, and reason.
- Payment: asset ID, atomic amount, sender, recipient, transfer ID, and status.
- Settlement: challenge ID, outcome, payout records, and completion status.

Never accept a client-supplied verdict or payment confirmation. A draft never accepts bets or moves money.

Success pays the creator the entire confirmed pool. Failure splits that pool among opponents according to their confirmed stakes.

A lack of accepted proof by the agreed deadline means failure. An inference service error is a separate technical condition whose handling remains undecided.

Do not implement real stakes until the team resolves custody, empty pools, service outages, and exact payout rounding.

## Proof implementation

The wake-up task establishes a timely response, rather than proving a full sleep routine. Generate fresh problems on the server and check answers and timestamps there.

QVAC must perform a meaningful local assessment. One candidate is extracting a handwritten answer before the server checks it. Its model support remains untested.

Camera capture, math generation, evidence checks, and automatic deadline settlement are not implemented in this milestone.

## Technical references

- [Vite guide](https://vite.dev/guide/)
- [Express API](https://expressjs.com/en/5x/api/application/)
- [Node.js SQLite](https://nodejs.org/api/sqlite.html)
