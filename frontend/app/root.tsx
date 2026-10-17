import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { ThemeToggle } from "~/components/theme-toggle";
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
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

/** Applied before first paint so the stored theme does not flash. */
const THEME_INIT_SCRIPT = `(function(){try{var k="goal-digger-theme";var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-base-100 text-base-content">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/challenges", label: "Challenges", end: false },
];

/**
 * Rendered at build time into `index.html` and shown while the SPA boots.
 * See https://reactrouter.com/how-to/spa
 */
export function HydrateFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" />
      <span className="sr-only">Loading Goal Digger…</span>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-base-300 bg-base-100/90 backdrop-blur">
        <div className="navbar mx-auto w-full max-w-5xl px-4">
          <div className="navbar-start">
            <NavLink to="/" className="text-lg font-bold tracking-tight">
              Goal Digger <span aria-hidden>💪</span>
            </NavLink>
          </div>
          <div className="navbar-center hidden gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `btn btn-ghost btn-sm ${isActive ? "btn-active" : ""}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="navbar-end gap-1">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-base-300 py-6 text-center text-sm opacity-70">
        Team Bounty Hunters · RGB + QVAC on Bitcoin (Mutinynet test assets)
      </footer>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16">
      <div className="alert alert-error items-start">
        <div>
          <h1 className="text-xl font-bold">{message}</h1>
          <p className="mt-1">{details}</p>
        </div>
      </div>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto rounded-box bg-base-300 p-4 text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
