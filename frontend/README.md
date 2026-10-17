# Goal Digger — Frontend

React Router v7 (framework mode, SPA) + Tailwind CSS v4 + DaisyUI 5 + TypeScript.

This app is the UI and UX layer. It owns the challenge board, the arbiter panel,
the evidence screens, and the pool display. It talks to the API over HTTP.

> **Owner:** Vesim — React interface, challenge forms, evidence submission, pool display.

## Requirements

- Node.js 20+ (developed on Node 24)
- npm (workspaces are not used here; this folder is a standalone package)

## Getting started

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Scripts

| Script              | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start the dev server on port 5173                 |
| `npm run build`     | Production build into `build/client`              |
| `npm run start`     | Serve the built SPA on port 4173 (`vite preview`) |
| `npm run typecheck` | Generate route types, then run `tsc --noEmit`     |
| `npm test`          | Run frontend client and wallet tests               |

## SPA mode (important)

`react-router.config.ts` has `ssr: false`. The build pre-renders only the root
route into `index.html`; everything else renders in the browser.

Two consequences when writing routes:

1. **Use `clientLoader` / `clientAction`, not `loader` / `action`.** Regular
   loaders are rejected at build time in SPA mode. The root route is the only
   place a `loader` is allowed.
2. **Keep code SSR-safe.** The root route is server-rendered at build time, so no
   `window` / `document` access during render. Do browser-only work in
   `useEffect` or in `clientLoader`.

