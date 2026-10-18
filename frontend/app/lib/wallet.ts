import { requestWitnessSend } from "./kaleido-witness.ts";

export const TEST_USDT_ASSET = "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0";
export interface RgbProvider {
  enable(): Promise<unknown>;
  getInfo(): Promise<{ ready: boolean; network: string; protocol: string; methods?: string[] }>;
  listAssets(): Promise<unknown>;
  sendAsset?(args: { invoice: string }): Promise<unknown>;
  decodeRgbInvoice?(invoice: string): Promise<{
    assetId?: unknown;
    amount?: unknown;
    recipientId?: unknown;
    transportEndpoints?: unknown;
  }>;
  createUtxos?(args?: { num?: number; size?: number }): Promise<unknown>;
  getBtcBalance?(): Promise<{ freeColorableUtxos?: number | null }>;
  witnessReceive?(args: {
    assetId: string;
    amount: number;
    durationSeconds?: number;
    minConfirmations?: number;
  }): Promise<{ invoice?: string }>;
}
declare global {
  interface Window {
    rgb?: RgbProvider;
  }
}
export function formatAtomic(value: unknown, precision: number): string {
  if (
    (typeof value !== "string" || !/^\d+$/.test(value)) &&
    (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
  )
    throw Error("The wallet returned an invalid balance.");
  const digits = BigInt(value as string | number)
    .toString()
    .padStart(precision + 1, "0");
  const fraction = digits.slice(-precision).replace(/0+$/, "");
  return precision
    ? digits.slice(0, -precision) + (fraction ? "." + fraction : "")
    : digits;
}
export async function createShareInvoice(
  provider: RgbProvider | undefined,
  amountAtomic: string,
) {
  if (!provider?.witnessReceive)
    throw Error("Install or enable KaleidoSwap, then reload this page.");
  if (!/^[1-9]\d*$/.test(amountAtomic) || !Number.isSafeInteger(Number(amountAtomic)))
    throw Error("The prize share amount is invalid.");
  await provider.enable();
  const info = await provider.getInfo();
  if (!info.ready) throw Error("Unlock and connect the RGB wallet in the extension.");
  const received = await provider.witnessReceive({
    assetId: TEST_USDT_ASSET,
    amount: Number(amountAtomic),
    durationSeconds: 3600,
    minConfirmations: 1,
  });
  if (!received?.invoice?.startsWith("rgb:"))
    throw Error("KaleidoSwap did not return a receive invoice.");
  return received.invoice;
}

export async function readWallet(provider?: RgbProvider) {
  if (!provider)
    throw Error("Install or enable the KaleidoSwap extension, then reload this page.");
  await provider.enable();
  const info = await provider.getInfo();
  if (!info.ready) throw Error("Unlock and connect the RGB wallet in the extension.");
  if (info.protocol !== "RGB_L1")
    throw Error("Select the node-less RGB wallet in the extension.");
  const assets = await provider.listAssets();
  if (!Array.isArray(assets)) throw Error("The wallet returned an invalid asset list.");
  const matches = assets.filter((a) => a?.id === TEST_USDT_ASSET);
  if (matches.length > 1 || (matches.length === 1 && matches[0].precision !== 6))
    throw Error("The wallet returned inconsistent USDT data.");
  const usdt = matches.length ? formatAtomic(matches[0].balance?.available, 6) : null;
  return { network: info.network, protocol: info.protocol, usdt };
}

export function createWalletSession(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  const key = "goal-digger-rgb-connection";
  const remembered = () => {
    try {
      return storage.getItem(key) === "connected";
    } catch {
      return false;
    }
  };
  const connect = async (provider?: RgbProvider) => {
    const wallet = await readWallet(provider);
    try {
      storage.setItem(key, "connected");
    } catch {
      /* A blocked storage API must not prevent a wallet read. */
    }
    return wallet;
  };
  return {
    connect,
    remembered,
    restore: (provider?: RgbProvider) =>
      remembered() ? connect(provider) : Promise.resolve(null),
    forget: () => {
      try {
        storage.removeItem(key);
      } catch {
        /* Storage can be disabled by the browser. */
      }
    },
  };
}

const NOT_SENT = new Set([
  "USER_REJECTED",
  "NOT_ENABLED",
  "METHOD_NOT_SUPPORTED",
  "INVALID_PARAMS",
  "ASSET_NOT_FOUND",
  "NO_AVAILABLE_UTXOS",
  "UNSAFE_PSBT",
]);

function providerCode(cause: unknown): string {
  const code = (cause as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "";
}

function paymentHandle(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const value = result as { txid?: unknown; hash?: unknown; transferId?: unknown };
  const txid = value.txid ?? value.hash;
  if (typeof txid === "string" && /^[a-fA-F0-9]{64}$/.test(txid)) return txid.toLowerCase();
  if (typeof value.transferId === "string" && value.transferId.length > 0) return value.transferId;
  if (typeof value.transferId === "number" && Number.isFinite(value.transferId))
    return String(value.transferId);
  return null;
}

function coded(message: string, code: string): Error {
  return Object.assign(Error(message), { code });
}

function positiveAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const amount = Number(value);
    if (Number.isSafeInteger(amount) && amount > 0) return amount;
  }
  return null;
}

