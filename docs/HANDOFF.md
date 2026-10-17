# Handoff

Start here. The demo branch is `qvac-RGB`.

The last commit on GitHub is `358e1ed`. The working tree has newer demo work that is not committed. Leave `.playwright-mcp/` out of any commit.

Read [HANDOFF-RUN.md](HANDOFF-RUN.md) to start the app. Read [HANDOFF-DEMO.md](HANDOFF-DEMO.md) to run the challenge with other people.

## Team

| Name | Work |
|---|---|
| Mert Toprak | QVAC, RGB node, WDK vault, and the integrated demo |
| Vesim Karadag | React screens |
| Ege Okyay | Challenge rules, SQLite, stakes, deadlines, and settlement |

## Where the code lives

| Folder | Contents |
|---|---|
| `frontend/` | React app |
| `api/` | Challenge API and SQLite |
| `qvac/` | Local model server, Goaly, and the RGB read client |
| `vault/` | WDK vault, stake deposits, and payout transfer |
| `wdk/` | Wallet kit check |
| `tests/` | Root script tests |
| `frontend/tests/` | Frontend helper tests |
| `api/tests/` | API tests |
| `docs/` | Step notes and this handoff |

## What the demo does

A participant sets a goal, a proof source, a stake, and a proof deadline. The creator pays that stake with a WDK invoice. After the payment is confirmed, the challenge is public.

Other signed-in participants can bet against a Public Arena challenge. Each bettor pays a separate WDK invoice.

If the creator saves a proof statement before the deadline, the creator receives the pool. If the creator does not, the opponents share the pool in proportion to their stakes. Each winner claims a share with a WDK receive invoice.

Solo challenges can be seen after publication. They refuse opponent stakes.

## What is still open

The Proofs and Ledger screens are placeholders. Profile shows only the signed-in participant's own challenges.

Goaly plans a challenge. Goaly does not judge proof and does not move funds.

Charity and forfeit choices are saved with the challenge. They do not send funds.

A custom proof is a written statement. It is not a camera feed or a health record.

The wake-up template still uses the timed math proof on the API. The create screen saves custom challenges.

The early sections of `README.md` describe the first QVAC and RGB checks. Use this handoff for the current app.

Use a normal commit and push for each step. Do not stash, rebase, or force push.
