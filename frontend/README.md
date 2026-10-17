# Goal Digger — Frontend

React Router v7 (framework mode, SPA) + Tailwind CSS v4 + DaisyUI 5 + TypeScript.

This app is the UI and UX layer. It owns the challenge forms, the evidence
screens, and the pool display. It talks to the API over HTTP.

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

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Start the dev server on port 5173                       |
| `npm run build`     | Production build into `build/client`                    |
| `npm run start`     | Serve the built SPA on port 4173 (`vite preview`)       |
| `npm run typecheck` | Generate route types, then run `tsc --noEmit`           |

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

## Project structure

```
app/
  app.css                 Tailwind entry + DaisyUI plugin + themes
  root.tsx                HTML shell, navbar, footer, error boundary, HydrateFallback
  routes.ts               Route table
  components/
    theme-toggle.tsx      Light/dark switch (persisted in localStorage)
  lib/
    contracts.ts          API types + zod schema for the create form
    api.ts                API client (mock-aware, throws typed ApiError)
    mock-store.ts         In-memory fake backend with seed data
  routes/
    home.tsx              Landing page
    challenges.tsx        Challenge list
    challenge.tsx         Challenge detail (fixed proof terms, timeline)
```

Path alias: `~/*` → `app/*` (via `vite-tsconfig-paths`).

## Talking to the API

`app/lib/api.ts` is the only place that talks to the backend. It exposes
`fetchHealth`, `fetchChallenges`, `fetchChallenge`, and `createChallenge`.

**Right now it runs against in-memory mocks** (`app/lib/mock-store.ts`), so the
UI works before the Express API exists. Reset the seed data from the browser
console with `__resetGoalDiggerMocks()`.

To switch to the real server:

```bash
cp .env.example .env
# set VITE_USE_MOCKS=false
npm run dev
```

| Variable             | Default | Meaning                                              |
| -------------------- | ------- | ---------------------------------------------------- |
| `VITE_USE_MOCKS`     | `true`  | `false` sends real HTTP requests                      |
| `VITE_API_BASE_URL`  | `/api`  | Base path for API requests                            |
| `API_TARGET`         | `http://127.0.0.1:4000` | Dev proxy target for `/api` (used by Vite) |

The dev proxy expects the Express API on port 4000, leaving port 3001 for the
RGB node.

> The mock data and the `contracts.ts` types mirror the shape the backend team
> agreed on, so switching to the real API should not require UI changes.

## Theming

Themes are configured in `app/app.css`:

```css
@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
}
```

Add more themes (any built-in DaisyUI theme name) to that list and select one by
setting `data-theme="name"` on `<html>`. `theme-toggle.tsx` shows how the current
theme is switched and persisted. `root.tsx` includes a small inline script that
applies the stored theme before first paint (hence `suppressHydrationWarning` on
the `<html>` element).

## Not built yet

- Challenge creation form (wire to `createChallenge`)
- Betting flow
- Evidence submission and verdict display
- Settlement / payout status

## Known warnings

React Router 7 prints "Future Flag Warning" notices at build time pointing at
React Router v8 flags (`v8_middleware`, `v8_splitRouteModules`, etc.). They are
informational. Enabling them is optional and can change request/bundling
behavior, so they are left off for now.

## Git

Secrets and wallet data must stay out of Git. `.env` files are ignored; only
`.env.example` is tracked.
