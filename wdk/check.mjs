import "bare-node-runtime/global";
import WalletManagerRgb from "@utexo/wdk-wallet-rgb";
import bip39 from "bip39" with { imports: "bare-node-runtime/imports" };
import fs from "bare-fs";
import { fileURLToPath } from "bare-url";
import { executePayoutTransfer } from "../vault/payout-transfer.mjs";

const dataDir = fileURLToPath(new URL("./data", import.meta.url));
const walletDataDir = `${dataDir}/custom-signet`;
const indexerUrl =
  process.env.WDK_INDEXER_URL || "https://esplora.signet.kaleidoswap.com";
const transportEndpoint = "rpcs://proxy.iriswallet.com/0.2/json-rpc";
const mode = process.argv[2] || "check";
if (
  ![
    "check",
    "receive",
    "refresh",
    "prepare-slots",
    "send-back",
    "deposit",
    "deposit-status",
    "execute-payout",
    "payout-status",
  ].includes(mode)
)
  throw new Error("Invalid WDK operation.");
const assetId = "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0";
const amountAtomic = 1_000_000;
process.env.GOAL_DIGGER_CUSTOM_SIGNET = "1";
const bindingPath = fileURLToPath(
  new URL("./node_modules/@utexo/wdk-wallet-rgb/src/bare-binding.js", import.meta.url),
);
if (
  !fs
    .readFileSync(bindingPath, "utf8")
    .includes("bitcoinNetwork: process.env.GOAL_DIGGER_CUSTOM_SIGNET === '1'")
) {
  console.error(
    "Run npm run prepare-native to enable the CustomSignet adapter before this check.",
  );
  process.exit(1);
}
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const seedPath = `${dataDir}/seed.txt`;
let seed;
try {
  seed = fs.readFileSync(seedPath, "utf8").trim();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  if (fs.readdirSync(dataDir).length)
    throw new Error(
      "Wallet data exists without its seed. Restore the seed before this check.",
    );
  seed = bip39.generateMnemonic(128);
  fs.writeFileSync(seedPath, seed, { mode: 0o600, flag: "wx" });
}
if (!bip39.validateMnemonic(seed)) throw new Error("The test wallet seed is invalid.");

