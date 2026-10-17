import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('This connection check requires an Apple Silicon Mac.')
}

const target = new URL('./node_modules/@utexo/rgb-lib-bare/prebuilds/darwin-arm64/utexo__rgb-lib-bare.bare', import.meta.url)
const source = 'https://github.com/UTEXO-Protocol/rgb-lib-bare/releases/download/v0.3.0-beta.17/utexo__rgb-lib-bare-darwin-arm64.bare'
const expected = 'b238573076f2da3f5556cc3c5f987f5d15cfd530f1fa4fbe2d6b96689b6565c0'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

let bytes
try {
  bytes = await readFile(target)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
if (!bytes || hash(bytes) !== expected) {
  const response = await fetch(source, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`Native addon download failed: HTTP ${response.status}.`)
  bytes = Buffer.from(await response.arrayBuffer())
  if (hash(bytes) !== expected) throw new Error('Native addon checksum does not match the tested binary.')
  await mkdir(new URL('./', target), { recursive: true })
  await writeFile(target, bytes)
}
console.log('The tested Mac ARM native addon is ready.')

const bindingPath = new URL('./node_modules/@utexo/wdk-wallet-rgb/src/bare-binding.js', import.meta.url)
const original = '20ff9e5ed63d5ac3da0dfce548bca7aedef9cfa9109393aa0a81c1a96ec189c4'
const before = 'bitcoinNetwork: mapNetwork(network),'
const after = "bitcoinNetwork: process.env.GOAL_DIGGER_CUSTOM_SIGNET === '1' && network === 'signet' ? 'SignetCustom' : mapNetwork(network),"
const binding = await readFile(bindingPath, 'utf8')
const unpatched = binding.replace(after, before)
if (hash(unpatched) !== original) throw new Error('The WDK binding differs from the pinned source. Refusing to patch it.')
await writeFile(bindingPath, unpatched.replace(before, after))
console.log('The explicit CustomSignet adapter flag is ready.')

const sdkPath = new URL('./node_modules/@utexo/rgb-sdk/dist/index.mjs', import.meta.url)
const sdkChanges = [
  ['return typeof process !== "undefined" && process.versions != null && process.versions.node != null;',
    'return !isBare() && typeof process !== "undefined" && process.versions != null && process.versions.node != null;'],
  ['const nodeCrypto2 = "node:crypto";', 'const nodeCrypto2 = isBare() ? "bare-crypto" : "node:crypto";'],
  ['const nodeCryptoPath = "node:crypto";', 'const nodeCryptoPath = isBare() ? "bare-crypto" : "node:crypto";']
]
const sdk = await readFile(sdkPath, 'utf8')
const sdkOriginal = sdkChanges.reduce((text, [before, after]) => text.replaceAll(after, before), sdk)
if (hash(sdkOriginal) !== 'f6680d2bd8df0b2d0f2528539f58f26e85d2e2cbbb3956301ecf891bad3396b7') throw new Error('The RGB SDK differs from the pinned source. Refusing to patch it.')
await writeFile(sdkPath, sdkChanges.reduce((text, [before, after]) => text.replaceAll(before, after), sdkOriginal))
console.log('The Bare signer runtime check is ready.')
