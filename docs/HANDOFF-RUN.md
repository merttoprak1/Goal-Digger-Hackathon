# Run the closed Mutinynet pilot

Follow [CLOSED-MUTINYNET-PILOT.md](CLOSED-MUTINYNET-PILOT.md) for access setup, service startup, the two-wallet smoke test, payment/proof recovery, backup, and restore. Do not share a tunnel URL until the Vite Basic Auth gate is enabled and API readiness is green.

## Service ports

| Port | Service |
|---|---|
| 3001 | RGB Lightning Node, unlocked |
| 11434 | QVAC model server |
| 4000 | Goaly/QVAC and RGB health service |
| 4001 | Private WDK vault |
| 4002 | Challenge API |
| 5173 | Vite frontend behind the pilot password gate |

Start QVAC and its health service:

```bash
qvac serve --openai --config qvac/qvac.config.mjs
node qvac/server.mjs
```

If port 11434 is already in use, add `--port 11435` to the QVAC command and
set `QVAC_BASE_URL=http://127.0.0.1:11435` on the Goaly server command.

Create the vault token once and use the same private value for the vault and API terminals:

```bash
openssl rand -hex 24 > /tmp/goal-digger-vault-token
chmod 600 /tmp/goal-digger-vault-token
```

```bash
VAULT_API_TOKEN="$(cat /tmp/goal-digger-vault-token)" node vault/vault.mjs
```

```bash
cd api
VAULT_API_TOKEN="$(cat /tmp/goal-digger-vault-token)" npm run dev
```

Create `frontend/.env` from `.env.example`; set `PILOT_MODE=true` and a unique `PILOT_ACCESS_PASSWORD`. Start Vite with the API and QVAC targets:

```bash
cd frontend
API_TARGET=http://127.0.0.1:4002 \
QVAC_API_TARGET=http://127.0.0.1:4000 \
npm run dev -- --host 127.0.0.1
```

Check `http://127.0.0.1:4002/api/health/ready`. HTTP 200 with `database`, `vault`, `qvac`, and `rgb` all `ok` is required before a pilot session. The root `GET /api/health` is liveness only.

## Checks

```bash
npm test --prefix api
npm run typecheck --prefix api
npm run lint --prefix api
node --test tests/*.test.mjs
node --experimental-strip-types --test frontend/tests/*.test.ts
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

`PILOT_MODE` protects only the Vite development server. The production build rejects that setting and requires an upstream access-control layer. The pilot uses Mutinynet test funds only.
