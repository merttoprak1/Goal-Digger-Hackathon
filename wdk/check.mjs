import 'bare-node-runtime/global'
import WalletManagerRgb from '@utexo/wdk-wallet-rgb'
import bip39 from 'bip39' with { imports: 'bare-node-runtime/imports' }
import fs from 'bare-fs'
import { fileURLToPath } from 'bare-url'

const dataDir = fileURLToPath(new URL('./data', import.meta.url))
const indexerUrl = process.env.WDK_INDEXER_URL || 'https://esplora.signet.kaleidoswap.com'
const transportEndpoint = 'rpcs://proxy.iriswallet.com/0.2/json-rpc'
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
try {
  manager = new WalletManagerRgb(seed, { network: 'signet', indexerUrl, transportEndpoint, dataDir })
  const account = await manager.getAccount()
  // This pinned manager clears xpriv before its base class reads keyPair.
  // Cache the key pair first so dispose can erase it and close the wallet.
  void account.keyPair
  await account.syncWallet()
  snapshot = await account.registerWallet()
} catch {
  failed = true
  console.error('WDK could not connect or synchronize. Check the runtime, wallet data, and indexer.')
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
    status: 'connected', network: 'signet', indexerUrl,
    address: snapshot.address, bitcoin: { unit: 'sat', ...snapshot.btcBalance }
  }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2))
}
