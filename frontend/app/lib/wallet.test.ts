import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWallet, formatAtomic } from './wallet.ts';
const assetId = 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0';
test('formats integer amounts without precision loss', () => {
  assert.equal(formatAtomic('9007199254740993',6),'9007199254.740993');
  assert.equal(formatAtomic(1000000,6),'1');
  assert.throws(()=>formatAtomic(Number.MAX_SAFE_INTEGER+1,6));
});
test('reads only the exact USDT asset and distinguishes absence from unavailable data', async () => {
  const calls: string[]=[];
  const provider={enable:async()=>{calls.push('enable');},getInfo:async()=>({ready:true,network:'signet',protocol:'RGB_L1'}),listAssets:async()=>[
    {id:'other',ticker:'USDT',precision:6,balance:{available:9000000}},
    {id:assetId,ticker:'USDT',precision:6,balance:{available:'100000000'}}]};
  assert.equal((await readWallet(provider)).usdt,'100');
  assert.deepEqual(calls,['enable']);
  assert.equal((await readWallet({...provider,listAssets:async()=>[]})).usdt,null);
  await assert.rejects(readWallet({...provider,listAssets:async()=>[{id:assetId,precision:6,balance:{}}]}));
});
test('missing, locked, wrong-protocol, and failed providers never show a zero balance', async () => {
  await assert.rejects(readWallet(undefined));
  const provider={enable:async()=>{},getInfo:async()=>({ready:false,network:'signet',protocol:'RGB_L1'}),listAssets:async()=>[]};
  await assert.rejects(readWallet(provider));
  await assert.rejects(readWallet({...provider,getInfo:async()=>({ready:true,network:'signet',protocol:'RGB_LN'})}));
  await assert.rejects(readWallet({...provider,getInfo:async()=>({ready:true,network:'signet',protocol:'RGB_L1'}),listAssets:async()=>{throw Error('offline')}}));
});
