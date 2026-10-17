import { useEffect, useRef, useState } from "react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
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
];

/**
 * The one addition to the design: the header in the mockup has no navigation,
 * so the account chip doubles as the menu between screens.
 */
const ACCOUNT_LINKS = [
  { to: "/challenges", label: "Challenges" },
  { to: "/challenges/new", label: "Create Challenge" },
  { to: "/proofs", label: "My Proofs" },
  { to: "/ledger", label: "Pool Ledger" },
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

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm transition duration-200 hover:border-indigo-300 hover:bg-indigo-100"
      >
        <span className="text-xs font-bold tracking-tight">GD</span>
        <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {ACCOUNT_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              role="menuitem"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                [
                  "block rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 px-6 py-3.5 backdrop-blur-md transition-all lg:px-12">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link
          to="/challenges"
          className="group flex items-center gap-3 transition"
        >
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-indigo-100 bg-indigo-50/50 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <img
              src="/panda-avatar.png"
              alt="Goal Digger panda mascot"
              className="h-full w-full object-cover"
            />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900 transition-colors group-hover:text-indigo-600">
            Goal Digger
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-slate-200/60 bg-slate-100/80 px-3 py-1.5 text-xs font-semibold text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" />
            <span className="font-medium text-slate-700">
              Bitcoin Mutinynet
            </span>
          </div>
          <AccountMenu />
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
  return (
    <>
      <AppHeader />
      <Outlet />
      <AppFooter />
    </>
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
