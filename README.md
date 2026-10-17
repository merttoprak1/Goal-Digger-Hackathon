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

## Already installed and working
No application code yet.

## Prior work
No application code yet. Only the environment setup above existed before the hackathon; all app code is written during the event in dated commits.
