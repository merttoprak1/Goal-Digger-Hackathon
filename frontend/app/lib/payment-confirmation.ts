export async function waitForStake(options: {
  check: () => Promise<{ status: string }>;
  complete: () => Promise<void>;
  onStatus?: (status: string) => void;
  signal: AbortSignal;
  maxChecks?: number;
  pause?: () => Promise<void>;
}) {
  for (let attempt = 0; attempt < (options.maxChecks ?? 75); attempt++) {
    if (options.signal.aborted) return;
    const receipt = await options.check();
    if (options.signal.aborted) return;
    options.onStatus?.(receipt.status);
    if (receipt.status === "credited") {
      await options.complete();
      return;
    }
    if (!["awaiting_payment", "pending"].includes(receipt.status))
      throw Error("The payment needs review. Check its status before trying again.");
    if (options.pause) await options.pause();
    else await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        options.signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, 8000);
      options.signal.addEventListener("abort", done, { once: true });
    });
  }
  if (!options.signal.aborted)
    throw Error("Payment confirmation is taking longer than expected. Retry the status check. Do not send again.");
}

export function stakeProgress(status: string): string {
  if (status === "credited") return "Payment confirmed.";
  if (status === "awaiting_payment") return "The vault has not received the stake payment yet.";
  return "Waiting for payment confirmation on Mutinynet…";
}
