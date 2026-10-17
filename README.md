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

See [TASKS.md](TASKS.md) for the next small integration steps. See [PLAN.md](PLAN.md) for the product rules and team split.

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

## Ask local QVAC

With `node server.mjs` running, send a short prompt:

```bash
curl http://127.0.0.1:4000/qvac/ask \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"What is 2 + 2? Reply with only the number."}'
```

Example response:

```json
{"answer":"4","model":"goal-digger"}
```

Send only the `prompt` field, containing 1–500 characters. The request body must not exceed 4 KB. Inference has a 30-second timeout.

| HTTP status | Meaning |
|---|---|
| 400 | Invalid JSON or prompt |
| 413 | Request body too large |
| 415 | Incorrect content type |
| 502 | QVAC rejected the request or returned an unusable response |
| 503 | Local QVAC is unavailable |
| 504 | QVAC timed out |

Errors return an `error` message. They never return a fabricated model answer. This endpoint generates text only and does not assess challenge evidence yet.

## Structured evidence assessment

Send text evidence for the fixed demo question: **What is 17 + 8?**

```bash
curl http://127.0.0.1:4000/qvac/assess \
  -H 'Content-Type: application/json' \
  -d '{"evidence":"My answer is 25."}'
```

Example response:

```json
{
  "rule": { "id": "wake-up-math-demo-v1", "question": "What is 17 + 8?" },
  "verdict": "accepted",
  "reason": "The submitted answer is correct."
}
```

| Evidence | Expected verdict |
|---|---|
| My answer is 25. | accepted |
| My answer is 24. | rejected |
| I am not sure. | unclear |
| Either 25 or 26. | unclear |

QVAC extracts a numeric answer through a JSON schema. The server checks the result against the fixed answer and the numbers in the submitted evidence.

Submit one numeric answer without the question or other numbers. Missing, conflicting, or unsupported answers produce `unclear`. Callers cannot submit a replacement rule or verdict.

Send only an `evidence` string with 1–500 characters. The endpoint uses the same size limit, inference timeout, and service-error statuses as `/qvac/ask`.

Invalid structured output returns HTTP 502. A service error never becomes a rejected answer or a lost challenge.

Acceptance means the numeric answer matches this demo question. It does not prove identity, wake-up time, document authenticity, or completion of a real challenge.

Ege's backend will own fresh questions, proof windows, retries, and final challenge outcomes. This endpoint cannot authorize a payment.

Run the assessment checks with:

```bash
node --test assessment.test.mjs
```

## Read RGB balances and assets

With the node unlocked and `node server.mjs` running, request the wallet snapshot:

```bash
curl http://127.0.0.1:4000/rgb/wallet
```

The endpoint returns:

| Field | Meaning |
|---|---|
| `network` | The network reported by the node |
| `balanceSource` | `cached`, because this request skips blockchain synchronization |
| `bitcoin` | Separate vanilla and colored bitcoin balances, in satoshis |
| `assets` | RGB asset identifiers, schemas, names, tickers, precision, and balances |

Each balance includes `settled`, `future`, and `spendable`. RGB balances also include `offchainOutbound` and `offchainInbound`.

All amounts are integer strings. RGB amounts use atomic units. For example, `100000000` with precision 6 represents 100 asset units.

Use the asset identifier and precision, rather than assuming that a ticker identifies an authentic asset. The demo uses test assets.

An empty asset list returns `assets: []`. Invalid or unavailable data produces an error rather than zero balances.

The endpoint returns HTTP 503 for an unavailable, locked, or inaccessible node. It returns 504 for a timeout and 502 for invalid upstream data.

Requests time out after 10 seconds. The endpoint never returns wallet keys or sends transactions.

Run the wallet checks with:

```bash
node --test rgb-wallet.test.mjs
```

Reference: [RGB Lightning Node API specification](https://github.com/RGB-Tools/rgb-lightning-node/blob/master/openapi.yaml).

## Payment integration contract

The [payment API contract](docs/PAYMENT-API.md) defines a transfer request and status lookup for Ege's future backend. These endpoints are not implemented yet.

## Test transfer status

The transfer of 1 test USDT to Ege is verified. The sender has 99 test USDT spendable, and Ege reported 101 test USDT settled and spendable. See [the transfer record](docs/RGB-TRANSFER.md).

## Prior work
No application code yet. Only the environment setup above existed before the hackathon; all app code is written during the event in dated commits.
