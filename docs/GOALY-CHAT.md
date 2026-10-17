# Local Goaly chat

Goaly uses the local Qwen 3.5 model through QVAC. On the creation page, it can
fill the reviewable challenge draft from the conversation. The user must review
the fields and select Create challenge and deposit; KaleidoSwap still requires
explicit wallet approval. Goaly cannot create a challenge or pay the invoice on
its own.

## Start

Run each process in a separate terminal from the repository root:

```bash
qvac serve --openai --config qvac/qvac.config.mjs
node qvac/server.mjs
npm run dev --prefix frontend -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/challenges` or `/challenges/new` and send a proposed goal to Goaly.
The frontend proxies `/qvac` to the local integration service on port 4000.
Set `QVAC_API_TARGET` for the Vite server if that service uses another address.
This target is separate from Ege's challenge API target.

`POST /qvac/chat` accepts a recent `{ "messages": [{"role":"user|assistant","content":"..."}] }` history.
`POST /qvac/builder` accepts the same messages plus the current draft and returns a structured reply and proposed field values.
Both endpoints limit the JSON body to 4 KB. The browser sends up to six recent messages.
The model request uses the existing `goal-digger` alias, 256 output tokens, and a 30-second timeout.
QVAC uses the local Qwen3.5-2B GGUF configured in `qvac/qvac.config.mjs`.
The browser displays errors when QVAC is unavailable. It does not replace failures with a fabricated reply.

Goaly helps make success rules measurable and names possible proof methods. On the builder route, it can suggest title, rule, proof source, stake, deadline, and visibility values based on the conversation. The user reviews and edits these values before continuing.
It receives product rules in a system message, separate from the user's text.
It has no wallet tools, vault token, payout authority, or ability to accept evidence.
The backend must still enforce proof rules and payment authorization.
Model instructions guide replies but do not establish facts or guarantee correct advice.

The chat has no persistent history or streaming. Model output only prepares a draft; it never creates a challenge or initiates payment.
The earlier structured evidence assessment endpoint remains separate.

## Checks

```bash
node --test tests/*.test.mjs
node --test frontend/tests/*.test.ts
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

All 37 integration tests and 7 frontend helper tests passed.
Type checking and the production build passed.
A real request through `http://127.0.0.1:5173/qvac/chat` returned a local model reply about a timed wake-up check, timezone, and proof deadline.
No funds moved during this step.
