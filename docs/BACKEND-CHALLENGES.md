# Backend step 2: challenge drafts

The challenge API saves private drafts owned by an authenticated participant.
The creator comes from the session token, not a field supplied by the browser.
This step does not create an invoice, accept a stake, or open betting.

## Create

`POST /api/challenges` requires `Authorization: Bearer <participant token>` and JSON with these exact fields:

```json
{
  "template": "wake_up",
  "title": "Respond at 7 AM",
  "successRule": "Solve a fresh math problem within the declared time window",
  "proofMethod": "timed_math",
  "proofSource": "Server-recorded answer and submission time",
  "timezone": "Europe/Rome",
  "bettingCutoff": "2026-10-18T06:50:00+02:00",
  "startsAt": "2026-10-18T07:00:00+02:00",
  "proofDeadline": "2026-10-18T07:05:00+02:00",
  "creatorStakeAtomic": "1000000"
}
```

Use future dates when trying this example.
The betting cutoff must be in the future and strictly before the start.
The proof deadline must be strictly after the start.
Timestamps require an explicit UTC marker or offset. The timezone must be a valid timezone name.
The timestamp offset defines the instant. The timezone is the agreed display zone.

| Template | Required proof method |
|---|---|
| `wake_up` | `timed_math` |
| `exam` | `official_result` |
| `run` | `activity_record` |
| `custom` | `custom` |

Proof methods are declared terms only. Verification is not implemented in this step.
The title accepts 3 to 120 characters. The success rule accepts 3 to 1,000 characters.
The proof source accepts 3 to 500 characters. The JSON body limit remains 4 KB.
The planned creator stake is a positive integer string in atomic units, at most 100 test USDT.
One test USDT equals `1000000` atomic units.
Fields such as creator ID, status, and confirmed pool are server-owned and rejected in the request.

HTTP 201 returns `{ "challenge": { ... } }` with the saved terms, a generated ID, creator ID, creation time, `status: "draft"`, and `confirmedPoolAtomic: "0"`.
Invalid terms return HTTP 400. Missing or invalid sessions return HTTP 401.
Creating a draft does not prove that its planned stake was paid.
Repeated POST requests create separate drafts. There is no payment side effect.

## Read

`GET /api/challenges` lists only the current participant's drafts.
It supports `limit` from 1 to 100 and `offset` from 0 to 1,000,000.
Defaults are 50 and 0. Results are ordered by creation time and ID, newest first.
Invalid query parameters return HTTP 400.

`GET /api/challenges/<id>` returns the saved draft for its creator.
Unknown drafts and drafts owned by another participant return HTTP 404.
There is no public challenge list, edit, publish, or delete endpoint yet.
Saved rows persist in `api/data/api.sqlite` after restart.
The frontend remains on its mock challenge contract until its forms can supply all required terms.

## Checks and next step

All 11 API tests passed, including four template methods, private ownership, invalid terms, amount precision, persistence, and list limits.
Type checking, lint, and the production build passed.
The next small step is a creator deposit invoice attached to this draft, followed by one confirmed stake credit.
Betting must remain closed until funding and eligibility checks exist.
