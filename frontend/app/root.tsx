import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import { AnimatePresence, MotionConfig, motion } from "motion/react";

import type { Route } from "./+types/root";
import { Avatar } from "~/components/avatar";
import { EASE } from "~/lib/motion";
import { PROTOCOL_STATUS } from "~/lib/mock-store";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block",
  },
];

const NAV = [
  { to: "/challenges", label: "Challenges" },
  { to: "/challenges/new", label: "Create Challenge" },
  { to: "/profile", label: "Profile" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/** Rendered at build time into `index.html` and shown while the SPA boots. */
export function HydrateFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50">
      <span className="loading loading-spinner loading-lg text-indigo-600" />
      <span className="sr-only">Loading Goal Digger…</span>
    </div>
  );
}

function NavLinks({ orientation }: { orientation: "row" | "scroll" }) {
  const { pathname } = useLocation();

  function isActive(to: string) {
    // `/challenges/new` owns its own tab, so it must not light up `/challenges`.
    if (to === "/challenges") {
      return (
        pathname === "/challenges" ||
        (pathname.startsWith("/challenges/") && pathname !== "/challenges/new")
      );
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  return (
    <nav
      aria-label="Primary"
      className={
        orientation === "row"
          ? "flex items-center gap-1"
          : "mt-3 flex items-center gap-1 overflow-x-auto pb-0.5"
      }
    >
      {NAV.map((item) => {
        const active = isActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={[
              "relative rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
              active
                ? "text-indigo-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
            ].join(" ")}
          >
            {/* One pill per nav instance, handed off via `layoutId`, so the
                highlight glides between tabs instead of cross-fading. */}
            {active ? (
              <motion.span
                layoutId={`nav-pill-${orientation}`}
                aria-hidden="true"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-full bg-indigo-100/80"
              />
            ) : null}
            <span className="relative z-10">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 px-6 py-3.5 backdrop-blur-md lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
          <Link
            to="/challenges"
            className="group flex items-center gap-3 transition"
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-indigo-100 bg-indigo-50/50 shadow-sm transition-transform duration-200 group-hover:scale-105">
              <img
                src="/panda-avatar.png"
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 transition-colors group-hover:text-indigo-600">
              Goal Digger
            </span>
          </Link>

          <div className="hidden md:block">
            <NavLinks orientation="row" />
          </div>

          <div className="flex items-center justify-end gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                Mutinynet
              </span>
            </div>
            <Link
              to="/profile"
              title="Your profile"
              className="relative block h-9 w-9 shrink-0 rounded-full ring-2 ring-indigo-200 ring-offset-1 transition hover:ring-indigo-400"
            >
              <Avatar label="Your profile" className="h-full w-full" />
              <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </Link>
          </div>
        </div>

        <div className="md:hidden">
          <NavLinks orientation="scroll" />
        </div>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs font-medium text-slate-500 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="text-sm text-indigo-600">●</span>
          <span className="font-bold text-slate-700">
            Mutinynet Block #{PROTOCOL_STATUS.blockHeight}
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-semibold text-slate-600">
            {PROTOCOL_STATUS.rgbStatus}
          </span>
        </div>
        <p className="text-center font-normal text-slate-500">
          {PROTOCOL_STATUS.team}
        </p>
        <div className="flex items-center gap-4 font-semibold text-slate-500">
          {PROTOCOL_STATUS.links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="transition hover:text-indigo-600"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const { pathname } = useLocation();

  return (
    <MotionConfig reducedMotion="user">
      <AppHeader />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="flex flex-1 flex-col"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      <AppFooter />
    </MotionConfig>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404 — Not found" : `Error ${error.status}`;
    details =
      error.status === 404
        ? "That route does not exist yet."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-8">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-extrabold tracking-tight text-red-900">
          {message}
        </h1>
        <p className="mt-1.5 text-sm text-red-800">{details}</p>
      </div>
    </main>
  );
}
