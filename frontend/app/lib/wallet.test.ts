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

test('a new page session restores a remembered connection with a fresh wallet read', async () => {
  const { createWalletSession } = await import('./wallet.ts');
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  let amount=100000000;
  let enables=0;
  const provider={enable:async()=>{enables++;},getInfo:async()=>({ready:true,network:'signet',protocol:'RGB_L1'}),listAssets:async()=>[{id:assetId,precision:6,balance:{available:amount}}]};
  const first=createWalletSession(storage);
  assert.equal(await first.restore(provider),null);
  assert.equal(enables,0);
  assert.equal((await first.connect(provider)).usdt,'100');
  amount=99000000;
  const reloaded=createWalletSession(storage);
  assert.equal((await reloaded.restore(provider))?.usdt,'99');
  assert.equal(enables,2);
  assert.deepEqual([...values.values()],['connected']);
  reloaded.forget();
  assert.equal(await createWalletSession(storage).restore(provider),null);
});

test('a rejected connection is not remembered and a failed restore never returns an old balance', async () => {
  const { createWalletSession } = await import('./wallet.ts');
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const session=createWalletSession(storage);
  await assert.rejects(session.connect({enable:async()=>{throw Error('denied');},getInfo:async()=>{throw Error();},listAssets:async()=>[]}));
  assert.equal(values.size,0);
  await session.connect({enable:async()=>{},getInfo:async()=>({ready:true,network:'signet',protocol:'RGB_L1'}),listAssets:async()=>[]});
  await assert.rejects(createWalletSession(storage).restore(undefined));
});
