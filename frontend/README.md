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

The UI follows the approved **“Goal Digger”** board from the design handoff and
covers five screens. Wallet and Payout have no board of their own — they are
built out of the same language, around the escrow and settlement flows the other
three screens depend on.

Shared visual language:

- **Surfaces:** `slate-50` page on white cards, hairline `slate-200` borders,
  `rounded-2xl` corners, soft `shadow-sm`.
- **Brand:** `indigo-600` primary, `violet-600` for arbiter and rollover states,
  `blue-700` for active, `emerald` for verified/synced states, `slate` for drafts.
- **Type:** Plus Jakarta Sans throughout, `font-mono` for all stake and pool
  numbers.
- **Icons:** Material Symbols Outlined (loaded with `display=block`, rendered
  through `app/components/icon.tsx`). The arena keeps its emoji labels.
- **Header:** one row — logo, centered nav pills (Challenges / Create Challenge /
  Wallet / Payouts / Profile), a Mutinynet status pill, and the placeholder
  profile avatar linking to `/profile`.
- **Chats:** the two arbiter transcripts (the arena panel and the create builder)
  are bounded, independently scrollable feeds (`.chat-feed`). They follow new
  messages only while you are already at the bottom, so scrolling up to re-read
  the earlier messages is never interrupted, and the page around them does not
  grow as the conversation does.

### `/challenges` — the arena

Centered hero, filter row, a 12-column grid with the challenge cards on the left
(`col-span-7`) and the Goaly arbiter panel on the right (`col-span-5`), then the
dark call-to-action strip.

The arbiter panel is interactive: the mascot reacts when clicked, the preset
chips and the card action buttons pre-fill the proposal form, and proposing a
contract appends your message and a simulated arbiter reply.

### `/challenges/new` — create custom challenge

A chat-driven DLC contract builder. Goaly sits on the left (`lg:col-span-5`) with
the greeting, quick-prompt chips and a natural-language input; the builder is on
the right (`lg:col-span-7`):

- **Step 1 — visibility & ruleset:** Public Arena (peer-to-peer counter-bets) or
  Solo Discipline.
- **Failure forfeit:** donate to a verified charity, burn the stake
  (`OP_RETURN`), or roll over to the next weekly goal vault.
- **Step 2 — stake vault & proof parameters:** stake amount with `1/5/10/25/MAX`
  shortcuts, the challenge horizon, and the proof source row.

A summary card totals the stake, XP and default outcome, then **Save Draft** or
**Lock Stake & Deploy DLC** posts to the API and returns to the arena.

### `/profile` — user profile

Hero with the placeholder avatar and a copy-address control, three stat cards
(win rate, total pool, streak), tabs for Active / Settled / Created, the stake
cards on the left (`lg:col-span-8`), and a right column (`lg:col-span-4`) with
the Goaly arbiter card and the wallet balance breakdown.

The hero’s **Deposit / Cashout** button links to `/wallet`.

### `/wallet` — balance, escrow and activity

A dark balance card carries the spendable USDT, the Mutinynet address with a copy
control, and **Deposit** / **Cashout** buttons that open a drawer underneath:
Deposit reveals the full funding address, Cashout shows the fee and destination
and explains why the button itself waits for the RGB rail.

Below it: three stat cards (available, locked in escrow, tBTC reserve), the escrow
breakdown — one row per funded DLC, each linking to its challenge — and the
activity ledger. The escrow side reads from `WALLET.lockedUsdt`, while the
spendable side *is* `WALLET_BALANCE`, so this screen and the profile balance card
can never disagree.

### `/payout` — settled pools

A dark hero shows the claimable total next to lifetime winnings and what is still
waiting on the arbiter, with a shortcut that claims the next settlement outright.
Three tabs (Claimable / Awaiting Arbiter / History) filter the list.

**Claim** posts to the API and moves the settlement into the wallet: the pool
leaves the queue, the claimable total counts down, a receipt appears with a link
to `/wallet`, and the ledger gains a `Payout claimed` row. That round trip is real
against the in-memory store, which is why a plain page reload still resets it.

### Avatars and mascot assets

User avatars (`app/components/avatar.tsx`) render a Facebook-style placeholder —
a person silhouette drawn as inline SVG on a grey disc — so the UI never shows a
broken or mismatched photo. The Goaly arbiter and the header brand mark still use
the mascot art.

