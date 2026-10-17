# Goal Digger 💪 — Challenge yourself, on Bitcoin

**Team:** Bounty Hunters

| Name | GitHub | Responsibility |
|---|---|---|
| Mert Toprak | [@merttoprak1](https://github.com/merttoprak1) | Local QVAC, RGB node, integration endpoints, and the integrated demo |
| Vesim Karadag | [@Vesimspace](https://github.com/Vesimspace) | React interface, challenge forms, evidence submission, and pool display |
| Ege Okyay | [@Ege-Okyay](https://github.com/Ege-Okyay) | Challenge rules, SQLite, stake records, deadlines, and settlement logic |

QVAC and the RGB node run on Mert's laptop. The team integrates the frontend and backend there for the demo.

## Idea
Set a challenge and stake USDT on completing it. Other participants can bet against you. All confirmed stakes form one pool.

If you prove success before the deadline, you win the entire pool. Otherwise, opponents split the pool in proportion to their stakes.

Start with three templates: wake up on time, pass an exam, and complete a run. Custom challenges declare their own proof method and source.

Everyone sees the success rule, proof source, betting cutoff, and proof deadline before betting. These terms become fixed after the first opponent bets.

Unclear evidence allows another attempt before the deadline. No accepted proof by the deadline means the creator loses. Charity is optional.

QVAC assesses evidence locally against the declared rules. RGB handles the stakes and payouts on Bitcoin. The hackathon demo uses test assets on Mutinynet.

See [PLAN.md](PLAN.md) for the team split, challenge templates, implementation steps, and open decisions.

## Stack
- RGB Lightning Node + kaleido-cli
- QVAC (Qwen3.5 2B, Supertonic TTS)
- WDK (bonus)
- TypeScript, React + Vite, DaisyUI, Framer Motion, Express, SQLite

## Run locally

Use Node.js 24 or later.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open [Goal Digger](http://127.0.0.1:5173). The API uses port 4000. Port 3001 remains available for the RGB node.

Create a wake-up challenge and save it. Select a saved challenge to see its fixed proof terms and deadlines.

The app stores drafts in SQLite at `data/goal-digger.sqlite`. Saved drafts remain after a server restart.

## Current milestone

Challenge creation, retrieval, and proof-term display work. RGB, QVAC, betting, evidence submission, and payouts are not connected yet.

The stake is a planned amount. No money moves, and no confirmed balance appears. The server is local and has no authentication.

Only the wake-up template is implemented. Exam, run, and custom templates remain planned. DaisyUI, Framer Motion, WDK, and speech are not installed yet.

Read [the shared API contract](docs/API.md) before changing request or response fields.

| Owner | Starting point |
|---|---|
| Vesim | `client/` for the React interface |
| Ege | `server/` for Express and SQLite |
| Mert | Add QVAC and RGB adapters under `server/integrations/` |
| All three | `shared/contracts.ts` for shared types and validation |

## Checks

```bash
npm run build
npm test
```

The build checks TypeScript and produces the frontend bundle. Tests cover persistence, fixed proof terms, invalid requests, and API errors.

Use a normal commit and push for each completed step. Do not stash, rebase, or force push. Merge divergent histories.

## Prior work
No application code yet. Only the environment setup above existed before the hackathon; all app code is written during the event in dated commits.
