import { useEffect, useState } from 'react';
import { createWalletSession, readWallet } from '~/lib/wallet';
export function meta() { return [{title:'Wallet · Goal Digger'}]; }
export default function Wallet() {
  const [wallet,setWallet]=useState<Awaited<ReturnType<typeof readWallet>>|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    let started=false;
    let timer: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    const session=createWalletSession(window.localStorage);
    if(!session.remembered()) return;
    setBusy(true);
    const restore=()=>{
      if(started || !window.rgb) return;
      started=true;clearInterval(timer);clearTimeout(timeout);
      session.restore(window.rgb).then(value=>{if(active)setWallet(value);})
        .catch(e=>{if(active)setError(e instanceof Error?e.message:'Reconnect the wallet in the extension.');})
        .finally(()=>{if(active)setBusy(false);});
    };
    timer=setInterval(restore,100);
    timeout=setTimeout(()=>{clearInterval(timer);if(active&&!started){setBusy(false);setError('The extension is unavailable. Enable it, then connect again.');}},5000);
    restore();
    return()=>{active=false;clearInterval(timer);clearTimeout(timeout);};
  },[]);
  async function connect() {
    setBusy(true);setError('');setWallet(null);
    try {setWallet(await createWalletSession(window.localStorage).connect(window.rgb));}
    catch(e) {setError(e instanceof Error ? e.message : 'The wallet request failed.');}
    finally {setBusy(false);}
  }
  return <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-extrabold">Your RGB wallet</h1>
      <p className="mt-3 text-slate-600">Connect your KaleidoSwap extension to read its network and available test USDT. This screen does not send funds.</p>
      <p className="mt-3 text-sm text-slate-600">For our demo, select Mutinynet in the extension. In the permission prompt, disable payment, signing, and other optional capabilities.</p>
      <button type="button" disabled={busy} onClick={connect} className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'Waiting for wallet…':wallet?'Refresh wallet':'Connect Wallet'}</button>
      {wallet&&<button type="button" onClick={()=>{createWalletSession(window.localStorage).forget();setWallet(null);setError('');}} className="ml-3 text-sm font-semibold text-slate-600">Forget connection</button>}
      {error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}
      {wallet&&<div aria-live="polite" className="mt-6 space-y-3">
        <p>Reported network: <strong>{wallet.network}</strong></p>
        <p>Protocol: <strong>{wallet.protocol}</strong></p>
        <p>Available test USDT: <strong>{wallet.usdt??'Asset not present'}</strong></p>
        {wallet.network==='signet'?<p className="text-sm text-slate-600">The extension reports Signet for Mutinynet. Check the Mutinynet setting in the extension before any transfer.</p>:<p className="text-sm text-amber-800">This wallet does not report Signet. Select Mutinynet before the demo.</p>}
        <p className="text-xs text-slate-500">Snapshot from your last read. Refresh after a transfer or a network change.</p>
      </div>}
    </section>
  </main>;
}
