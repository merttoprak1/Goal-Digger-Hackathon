export const TEST_USDT_ASSET = 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0';
export interface RgbProvider {
  enable(): Promise<unknown>;
  getInfo(): Promise<{ ready: boolean; network: string; protocol: string }>;
  listAssets(): Promise<unknown>;
}
declare global { interface Window { rgb?: RgbProvider } }
export function formatAtomic(value: unknown, precision: number): string {
  if ((typeof value !== 'string' || !/^\d+$/.test(value)) &&
      (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) throw Error('The wallet returned an invalid balance.');
  const digits=BigInt(value as string | number).toString().padStart(precision+1,'0');
  const fraction=digits.slice(-precision).replace(/0+$/,'');
  return precision ? digits.slice(0,-precision)+(fraction ? '.'+fraction : '') : digits;
}
export async function readWallet(provider?: RgbProvider) {
  if (!provider) throw Error('Install or enable the KaleidoSwap extension, then reload this page.');
  await provider.enable();
  const info=await provider.getInfo();
  if (!info.ready) throw Error('Unlock and connect the RGB wallet in the extension.');
  if (info.protocol!=='RGB_L1') throw Error('Select the node-less RGB wallet in the extension.');
  const assets=await provider.listAssets();
  if (!Array.isArray(assets)) throw Error('The wallet returned an invalid asset list.');
  const matches=assets.filter(a=>a?.id===TEST_USDT_ASSET);
  if(matches.length>1 || (matches.length===1 && matches[0].precision!==6)) throw Error('The wallet returned inconsistent USDT data.');
  const usdt=matches.length ? formatAtomic(matches[0].balance?.available,6) : null;
  return {network:info.network,protocol:info.protocol,usdt};
}
