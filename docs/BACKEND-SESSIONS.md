# Backend step 1: participant sessions

Ege's Express foundation is merged from `feat/backend` commit `c303fd0` into `qvac-RGB`.
The API now creates persistent demo participants and private bearer sessions.
This is the first backend step. Challenge records, stakes, evidence, and outcome authorization remain separate work.

## Run

Use Node.js 24 or later from the repository root:

```bash
npm ci --prefix api
npm run build --prefix api
npm start --prefix api
```

The API listens only on `127.0.0.1:4002` by default.
Port 4000 remains the local QVAC integration service. Port 4001 remains the private WDK vault.
Set `PORT` or `DATABASE_PATH` in the API process environment when needed.
The database defaults to `api/data/api.sqlite`, in development and in the compiled build.
Its directory is private and Git ignores it.

## Create a demo participant

`POST /api/sessions` accepts only this JSON body:

```json
{ "displayName": "Mert" }
```

The name must contain 1 to 60 characters after trimming. Control characters are rejected.
The response returns HTTP 201 with `participant`, `token`, and `expiresAt`.
The participant contains a server-generated ID, display name, and creation time.
Save the token privately. Subsequent requests use `Authorization: Bearer <token>`.
Do not send it to the model or put it in a URL.
The server stores only a SHA-256 token hash. The session expires after seven days.

`GET /api/me` returns the participant for a valid session.
`DELETE /api/sessions/current` revokes the supplied session and returns HTTP 204.
Missing, incorrect, expired, or revoked tokens return HTTP 401.
These responses use `Cache-Control: no-store`.
Invalid registration fields return HTTP 400. JSON bodies above 4 KB return HTTP 413.

Creating another session with the same display name creates a different participant.
A name is not a login credential and cannot retrieve another person's identity.
There is no session recovery or renewal endpoint in this step.
The frontend is not connected to these sessions yet.

## Demo boundary

This local registration flow does not prove wallet ownership or a person's real identity.
Anyone with a participant's bearer token can act as that participant until expiry or revocation.
Do not expose this demo API publicly or treat a display name as payout authorization.
Public deployment requires secure login, wallet ownership checks, and abuse controls.
The later challenge routes must derive participant IDs from sessions, not accept them from untrusted request fields.
The vault token remains a separate backend secret.

## Checks and remaining steps

```bash
npm test --prefix api
npm run typecheck --prefix api
npm run lint --prefix api
npm run build --prefix api
```

All six API tests passed. They cover token access, invalid input, request limits, duplicate names, persistence, hashed storage, revocation, and expiry.
Type checking, lint, and the production build also passed.
The next small step is persistent challenge drafts owned by the authenticated participant, with explicit proof terms and deadlines.
Then connect confirmed stakes, timed evidence, final outcomes, exact payout calculation, and the frontend in separate checked commits.
