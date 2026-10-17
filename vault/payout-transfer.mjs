import { validatePayoutInvoice } from "./payout-invoice.mjs";

export async function executePayoutTransfer({ account, saved, saveRecord }) {
  if (saved.status !== "prepared")
    throw new Error("Reconcile the existing payout journal before another send.");
  if (
    typeof saved.amountAtomic !== "string" ||
    !/^[1-9][0-9]{0,8}$/.test(saved.amountAtomic) ||
    BigInt(saved.amountAtomic) > 100_000_000n
  ) {
    throw new Error("Invalid payout amount.");
  }
  const decoded = await account.decodeRGBInvoice({ invoice: saved.invoice });
  const validated = validatePayoutInvoice(decoded, saved.amountAtomic);
  if (
    !validated.valid ||
    validated.assetId !== saved.assetId ||
    validated.recipientId !== saved.recipientId
  ) {
    throw new Error("The saved payout invoice failed validation.");
  }
  await account.refreshWallet();
  const transfers = await account.listTransfers(saved.assetId);
  if (
    !Array.isArray(transfers) ||
    transfers.some((t) => t.kind === "Send" && t.recipientId === saved.recipientId)
  ) {
    throw new Error(
      "Reconcile the existing transfer history before paying this recipient.",
    );
  }
  const balance = await account.getAssetBalance(saved.assetId);
  if (
    BigInt(balance.settled) < BigInt(saved.amountAtomic) ||
    BigInt(balance.spendable) < BigInt(saved.amountAtomic)
  ) {
    throw new Error("The vault does not have the settled and spendable payout amount.");
  }
  Object.assign(saved, { status: "unknown", feeRate: 1, witnessAmountSat: 1000 });
  saveRecord(saved);
  const transfer = await account.transfer({
    token: saved.assetId,
    recipient: saved.invoice,
    amount: Number(saved.amountAtomic),
    feeRate: 1,
    minConfirmations: 1,
    witnessData: { amountSat: 1000, blinding: 0 },
  });
  if (typeof transfer?.hash !== "string" || !/^[0-9a-f]{64}$/.test(transfer.hash))
    throw new Error("The payout result is uncertain. Reconcile its journal.");
  Object.assign(saved, {
    status: "accepted",
    txid: transfer.hash,
    estimatedFeeSat: transfer.fee.toString(),
  });
  saveRecord(saved);
  return saved;
}
