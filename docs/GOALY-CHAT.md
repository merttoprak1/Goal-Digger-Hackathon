# Local Goaly chat

Both Goaly chat panels now request replies from the local Qwen 3.5 model through QVAC.
The challenge board and creation form use the same endpoint.
Challenge records still use mocks. The Goaly client does not use mock replies.

## Start

Run each process in a separate terminal from the repository root:

```bash
qvac serve --openai --config qvac.config.mjs
node server.mjs
npm run dev --prefix frontend -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/challenges` or `/challenges/new` and send a proposed goal to Goaly.
The frontend proxies `/qvac` to the local integration service on port 4000.
Set `QVAC_API_TARGET` for the Vite server if that service uses another address.
This target is separate from Ege's challenge API target.

`POST /qvac/chat` accepts only `{ "prompt": "your challenge" }`.
The prompt limit is 500 characters and the JSON body limit is 4 KB.
The model request uses the existing `goal-digger` alias, 128 output tokens, and a 30-second timeout.
QVAC uses the local Qwen3.5-2B GGUF configured in `qvac.config.mjs`.
The browser displays errors when QVAC is unavailable. It does not replace failures with a fabricated reply.

Goaly suggests measurable goals, deadlines, timezones, and proof methods.
It receives product rules in a system message, separate from the user's text.
It has no wallet tools, vault token, payout authority, or ability to accept evidence.
The backend must still enforce proof rules and payment authorization.
Model instructions guide replies but do not establish facts or guarantee correct advice.

This small step sends the latest user message only. Earlier messages remain visible in the page but are not sent as conversation history.
There is no persistent chat history, streaming, or automatic challenge creation from model output.
The earlier structured evidence assessment endpoint remains separate.

## Checks

```bash
node --test *.test.mjs
node --test frontend/app/lib/*.test.ts
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

All 37 integration tests and 7 frontend helper tests passed.
Type checking and the production build passed.
A real request through `http://127.0.0.1:5173/qvac/chat` returned a local model reply about a timed wake-up check, timezone, and proof deadline.
No funds moved during this step.
