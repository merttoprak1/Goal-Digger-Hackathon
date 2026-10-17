# Goal Digger handoff

Start with [the closed Mutinynet pilot runbook](CLOSED-MUTINYNET-PILOT.md). It covers the access gate, startup, readiness, two-wallet payment test, proof review, recovery, and database backup/restore. Use [HANDOFF-DEMO.md](HANDOFF-DEMO.md) for the participant flow.

## Components

| Folder | Contents |
|---|---|
| `frontend/` | React app, Goaly interface, KaleidoSwap payment prompts |
| `api/` | Challenge, session, proof-review, outcome, and payout API |
| `qvac/` | Local Goaly/QVAC assessment and RGB health service |
| `vault/` | Private WDK vault service and stake deposit adapter |
| `wdk/` | WDK wallet integration and local test wallet data |
| `tests/` | Root service and adapter tests |
| `api/tests/` | API and outcome tests |
| `frontend/tests/` | Frontend payment and API-client tests |
| `docs/` | Backend notes, operations, and pilot guides |

## Current pilot behavior

Participants save custom challenge drafts, pay creator stakes, and publish after the API confirms payment. Other participants can pay separate counter-stakes. Goaly reviews supported timed-math and custom written proof submissions. The API validates proof state and deadlines, calculates outcomes, and coordinates payout claims through the local vault.

Goaly does not approve wallet prompts, custody funds, select winners, or execute payouts. A custom proof source is descriptive; Goaly does not independently fetch or authenticate lottery sites, screenshots, fitness providers, or other external records. The app currently uses Mutinynet test assets only.

`/proofs` and `/ledger` are design placeholders. Proof submission, outcome, and payout actions are on the challenge page.

## Pilot boundaries

- The app must run behind the server-side Basic Auth gate before a tunnel is shared. The shared password is not user identity; each participant keeps a separate access key.
- A successful readiness check covers the API database, vault service/database, QVAC, and RGB node. It does not prove WDK can transfer, so run the two-wallet smoke test for every pilot session.
- If a timely custom proof is pending during a Goaly outage, finalization remains blocked. Restore Goaly and retry the exact saved evidence before proceeding.
- Keep vault credentials, participant keys, wallet seeds, and database backups out of Git and chat. Back up the API and vault databases as a pair, and protect WDK seed/RGB data separately.
- Use ordinary append-only commits. Do not stash, rebase, amend, reset, or force-push during the hackathon.

## Team

| Name | Work |
|---|---|
| Mert Toprak | QVAC, RGB node, WDK vault, integrated demo |
| Vesim Karadag | React interface |
| Ege Okyay | Challenge rules, SQLite, stakes, deadlines, settlement |
