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

The UI follows the approved **“Goal Digger”** board from the design handoff:

- **Surfaces:** `slate-50` page on white cards, hairline `slate-200` borders,
  `rounded-2xl` corners, soft `shadow-sm`.
- **Brand:** `indigo-600` primary, `violet-600` for open pools, `blue-700` for
  active, `slate` for drafts.
- **Type:** Plus Jakarta Sans throughout, `font-mono` for all stake and pool
  numbers.
- **Layout:** centered hero, then a 12-column grid — challenge cards on the left
  (`col-span-7`), the Goaly arbiter panel on the right (`col-span-5`).

The arbiter panel is interactive: the mascot reacts when clicked, the preset
chips and the card action buttons pre-fill the proposal form, and proposing a
contract appends your message and a simulated arbiter reply.

### Mascot assets

`public/goaly.png` (standing arbiter) and `public/panda-avatar.png` (header logo)
were trimmed to their content bounding box so they fill their frames and blend
onto white panels via `mix-blend-multiply`.

## Project structure

```
app/
  app.css                 Tailwind entry, DaisyUI theme, mascot + bubble CSS
  root.tsx                HTML shell, header, footer, error boundary, HydrateFallback
  routes.ts               Route table
  components/
    coming-soon.tsx       Placeholder for screens still to be designed
  lib/
    contracts.ts          API types + zod schema for the create form
    api.ts                API client (mock-aware, throws typed ApiError)
    mock-store.ts         In-memory fake backend with seed data
    challenge-view.ts     Shared status/pool colour maps for challenge cards
  routes/
    home.tsx              Redirects to /challenges (the design has no landing page)
    challenges.tsx        The challenge board + Goaly arbiter panel
    challenge.tsx         Challenge detail
    challenge-new.tsx     Create challenge (placeholder)
    proofs.tsx            My Proofs (placeholder)
    ledger.tsx            Pool Ledger (placeholder)
public/
  goaly.png               Arbiter mascot
  panda-avatar.png        Header logo
```

Path alias: `~/*` → `app/*` (via `vite-tsconfig-paths`).

The design's header has no navigation, so the **GD account chip** in the header
opens a small menu linking to every screen. That menu is the one deliberate
addition to the mockup.

## Talking to the API

`app/lib/api.ts` is the only place that talks to the backend. It exposes
`fetchHealth`, `fetchChallengesSnapshot`, `fetchChallenges`, `fetchChallenge`,
and `createChallenge`.

**Right now it runs against in-memory mocks** (`app/lib/mock-store.ts`), so the
UI works before the Express API exists. Reset the seed data from the browser
console with `__resetGoalDiggerMocks()`.

To switch to the real server:

```bash
cp .env.example .env
# set VITE_USE_MOCKS=false
npm run dev
```

| Variable            | Default                 | Meaning                                    |
| ------------------- | ----------------------- | ------------------------------------------ |
| `VITE_USE_MOCKS`    | `true`                  | `false` sends real HTTP requests           |
| `VITE_API_BASE_URL` | `/api`                  | Base path for API requests                 |
| `API_TARGET`        | `http://127.0.0.1:4000` | Dev proxy target for `/api` (used by Vite) |

The dev proxy expects the Express API on port 4000, leaving port 3001 for the
RGB node.

> `contracts.ts` mirrors the shape the backend team agreed on for the fields the
> board renders (status, stake, pool, proof source, action). Server-owned extras
> can be added alongside them without touching the UI.

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

## Not built yet

- Create challenge form (the `+ Custom Challenge` card links to a placeholder)
- My Proofs / evidence submission and verdict display
- Pool Ledger
- Real counter-stake and settlement wiring (the proposal form is UI-only today)

## Known warnings

React Router 7 prints "Future Flag Warning" notices at build time pointing at
React Router v8 flags (`v8_middleware`, `v8_splitRouteModules`, etc.). They are
informational. Enabling them is optional and can change request/bundling
behavior, so they are left off for now.

## Git

Secrets and wallet data must stay out of Git. `.env` files are ignored; only
`.env.example` is tracked.