See [SPA Mode](https://reactrouter.com/how-to/spa) for details.

## Design

The UI follows the approved **“Goal Digger”** design across the challenge board,
challenge detail, create flow, profile, wallet, and payouts. Proofs and Ledger
remain placeholder routes.

Shared visual language:

- **Surfaces:** `slate-50` page on white cards, hairline `slate-200` borders,
  `rounded-2xl` corners, soft `shadow-sm`.
- **Brand:** `indigo-600` primary, `violet-600` for arbiter states,
  `blue-700` for active, `emerald` for verified/synced states, `slate` for drafts.
- **Type:** Plus Jakarta Sans throughout, `font-mono` for all stake and pool
  numbers.
- **Icons:** Material Symbols Outlined (loaded with `display=block`, rendered
  through `app/components/icon.tsx`). The arena keeps its emoji labels.
- **Header:** one row — logo, centered nav pills (Challenges / Create Challenge /
  Profile), a Mutinynet status pill, and the panda avatar linking to `/profile`.

### `/challenges` — the arena

Centered hero, filter row, a 12-column grid with the challenge cards on the left
(`col-span-7`) and the Goaly arbiter panel on the right (`col-span-5`), then the
dark call-to-action strip.

The arbiter panel sends the latest proposal to local QVAC and displays its
reply. Presets fill the proposal form. Proposals in this panel are not saved as
challenges and do not request a wallet payment; use the Create Challenge flow
to save and fund a challenge.

### `/challenges/new` — create custom challenge

A chat-driven DLC contract builder. Goaly sits on the left (`lg:col-span-5`) with
the greeting, quick-prompt chips and a natural-language input; the builder is on
the right (`lg:col-span-7`):

- **Step 1 — visibility & ruleset:** Public Arena (peer-to-peer counter-bets) or
  Solo Discipline.
- **Step 2 — stake vault & proof parameters:** stake amount with `1/5/10/25/MAX`
  shortcuts, the challenge horizon, and the proof oracle row.

A summary card totals the stake, XP and default outcome, then **Save Draft** or
**Lock Stake & Deploy DLC** posts to the API and returns to the arena.

### `/profile` — user profile

Hero with the avatar and a copy-address control, three stat cards (win rate,
total pool, streak), tabs for Active / Settled / Created, the stake cards on the
left (`lg:col-span-8`), and a right column (`lg:col-span-4`) with the Goaly
arbiter card and the wallet balance breakdown.

### Mascot assets

`public/goaly.png` (standing arbiter) and `public/panda-avatar.png` (header logo)
were trimmed to their content bounding box so they fill their frames and blend
onto white panels via `mix-blend-multiply`.

## Project structure

```
app/
  app.css                 Tailwind entry, DaisyUI theme, mascot + bubble CSS
  root.tsx                HTML shell, header nav, footer, error boundary, HydrateFallback
  routes.ts               Route table
  components/
    icon.tsx              Material Symbols `Icon` wrapper
    coming-soon.tsx       Placeholder for screens still to be designed
  lib/
    board.ts              Live challenge API client and draft validation
    wallet.ts             KaleidoSwap invoice approval and recovery safeguards
    payment-confirmation.ts Polls the API before publishing or joining
    goaly.ts              Local Goaly chat client
    payouts.ts            Participant access key and payout client
    pilot-access.ts       Server-only Basic Auth gate for the closed pilot
    challenge-view.ts     Shared status/pool colour maps for challenge cards
    contracts.ts          Shared challenge and profile display types
  routes/
    home.tsx              Redirects to /challenges (the design has no landing page)
    challenges.tsx        The challenge board + Goaly arbiter panel
    challenge.tsx         Challenge detail
    challenge-new.tsx     Create custom challenge (chat-driven builder)
    profile.tsx           User profile, stakes, arbiter and wallet
    proofs.tsx            My Proofs (placeholder)
    ledger.tsx            Pool Ledger (placeholder)
public/
  goaly.png               Arbiter mascot
  panda-avatar.png        Header logo and avatar
```

Path alias: `~/*` → `app/*` (via `vite-tsconfig-paths`).

The design's boards have no shared navigation, so the header adds centered nav
pills to the three screens plus a Mutinynet status pill. `/proofs` and `/ledger`
still exist but are not linked, since their boards are not built yet.

## Talking to the API

`app/lib/board.ts` calls the live Express API through `VITE_API_BASE_URL`, which
defaults to `/api`. The Vite development proxy sends `/api` to the API on port
4002. It sends `/qvac` to the Goaly service on port 4000. For the closed pilot,
set `API_TARGET=http://127.0.0.1:4002` and
`QVAC_API_TARGET=http://127.0.0.1:4000` when starting Vite.

The mock toggle described in older handoff notes is no longer used. Challenge,
stake, proof, outcome, and payout behavior goes through the API and local vault.
See [the closed Mutinynet pilot runbook](../docs/CLOSED-MUTINYNET-PILOT.md) for
service startup, readiness, two-wallet verification, and recovery steps.

For a closed pilot, create `.env` from `.env.example` and set server-only
`PILOT_MODE=true` plus a private `PILOT_ACCESS_PASSWORD`. These names must not
start with `VITE_`. Vite challenges every request with Basic Auth as user
`pilot`. This gate protects the development server only; production builds
require access control at the hosting layer and reject `PILOT_MODE=true`.

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base path for API requests |
| `API_TARGET` | `http://127.0.0.1:4002` | Dev proxy target for the challenge API |
| `QVAC_API_TARGET` | `http://127.0.0.1:4000` | Dev proxy target for Goaly/QVAC |
| `PILOT_MODE` | `false` | Enables the development-server Basic Auth gate |
| `PILOT_ACCESS_PASSWORD` | unset | Private password required when pilot mode is enabled |

## Theming

`app/app.css` defines a single custom DaisyUI theme, `goaldigger`, and disables
the built-in ones:

```css
@plugin "daisyui" {
  themes: false;
}

@plugin "daisyui/theme" {
  name: "goaldigger";
  default: true;
  /* slate surfaces, indigo primary, violet secondary … */
}
```

The design is light-only, so there is no theme toggle. The rest of the palette
(`slate`, `indigo`, `violet`, `blue`, `emerald`) comes straight from Tailwind's
defaults, which is why the markup reads like the design handoff.

`app/app.css` also holds the pieces the design ships as plain CSS: the
`.chat-bubble-tail-left` speech-bubble tail and the `.mascot-alive` /
`.mascot-talking` mascot animations (both disabled under
`prefers-reduced-motion`).

## Pilot limits

- `/proofs` and `/ledger` are design placeholders. Proof submission and outcome
  actions currently live on challenge detail pages.
- Current proof flows are timed math and custom written evidence. A custom proof
  source is descriptive text; the app does not browse or authenticate third-party
  websites, screenshots, or activity services.
- The pilot uses Mutinynet test assets only. It is not mainnet custody or
  production hosting.

## Known warnings

React Router 7 prints "Future Flag Warning" notices at build time pointing at
React Router v8 flags (`v8_middleware`, `v8_splitRouteModules`, etc.). They are
informational. Enabling them is optional and can change request/bundling
behavior, so they are left off for now.

## Git

Secrets and wallet data must stay out of Git. `.env` files are ignored; only
`.env.example` is tracked.
