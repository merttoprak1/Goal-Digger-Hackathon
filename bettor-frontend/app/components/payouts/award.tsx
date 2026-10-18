import { useCallback, useEffect, useRef, useState } from "react";
import type { PayoutChallenge, PayoutPlan, PayoutClaim, PayoutExecution } from "~/lib/payouts";
import { formatAtomic, TEST_USDT_ASSET } from "~/lib/wallet";
import { PayoutError } from "~/lib/payouts";
import { button, client, input, message, type Session } from "./shared";

export function Award({
  challenge,
  session,
  onExpired,
}: {
  challenge: PayoutChallenge;
  session: Session;
  onExpired: () => void;
}) {
  const [plan, setPlan] = useState<PayoutPlan | null>(null);
  const [claim, setClaim] = useState<PayoutClaim | null>(null);
  const [execution, setExecution] = useState<PayoutExecution | null>(null);
  const [invoice, setInvoice] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const alive = useRef(true);
  const { id } = challenge;
  const { token } = session;
  const refresh = useCallback(async () => {
    const [p, c, e] = await Promise.all([
      client.plan(id, token),
      client.claim(id, token),
      client.execution(id, token),
    ]);
    if (alive.current) {
      setPlan(p.plan);
      setClaim(c.claim);
      setExecution(e.execution);
      if (c.claim) setInvoice(c.claim.invoice);
    }
  }, [id, token]);
  useEffect(() => {
    alive.current = true;
    refresh()
      .catch((e) => {
        if (alive.current) {
          setError(message(e));
          if (e instanceof PayoutError && e.status === 401) onExpired();
        }
      })
      .finally(() => {
        if (alive.current) setBusy(false);
      });
    return () => {
      alive.current = false;
    };
  }, [refresh, onExpired]);
  async function run(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (e) {
      if (e instanceof PayoutError && e.status === 401) onExpired();
      else {
        try {
          await refresh();
        } catch {
          /* Preserve the action error. */
        }
        if (alive.current) setError(message(e));
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const allocation = plan?.allocations.find(
    (a) => a.participantId === session.participant.id,
  );
  const amount = allocation ? formatAtomic(allocation.amountAtomic, 6) : null;
  const fundingReview = challenge.status === "funding_review";
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-busy={busy}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
        Completed challenge
      </p>
      <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{challenge.title}</h2>
      <p className="mt-2 text-sm text-slate-500">
        {challenge.outcome?.status === "success"
          ? "The creator succeeded."
          : "The creator did not prove success."}
      </p>
      {fundingReview && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          These funds need review before a payout can proceed.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </p>
      )}
      {!plan && !busy && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-slate-600">
            Check the saved result to calculate your payout.
          </p>
          <button
            className={button}
            disabled={busy}
            onClick={() => run(() => client.calculate(id, token))}
          >
            Check my payout
          </button>
        </div>
      )}
      {plan && !allocation && (
        <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          This participant has no winning allocation for this challenge.
        </p>
      )}
      {amount && (
        <>
          <div className="my-6 rounded-xl bg-indigo-50 p-5">
            <p className="text-sm font-semibold text-indigo-600">Your payout</p>
            <p className="mt-1 font-mono text-3xl font-bold text-indigo-950">
              {amount} <span className="text-base">test USDT</span>
            </p>
            <p className="mt-2 text-xs text-indigo-700">
              Includes your returned stake. Fixed from the confirmed betting pool.
            </p>
          </div>
          {execution?.status === "accepted" ? (
            <div
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"
              role="status"
            >
              <h3 className="font-bold text-emerald-900">Payout sent</h3>
              <p className="mt-2 text-sm text-emerald-800">
                The vault accepted the transfer. Settlement is not confirmed yet.
              </p>
              <p className="mt-3 text-xs font-semibold text-emerald-900">
                Transaction ID
              </p>
              <code className="mt-1 block break-all text-xs text-emerald-900">
                {execution.txid}
              </code>
              <p className="mt-3 text-sm text-emerald-800">
                Check your wallet after confirmation.
              </p>
            </div>
          ) : (
            <>
              <ol className="mb-5 list-inside list-decimal space-y-2 text-sm text-slate-600">
                <li>
                  In your Mutinynet RGB wallet, create a receive invoice for exactly{" "}
                  <strong>{amount} test USDT</strong>.
                </li>
                <li>Paste the invoice below and save it.</li>
                <li>Select Claim payout to receive your funds.</li>
              </ol>
              <details className="mb-4 text-xs text-slate-500">
                <summary className="cursor-pointer font-semibold">
                  Test USDT asset ID
                </summary>
                <code className="mt-2 block break-all">{TEST_USDT_ASSET}</code>
              </details>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => client.prepare(id, token, claim?.invoice ?? invoice.trim()));
                }}
              >
                <label
                  htmlFor="receive-invoice"
                  className="text-sm font-semibold text-slate-700"
                >
                  RGB receive invoice
                </label>
                <textarea
                  id="receive-invoice"
                  className={`${input} mt-2 min-h-28 font-mono`}
                  value={invoice}
                  maxLength={3000}
                  readOnly={!!claim}
                  disabled={busy}
                  onChange={(e) => setInvoice(e.target.value)}
                  placeholder="rgb:…"
                  required
                  aria-describedby="invoice-help"
                />
                <p id="invoice-help" className="mt-2 text-xs text-slate-500">
                  {claim
                    ? "This invoice is fixed to your payout."
                    : "Use a fresh invoice for this payout. Saving it does not send funds."}
                </p>
                {!claim?.payout && (
                  <button
                    type="submit"
                    className={`${button} mt-4`}
                    disabled={
                      busy ||
                      fundingReview ||
                      !(claim?.invoice ?? invoice.trim()).startsWith("rgb:")
                    }
                  >
                    {claim ? "Recover saved request" : "Save receive invoice"}
                  </button>
                )}
              </form>
              {claim?.payout && (
                <div className="mt-5">
                  <p className="mb-3 text-sm text-slate-600">
                    {execution?.status === "unknown"
                      ? "The transfer result is uncertain. Retry this same request to recover its status. The vault protects against duplicate sends."
                      : "Your invoice is ready. Claiming sends the saved payout to this invoice."}
                  </p>
                  <button
                    className={button}
                    disabled={busy || fundingReview}
                    onClick={() =>
                      run(async () => {
                        const result = await client.execute(id, token);
                        if (alive.current) setExecution(result.execution);
                      })
                    }
                  >
                    {execution?.status === "unknown"
                      ? "Retry payout request"
                      : `Claim ${amount} USDT`}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      <div className="mt-6 flex items-center gap-4">
        <button
          className="text-sm font-semibold text-indigo-600 disabled:opacity-50"
          disabled={busy}
          onClick={() => run(refresh)}
        >
          Refresh saved payout
        </button>
        {busy && (
          <span role="status" className="text-sm text-slate-500">
            Please wait…
          </span>
        )}
      </div>
    </section>
  );
}