function errorDetail(cause: unknown): string {
  const message = (cause as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : "No error details returned.";
}

function notSentMessage(cause: unknown): string {
  const code = providerCode(cause);
  if (code === "USER_REJECTED")
    return `KaleidoSwap cancelled the approval: ${errorDetail(cause)} Your invoice is saved. Retry when ready.`;
  if (code === "NO_AVAILABLE_UTXOS")
    return "KaleidoSwap has no Bitcoin slot for this RGB payment. Approve the slot, then approve the stake again. No test USDT left your wallet.";
  if (code === "ASSET_NOT_FOUND")
    return "This wallet does not hold the test USDT for this invoice. No test USDT left your wallet.";
  const detail = errorDetail(cause);
  return `${detail} No test USDT left your wallet.`;
}

function listed(info: { methods?: string[] }, method: string): boolean {
  return !info.methods || info.methods.includes(method);
}

async function sendWitnessInvoice(provider: RgbProvider, invoice: string): Promise<unknown> {
  if (!provider.decodeRgbInvoice)
    throw coded("This wallet cannot decode the stake invoice.", "METHOD_NOT_SUPPORTED");
  let decoded: {
    assetId?: unknown;
    amount?: unknown;
    recipientId?: unknown;
    transportEndpoints?: unknown;
  };
  try {
    decoded = await provider.decodeRgbInvoice(invoice);
  } catch (cause) {
    if (providerCode(cause)) throw cause;
    const message =
      cause instanceof Error && cause.message
        ? cause.message
        : "The stake invoice could not be decoded.";
    throw coded(message, "INVALID_PARAMS");
  }
  if (decoded?.assetId !== TEST_USDT_ASSET)
    throw coded("This invoice is not for the test USDT asset.", "ASSET_NOT_FOUND");
  const amount = positiveAmount(decoded.amount);
  if (amount === null)
    throw coded("The stake invoice has no explicit test USDT amount.", "INVALID_PARAMS");
  if (typeof decoded.recipientId !== "string" || !decoded.recipientId.includes("wvout:"))
    throw coded("The stake invoice has no witness recipient.", "INVALID_PARAMS");
  const endpoints = decoded.transportEndpoints;
  if (!Array.isArray(endpoints) || endpoints.some((endpoint) => typeof endpoint !== "string"))
    throw coded("The stake invoice has invalid transport endpoints.", "INVALID_PARAMS");
  return requestWitnessSend({
    assetId: decoded.assetId,
    amount,
    recipientId: decoded.recipientId,
    transportEndpoints: endpoints,
    feeRate: 1,
    // KaleidoSwap converts an omitted blinding value to null; integer 0 is rejected by its RGB L1 adapter.
    witness_data: { amount_sat: 1000 },
  });
}

// The wallet must return a transfer handle before the app treats a send as submitted.
async function sendInvoice(provider: RgbProvider, invoice: string): Promise<string> {
  const result = invoice.includes("sbc:wvout:")
    ? await sendWitnessInvoice(provider, invoice)
    : await provider.sendAsset?.({ invoice });
  const handle = paymentHandle(result);
  if (!handle) throw Error("KaleidoSwap returned no transaction or transfer ID.");
  return handle;
}

async function ensureColorableSlot(
  provider: RgbProvider,
  info: { methods?: string[] },
): Promise<void> {
  const canRead = Boolean(provider.getBtcBalance) && listed(info, "getBtcBalance");
  const canCreate = Boolean(provider.createUtxos) && listed(info, "createUtxos");
  if (!canRead || !canCreate) return;
  let free: number | null | undefined;
  try {
    free = (await provider.getBtcBalance?.())?.freeColorableUtxos;
  } catch {
    return;
  }
  if (free !== 0) return;
  try {
    await provider.createUtxos?.({ num: 1, size: 1000 });
  } catch (cause) {
    if (NOT_SENT.has(providerCode(cause))) throw cause;
    const message =
      cause instanceof Error && cause.message
        ? cause.message
        : "KaleidoSwap did not create a Bitcoin slot.";
    throw Object.assign(Error(message), { code: "NO_AVAILABLE_UTXOS" });
  }
}

export const MISSED_CONFIRMATION =
  "Approve the payment in the KaleidoSwap confirmation window. Approval alone does not confirm receipt.";

// Keep a broadcast id across reloads. A lost response must not trigger another send.
export async function requestStakePayment(
  invoice: string,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  provider?: RgbProvider,
) {
  const key = `goal-digger-stake-send:${invoice}`;
  const checkMessage = "A payment was already requested. Choose Check payment before any further action.";
  if (storage.getItem(key)) throw Error(checkMessage);
  if (!invoice.startsWith("rgb:")) throw Error("The stake invoice is invalid.");
  if (!provider) throw Error("Install or enable KaleidoSwap, then retry the wallet approval.");
  await provider.enable();
  const info = await provider.getInfo();
  if (!info.ready) throw Error("Unlock your KaleidoSwap wallet, then retry.");
  if (info.protocol !== "RGB_L1" || info.network !== "signet")
    throw Error("Select the on-chain RGB wallet on Mutinynet in KaleidoSwap, then retry.");
  if (!provider.sendAsset || (info.methods && !info.methods.includes("sendAsset")))
    throw Error("This wallet cannot request RGB payments. Enable the send permission in KaleidoSwap.");
  // Recheck after asynchronous connection to exclude concurrent requests in this page.
  if (storage.getItem(key)) throw Error(checkMessage);
  storage.setItem(key, "requested");
  const canCreateUtxos = Boolean(provider.createUtxos) && listed(info, "createUtxos");
  try {
    await ensureColorableSlot(provider, info);
    let handle: string;
    try {
      handle = await sendInvoice(provider, invoice);
    } catch (cause) {
      if (providerCode(cause) !== "NO_AVAILABLE_UTXOS" || !canCreateUtxos) throw cause;
      try {
        await provider.createUtxos?.({ num: 1, size: 1000 });
      } catch (slotCause) {
        if (NOT_SENT.has(providerCode(slotCause))) throw slotCause;
        const message =
          slotCause instanceof Error && slotCause.message
            ? slotCause.message
            : "KaleidoSwap did not create a Bitcoin slot.";
        throw Object.assign(Error(message), { code: "NO_AVAILABLE_UTXOS" });
      }
      handle = await sendInvoice(provider, invoice);
    }
    storage.setItem(key, handle);
  } catch (cause) {
    if (NOT_SENT.has(providerCode(cause))) {
      storage.removeItem(key);
      throw Error(notSentMessage(cause));
    }
    throw Error(`The wallet did not confirm the result. ${errorDetail(cause)} ${checkMessage}`);
  }
}

export async function createAndPayStake(options: {
  createInvoice: () => Promise<{ invoice: string; status: string; fresh?: boolean }>;
  checkPayment: () => Promise<{ status: string }>;
  onInvoice?: (result: { invoice: string; status: string }) => void;
  onStatus?: (status: string) => void;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  provider?: RgbProvider;
}) {
  const result = await options.createInvoice();
  options.onInvoice?.(result);
  if (result.status === "credited") return "Payment confirmed.";
  if (result.status === "pending") return "Waiting for payment confirmation on Mutinynet…";
  let status = result.status;
  // A saved invoice keeps its first status. Read the vault before a second send.
  if (!(result.fresh === true && status === "awaiting_payment")) {
    const receipt = await options.checkPayment();
    options.onStatus?.(receipt.status);
    status = receipt.status;
    if (status === "credited") return "Payment confirmed.";
    if (status === "pending") return "Waiting for payment confirmation on Mutinynet…";
  }
  if (status !== "awaiting_payment")
    throw Error("The payment needs review. Check its status before trying again.");
  try {
    await requestStakePayment(result.invoice, options.storage, options.provider);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (!message.startsWith("The wallet did not confirm the result.")) throw cause;
    // An empty success can still be a broadcast. Keep the send lock.
    if (message.includes("no transaction or transfer ID")) throw cause;
    // A receiver can lag a broadcast. Preserve the error and the send lock.
    try {
      const live = await options.checkPayment();
      options.onStatus?.(live.status);
      if (live.status === "credited") return "Payment confirmed.";
      if (live.status === "pending") return "Waiting for payment confirmation on Mutinynet…";
    } catch {
      // A failed status check cannot resolve an uncertain wallet send.
    }
    throw cause;
  }
  return "Waiting for payment confirmation on Mutinynet…";
}

export async function clearUnconfirmedStakeRequest(options: {
  invoice: string;
  walletActivityChecked: boolean;
  storage: Pick<Storage, "getItem" | "removeItem">;
  checkPayment: () => Promise<{ status: string }>;
}) {
  if (!options.walletActivityChecked) throw Error("Check wallet Activity before retrying this payment.");
  const key = `goal-digger-stake-send:${options.invoice}`;
  if (options.storage.getItem(key) !== "requested")
    throw Error("Only an unresolved wallet request can be reset. Check payment instead.");
  const receipt = await options.checkPayment();
  if (receipt.status !== "awaiting_payment")
    throw Error("The deposit is pending, paid, or needs review. Do not send again.");
  if (options.storage.getItem(key) !== "requested")
    throw Error("The wallet result changed. Check payment instead.");
  options.storage.removeItem(key);
}