`public/goaly.png` (standing arbiter) and `public/panda-avatar.png` (header logo)
were trimmed to their content bounding box so they fill their frames and blend
onto white panels via `mix-blend-multiply`.

## Project structure

```
app/
  app.css                 Tailwind entry, DaisyUI theme, mascot + bubble CSS
  root.tsx                HTML shell, header nav, footer, route transitions, error boundary
  routes.ts               Route table
  components/
    avatar.tsx            Facebook-style placeholder user avatar
    chat.tsx              Shared motion primitives for both arbiter chats
    icon.tsx              Material Symbols `Icon` wrapper
    coming-soon.tsx       Placeholder for screens still to be designed
  lib/
    contracts.ts          API types + zod schema for the create form
    api.ts                API client (mock-aware, throws typed ApiError)
    mock-store.ts         In-memory fake backend with seed data
    challenge-view.ts     Shared status/pool colour maps for challenge cards
    motion.ts             Shared easing curve for every transition
    tones.ts              Shared accent maps for tiles, badges, notes and actions
  routes/
    home.tsx              Redirects to /challenges (the design has no landing page)
    challenges.tsx        The challenge board + Goaly arbiter panel
    challenge.tsx         Challenge detail
    challenge-new.tsx     Create custom challenge (chat-driven builder)
    profile.tsx           User profile, stakes, arbiter and wallet
    wallet.tsx            Balance, escrow breakdown and activity ledger
    payout.tsx            Claimable settlements, arbiter queue and history
    proofs.tsx            My Proofs (placeholder)
    ledger.tsx            Pool Ledger (placeholder)
public/
  goaly.png               Arbiter mascot
  panda-avatar.png        Header brand mark
```

Path alias: `~/*` → `app/*` (via `vite-tsconfig-paths`).

The design's boards have no shared navigation, so the header adds centered nav
pills to the five screens plus a Mutinynet status pill. `/proofs` and `/ledger`
still exist but are not linked, since their boards are not built yet.

## Talking to the API

`app/lib/api.ts` is the only place that talks to the backend. It exposes
`fetchHealth`, `fetchChallengesSnapshot`, `fetchChallenges`, `fetchChallenge`,
`fetchProfileSnapshot`, `fetchWalletSnapshot`, `fetchPayoutSnapshot`,
`createChallenge` and `claimPayout`.

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

## Motion

Animation is [Motion](https://motion.dev) — the package is published as `motion`
and React components come from `motion/react` — plus plain CSS for everything
that does not need JavaScript.

**Motion handles:** route transitions (`root.tsx`), the header nav pill gliding
between tabs, the stake chips, profile tabs and payout tabs doing the same, the
deploy stage checklist that runs before the arena route changes, the counts in
`components/count-up.tsx` (profile stats, wallet balance, payout totals, and the
summary XP as the stake is edited), the arbiter panel flashing when a card
prefills it, chat bubbles easing in, the “Goaly is typing” bubble, the arena card
stagger with its hover lift, the profile and payout tab cross-fades, the spring
check badge on the selected visibility card, the deposit / cashout drawer
unfolding under the balance card, the tick swapping in on the copy controls, and
the mascot squash on poke.

**CSS handles:** hover colours, the mascot float/bob, status pings, the
`.chat-feed` scrollbar, and the `.skeleton-shimmer` sweep on the hydration
skeleton.

`MotionConfig reducedMotion="user"` wraps the app, so visitors who ask their
system for less motion get the same layout without the transforms — matching the
`prefers-reduced-motion` guard already on the CSS animations.

> Cost: Motion lands in its own ~46 kB gzip chunk, imported by the root route, so
> it loads on first paint. If that ever needs trimming, the route transition in
> `root.tsx` is the first thing to drop.

## Not built yet

- My Proofs / evidence submission and verdict display
- Pool Ledger
- Real counter-stake and settlement wiring (the arbiter panel and the proposal
  and create forms are UI-only today)
- Cashouts — the wallet’s Cashout drawer shows the fee and destination, but the
  button itself waits for the RGB escrow rail
- Persistence — mocks live in memory, so a reload resets everything, including
  claims made on `/payout`

## Known warnings

React Router 7 prints "Future Flag Warning" notices at build time pointing at
React Router v8 flags (`v8_middleware`, `v8_splitRouteModules`, etc.). They are
informational. Enabling them is optional and can change request/bundling
behavior, so they are left off for now.

## Git

Secrets and wallet data must stay out of Git. `.env` files are ignored; only
`.env.example` is tracked.
