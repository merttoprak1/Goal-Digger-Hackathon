import { useEffect, useState } from "react";
import { createWalletSession, readWallet } from "~/lib/wallet";
export function meta() {
  return [{ title: "Wallet · Goal Digger" }];
}
export default function Wallet() {
  const [wallet, setWallet] = useState<Awaited<ReturnType<typeof readWallet>> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let started = false;
    let timer: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    const session = createWalletSession(window.localStorage);
    if (!session.remembered()) return;
    setBusy(true);
    const restore = () => {
      if (started || !window.rgb) return;
      started = true;
      clearInterval(timer);
      clearTimeout(timeout);
      session
        .restore(window.rgb)
        .then((value) => {
          if (active) setWallet(value);
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : "Reconnect the wallet in the extension.",
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    };
    timer = setInterval(restore, 100);
    timeout = setTimeout(() => {
      clearInterval(timer);
      if (active && !started) {
        setBusy(false);
        setError("The extension is unavailable. Enable it, then connect again.");
      }
    }, 5000);
    restore();
    return () => {
      active = false;
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, []);
  async function connect() {
    setBusy(true);
    setError("");
    setWallet(null);
    try {
      setWallet(await createWalletSession(window.localStorage).connect(window.rgb));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The wallet request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-slate-50 p-6 shadow-sm sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-[11px] font-bold tracking-wide text-indigo-700 uppercase">
              <span className={`h-1.5 w-1.5 rounded-full ${wallet ? "bg-emerald-500" : "bg-slate-300"}`} />
              KaleidoSwap · RGB L1
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Your wallet</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Read the selected KaleidoSwap wallet and its available test USDT. This page does not send funds.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={connect}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Waiting for wallet…" : wallet ? "Refresh wallet" : "Connect wallet"}
            </button>
            {wallet ? (
              <button
                type="button"
                onClick={() => {
                  createWalletSession(window.localStorage).forget();
                  setWallet(null);
                  setError("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Available test USDT</p>
          <p aria-live="polite" className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900">
            {wallet ? wallet.usdt ?? "Asset not present" : "—"}
            {wallet?.usdt ? <span className="ml-2 text-base font-bold text-slate-400">USDT</span> : null}
          </p>
          <p className="mt-3 text-sm text-slate-500">Balance reported by the currently selected wallet.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Network</p>
          <p className="mt-2 text-xl font-extrabold text-slate-900">{wallet?.network ?? "Not connected"}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{wallet?.protocol ?? "Connect KaleidoSwap to read network details."}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-bold text-slate-900">Before a test payment</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Select Mutinynet in KaleidoSwap. Review the asset, amount, and recipient in the wallet confirmation window before you approve any payment.
        </p>
        {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        {wallet ? (
          wallet.network === "signet" ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">The wallet reports Signet, which KaleidoSwap uses for Mutinynet.</p>
          ) : (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This wallet does not report Signet. Check its network before making a test payment.</p>
          )
        ) : null}
      </section>
    </main>
  );
}
