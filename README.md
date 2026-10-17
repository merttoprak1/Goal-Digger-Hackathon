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

## Local QVAC: first integration step

Use the installed QVAC CLI and Node.js 24 or later. The config finds the downloaded Qwen3.5 2B model in `~/.qvac/models`.

1. Start the local model server from the repository root:

```bash
qvac serve --openai --config qvac.config.mjs
```

2. In another terminal, test the model from the same folder:

```bash
node scripts/check-qvac.mjs
```

The check asks the model to calculate 2 + 2. It succeeds only when the answer is 4.

For another model location, set `QVAC_MODEL_PATH` to the GGUF file before starting QVAC. The server uses localhost port 11434.

This is a text inference check. Image evidence, challenge verification, payments, and the integrated demo remain future steps.

The earlier app skeleton was removed. There is no frontend or npm project on this branch yet.

Use a normal commit and push for each completed step. Do not stash, rebase, or force push. Merge divergent histories.

Reference: [QVAC HTTP server](https://docs.qvac.tether.io/cli/http-server/).

## Local RGB: second integration step

After the node is running and unlocked, run this read-only check:

```bash
node scripts/check-rgb.mjs
```

It reads node and network information from localhost port 3001. It displays the network, block height, channel count, and peer count.

The check does not display wallet keys or move funds. A successful connection does not establish that a payment or asset transfer works.

Reference: [RGB Lightning Node API](https://github.com/RGB-Tools/rgb-lightning-node#use).

## Local health endpoint: third integration step

Start the endpoint in another terminal:

```bash
node server.mjs
```

Open [the health endpoint](http://127.0.0.1:4000/health). A healthy response looks like this:

```json
{
  "status": "ok",
  "qvac": { "status": "ok" },
  "rgb": { "status": "ok" }
}
```

The endpoint checks both services on each request, with a three-second timeout per service. It returns HTTP 200 when both checks pass.

If either check fails, it returns HTTP 503 with `status: degraded` and each service's result. An upstream HTTP error includes its status code.

QVAC passes when its server lists the `goal-digger` model. This checks configuration and connectivity, not inference or whether the model is loaded.

RGB passes when the unlocked node returns its information. The endpoint never returns wallet details or moves funds.

The server uses localhost port 4000 and requires no npm dependencies.

## Prior work
No application code yet. Only the environment setup above existed before the hackathon; all app code is written during the event in dated commits.
