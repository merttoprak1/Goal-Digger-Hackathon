export interface WitnessSend {
  assetId: string;
  amount: number;
  recipientId: string;
  transportEndpoints: string[];
  feeRate: number;
  witness_data: { amount_sat: number; blinding?: number };
}

// The invoice-only provider call in the installed wallet omits witness data.
export function requestWitnessSend(
  params: WitnessSend,
  options: { page?: Window; timeoutMs?: number } = {},
): Promise<unknown> {
  const page = options.page ?? globalThis.window;
  if (!page?.location?.origin)
    return Promise.reject(Object.assign(Error("The KaleidoSwap bridge is unavailable."), { code: "METHOD_NOT_SUPPORTED" }));
  const origin = page.location.origin;
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      page.removeEventListener("message", onMessage);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(Object.assign(Error("KaleidoSwap did not return a payment result before the timeout. Check wallet Activity and the deposit status."), { code: "WALLET_TIMEOUT" }));
    }, options.timeoutMs ?? 135_000);
    function onMessage(event: MessageEvent) {
      if (event.source !== page || event.origin !== origin) return;
      const data = event.data;
      if (!data || typeof data !== "object" || data.application !== "KaleidoSwap" ||
          data.type !== "RGB_LIGHTNING_RESPONSE" || data.requestId !== requestId) return;
      cleanup();
      if (data.error) {
        const message = typeof data.error === "object" ? String(data.error.message ?? "The wallet rejected the payment.") : String(data.error);
        const code = typeof data.error.code === "string" ? data.error.code : "INTERNAL_ERROR";
        reject(Object.assign(Error(message), { code }));
      } else {
        resolve(data.payload);
      }
    }
    page.addEventListener("message", onMessage);
    try {
      page.postMessage({
        type: "RGB_LIGHTNING_REQUEST", application: "KaleidoSwap", requestId,
        payload: { type: "REQUEST_ASSET_SEND", params },
      }, origin);
    } catch (cause) {
      cleanup();
      reject(cause);
    }
  });
}
