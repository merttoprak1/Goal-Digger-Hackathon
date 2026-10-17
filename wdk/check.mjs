import 'bare-node-runtime/global'
import WalletManagerRgb from '@utexo/wdk-wallet-rgb'
import bip39 from 'bip39' with { imports: 'bare-node-runtime/imports' }
import fs from 'bare-fs'
import { fileURLToPath } from 'bare-url'

const dataDir = fileURLToPath(new URL('./data', import.meta.url))
const walletDataDir = `${dataDir}/custom-signet`
const indexerUrl = process.env.WDK_INDEXER_URL || 'https://esplora.signet.kaleidoswap.com'
const transportEndpoint = 'rpcs://proxy.iriswallet.com/0.2/json-rpc'
const mode = process.argv[2] || 'check'
if (!['check', 'receive', 'refresh'].includes(mode)) throw new Error('Use check, receive, or refresh.')
const assetId = 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0'
const amountAtomic = 1_000_000
process.env.GOAL_DIGGER_CUSTOM_SIGNET = '1'
const bindingPath = fileURLToPath(new URL('./node_modules/@utexo/wdk-wallet-rgb/src/bare-binding.js', import.meta.url))
if (!fs.readFileSync(bindingPath, 'utf8').includes("bitcoinNetwork: process.env.GOAL_DIGGER_CUSTOM_SIGNET === '1'")) {
  console.error('Run npm run prepare-native to enable the CustomSignet adapter before this check.')
  process.exit(1)
}
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 })
const seedPath = `${dataDir}/seed.txt`
let seed
try {
  seed = fs.readFileSync(seedPath, 'utf8').trim()
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  if (fs.readdirSync(dataDir).length) throw new Error('Wallet data exists without its seed. Restore the seed before this check.')
  seed = bip39.generateMnemonic(128)
  fs.writeFileSync(seedPath, seed, { mode: 0o600, flag: 'wx' })
}
if (!bip39.validateMnemonic(seed)) throw new Error('The test wallet seed is invalid.')

let manager
let failed = false
let snapshot
let result
try {
  // Preserve the earlier Signet database. Reuse its seed in separate CustomSignet state.
  manager = new WalletManagerRgb(seed, { network: 'signet', indexerUrl, transportEndpoint, dataDir: walletDataDir })
  const account = await manager.getAccount()
  // This pinned manager clears xpriv before its base class reads keyPair.
  // Cache the key pair first so dispose can erase it and close the wallet.
  void account.keyPair
  await account.syncWallet()
  if (mode === 'receive') {
    const invoicePath = `${walletDataDir}/usdt-receive.json`
    if (fs.existsSync(invoicePath)) {
      result = JSON.parse(fs.readFileSync(invoicePath, 'utf8'))
    } else {
      const receive = await account.receiveAsset({
        // The first consignment imports the asset into this new wallet.
        witness: true, amount: amountAtomic,
        durationSeconds: 3600, minConfirmations: 1,
        transportEndpoints: [transportEndpoint]
      })
      result = { assetId, amountAtomic: String(amountAtomic), receive }
      if (!receive.recipientId?.startsWith('sbc:wvout:')) throw new Error('WDK did not create a CustomSignet witness invoice.')
      fs.writeFileSync(invoicePath, JSON.stringify(result, null, 2), { mode: 0o600, flag: 'wx' })
    }
    if (result.assetId !== assetId || result.amountAtomic !== String(amountAtomic) || !result.receive.recipientId.startsWith('sbc:wvout:')) {
      throw new Error('The saved test invoice does not match this check.')
    }
  } else if (mode === 'refresh') {
    await account.refreshWallet()
    result = {
      assetId, balance: await account.getAssetBalance(assetId),
      transfers: await account.listTransfers(assetId)
    }
  }
  snapshot = await account.registerWallet()
} catch (error) {
  failed = true
  console.error('The WDK check failed. Check the runtime, wallet data, indexer, and RGB transfer status.')
  if (process.env.WDK_DEBUG === '1') {
    console.error(String(error.message).replaceAll(seed, '[seed]').replace(/\b(?:xprv|tprv|xpub|tpub)[1-9A-HJ-NP-Za-km-z]+/g, '[wallet key]'))
  }
} finally {
  try {
    manager?.dispose()
  } catch {
    failed = true
    console.error('WDK wallet cleanup failed. The connection check did not pass.')
  }
  seed = null
}
if (failed) {
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    status: 'connected', network: 'signet', nativeNetwork: 'SignetCustom', indexerUrl,
    address: snapshot.address, bitcoin: { unit: 'sat', ...snapshot.btcBalance },
    ...(result ? { rgb: result } : {})
  }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2))
}