let manager;
let failed = false;
let snapshot;
let result;
try {
  // Preserve the earlier Signet database. Reuse its seed in separate CustomSignet state.
  manager = new WalletManagerRgb(seed, {
    network: "signet",
    indexerUrl,
    transportEndpoint,
    dataDir: walletDataDir,
  });
  const account = await manager.getAccount();
  // This pinned manager clears xpriv before its base class reads keyPair.
  // Cache the key pair first so dispose can erase it and close the wallet.
  void account.keyPair;
  await account.syncWallet();
  if (mode === "execute-payout") {
    const payoutId = process.argv[3];
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(payoutId || ""))
      throw new Error("Invalid payout ID.");
    const recordPath = `${walletDataDir}/payouts/${payoutId}.json`;
    const saved = JSON.parse(fs.readFileSync(recordPath, "utf8"));
    if (saved.payoutId !== payoutId)
      throw new Error("The payout journal has a different ID.");
    result = await executePayoutTransfer({
      account,
      saved,
      saveRecord: (record) =>
        fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), { mode: 0o600 }),
    });
  } else if (mode === "deposit-status" || mode === "payout-status") {
    const recipientId = process.argv[3];
    if (!recipientId?.startsWith("sbc:wvout:") || recipientId.length > 200)
      throw new Error("Invalid deposit recipient.");
    await account.refreshWallet();
    const transfers = await account.listTransfers(assetId);
    if (!Array.isArray(transfers))
      throw new Error("WDK returned invalid transfer history.");
    result = {
      assetId,
      transfers: transfers
        .filter((t) => t.recipientId === recipientId)
        .map((t) => ({
          recipientId: t.recipientId,
          kind: t.kind,
          status: t.status,
          txid: t.txid,
          assignments: t.assignments,
          requestedAssignment: t.requestedAssignment,
        })),
    };
  } else if (mode === "deposit") {
    const amount = process.argv[3];
    if (!/^[1-9][0-9]{0,8}$/.test(amount || "") || BigInt(amount) > 100_000_000n)
      throw new Error("Invalid deposit amount.");
    const receive = await account.receiveAsset({
      witness: true,
      assetId,
      amount: Number(amount),
      durationSeconds: 3600,
      minConfirmations: 1,
      transportEndpoints: [transportEndpoint],
    });
    if (!receive.recipientId?.startsWith("sbc:wvout:"))
      throw new Error("Invalid CustomSignet invoice.");
    result = { assetId, amountAtomic: amount, receive };
  } else if (mode === "receive") {
    const invoicePath = `${walletDataDir}/usdt-receive.json`;
    if (fs.existsSync(invoicePath)) {
      result = JSON.parse(fs.readFileSync(invoicePath, "utf8"));
    } else {
      const receive = await account.receiveAsset({
        // The first consignment imports the asset into this new wallet.
        witness: true,
        amount: amountAtomic,
        durationSeconds: 3600,
        minConfirmations: 1,
        transportEndpoints: [transportEndpoint],
      });
      result = { assetId, amountAtomic: String(amountAtomic), receive };
      if (!receive.recipientId?.startsWith("sbc:wvout:"))
        throw new Error("WDK did not create a CustomSignet witness invoice.");
      fs.writeFileSync(invoicePath, JSON.stringify(result, null, 2), {
        mode: 0o600,
        flag: "wx",
      });
    }
    if (
      result.assetId !== assetId ||
      result.amountAtomic !== String(amountAtomic) ||
      !result.receive.recipientId.startsWith("sbc:wvout:")
    ) {
      throw new Error("The saved test invoice does not match this check.");
    }
  } else if (mode === "refresh") {
    await account.refreshWallet();
    result = {
      assetId,
      balance: await account.getAssetBalance(assetId),
      transfers: await account.listTransfers(assetId),
      unspents: await account.listUnspents(),
    };
  } else if (mode === "prepare-slots") {
    const recordPath = `${walletDataDir}/allocation-slots.json`;
    if (fs.existsSync(recordPath)) {
      result = JSON.parse(fs.readFileSync(recordPath, "utf8"));
    } else {
      result = {
        status: "unknown",
        stage: "begin",
        createdAt: new Date().toISOString(),
        count: 2,
        sizeSat: 1000,
        feeRate: 1,
      };
      fs.writeFileSync(recordPath, JSON.stringify(result, null, 2), {
        mode: 0o600,
        flag: "wx",
      });
      const unsignedPsbt = await account.createUtxosBegin({
        upTo: false,
        num: 2,
        size: 1000,
        feeRate: 1,
      });
      result.unsignedPsbt = unsignedPsbt;
      result.stage = "unsigned";
      fs.writeFileSync(recordPath, JSON.stringify(result, null, 2), { mode: 0o600 });
    }
    if (result.status === "unknown" && result.stage === "unsigned") {
      const signedPsbt = await account.signPsbt(result.unsignedPsbt);
      result.stage = "broadcasting";
      fs.writeFileSync(recordPath, JSON.stringify(result, null, 2), { mode: 0o600 });
      result.created = await account.createUtxosEnd({ signedPsbt });
      result.status = "accepted";
      result.stage = "complete";
      fs.writeFileSync(recordPath, JSON.stringify(result, null, 2), { mode: 0o600 });
    }
    // The PSBT stays in private wallet data for reconciliation, not in console output.
    result = { ...result, unsignedPsbt: undefined };
  } else if (mode === "send-back") {
    const receive = JSON.parse(
      fs.readFileSync(`${walletDataDir}/return-invoice.json`, "utf8"),
    );
    const recordPath = `${walletDataDir}/usdt-return-send.json`;
    const writeRecord = (record) =>
      fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), { mode: 0o600 });
    if (fs.existsSync(recordPath)) {
      result = JSON.parse(fs.readFileSync(recordPath, "utf8"));
      if (
        result.invoice !== receive.invoice ||
        result.assetId !== assetId ||
        result.amountAtomic !== String(amountAtomic)
      ) {
        throw new Error(
          "The existing return record does not match. Reconcile it before another send.",
        );
      }
    } else {
      const decoded = await account.decodeRGBInvoice({ invoice: receive.invoice });
      if (
        decoded.network !== "SignetCustom" ||
        !decoded.recipientId?.startsWith("sbc:wvout:") ||
        decoded.recipientId !== receive.recipient_id
      ) {
        throw new Error("The return invoice has an unexpected network or recipient.");
      }
      if (decoded.assetId !== assetId || decoded.assignment?.Fungible !== amountAtomic) {
        throw new Error("The return invoice has an unexpected asset or amount.");
      }
      if (
        !Number.isInteger(decoded.expirationTimestamp) ||
        decoded.expirationTimestamp <= Math.floor(Date.now() / 1000) + 60
      ) {
        throw new Error("The return invoice is expired or near expiry.");
      }
      if (
        JSON.stringify(decoded.transportEndpoints) !== JSON.stringify([transportEndpoint])
      ) {
        throw new Error("The return invoice has an unexpected transport endpoint.");
      }
      const balance = await account.getAssetBalance(assetId);
      if (
        BigInt(balance.settled) < BigInt(amountAtomic) ||
        BigInt(balance.spendable) < BigInt(amountAtomic)
      ) {
        throw new Error(
          "The WDK wallet does not have 1 settled and spendable test USDT.",
        );
      }
      result = {
        status: "prepared",
        createdAt: new Date().toISOString(),
        assetId,
        amountAtomic: String(amountAtomic),
        invoice: receive.invoice,
        recipientId: decoded.recipientId,
        feeRate: 1,
        witnessAmountSat: 1000,
      };
      fs.writeFileSync(recordPath, JSON.stringify(result, null, 2), {
        mode: 0o600,
        flag: "wx",
      });
      // Any interruption from this point requires reconciliation, never an automatic resend.
      result.status = "unknown";
      writeRecord(result);
      const transfer = await account.transfer({
        token: assetId,
        recipient: receive.invoice,
        amount: amountAtomic,
        feeRate: 1,
        minConfirmations: 1,
        witnessData: { amountSat: 1000, blinding: 0 },
      });
      if (!/^[0-9a-f]{64}$/.test(transfer.hash))
        throw new Error(
          "WDK did not return a usable transaction ID. Reconcile the saved record.",
        );
      result.status = "accepted";
      result.txid = transfer.hash;
      result.estimatedFeeSat = transfer.fee.toString();
      writeRecord(result);
    }
  }
  snapshot = await account.registerWallet();
} catch (error) {
  failed = true;
  console.error(
    "The WDK check failed. Check the runtime, wallet data, indexer, and RGB transfer status.",
  );
  if (mode === "send-back")
    console.error(
      "Check the saved return record and transfer history before any retry. Do not delete the record to resend.",
    );
  if (process.env.WDK_DEBUG === "1") {
    console.error(
      String(error.message)
        .replaceAll(seed, "[seed]")
        .replace(/\b(?:xprv|tprv|xpub|tpub)[1-9A-HJ-NP-Za-km-z]+/g, "[wallet key]"),
    );
  }
} finally {
  try {
    manager?.dispose();
  } catch {
    failed = true;
    console.error("WDK wallet cleanup failed. The connection check did not pass.");
  }
  seed = null;
}
if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        status: "connected",
        network: "signet",
        nativeNetwork: "SignetCustom",
        indexerUrl,
        address: snapshot.address,
        bitcoin: { unit: "sat", ...snapshot.btcBalance },
        ...(result ? { rgb: result } : {}),
      },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
}
