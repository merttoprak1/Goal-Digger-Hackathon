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
