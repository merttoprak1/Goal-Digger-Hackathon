# Run the demo

Run these processes on the demo Mac. RGB and QVAC stay on that Mac.

## Ports

| Port | Process |
|---|---|
| 3001 | RGB Lightning Node, already unlocked |
| 11434 | `qvac serve` |
| 4000 | `node qvac/server.mjs` |
| 4001 | `node vault/vault.mjs` |
| 4002 | Challenge API |
| 5173 | Frontend |

## Start

1. Start the model server from the repository root:

```bash
qvac serve --openai --config qvac/qvac.config.mjs
```

2. Start the health and Goaly server:

```bash
node qvac/server.mjs
```

Open http://127.0.0.1:4000/health. A healthy body has `"status": "ok"` for both `qvac` and `rgb`.

3. Create one vault token and start the vault with it:

```bash
openssl rand -hex 24 > /tmp/goal-digger-vault-token
chmod 600 /tmp/goal-digger-vault-token
VAULT_API_TOKEN="$(cat /tmp/goal-digger-vault-token)" node vault/vault.mjs
```

4. Start the API with the same token:

```bash
cd api
VAULT_API_TOKEN="$(cat /tmp/goal-digger-vault-token)" npm run dev
```

The API listens on http://127.0.0.1:4002. Its database is `api/data/api.sqlite`.

5. Start the frontend. Point Goaly at port 4000:

```bash
cd frontend
API_TARGET=http://127.0.0.1:4002 \
QVAC_API_TARGET=http://127.0.0.1:4000 \
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173/challenges.

## Share the screen

Colleagues on other computers cannot open `127.0.0.1`. From the repository root:

```bash
ssh -n -T -o ServerAliveInterval=30 -o StrictHostKeyChecking=accept-new \
  -R 80:localhost:5173 stable@proxy.tunnl.gg output=json
```

The command prints an `https://….tunnl.gg` URL. Vite accepts `*.tunnl.gg` hosts. Colleagues click through the warning page once.

The tunnel lasts up to 24 hours. It closes after 2 hours with no visitors. The same SSH key keeps the same URL. The Mac must stay awake.

The page reaches the API through the frontend. Colleagues do not call port 4002 directly.

Share the URL only with the team. Anyone with the URL can open the app.

## Checks

```bash
npm test --prefix api
npm run typecheck --prefix api
npm run lint --prefix api
node --test tests/*.test.mjs
node --experimental-strip-types --test frontend/tests/*.test.ts
npm run typecheck --prefix frontend
```

## Git

Work on `qvac-RGB`. Commit the files you changed. Do not add `.playwright-mcp/`.

```bash
git push origin qvac-RGB
```
