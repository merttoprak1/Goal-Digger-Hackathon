import {useCallback,useEffect,useRef,useState} from 'react';
import {createPayoutClient,payoutSession,PayoutError} from '~/lib/payouts';
import type {Participant,PayoutChallenge,PayoutPlan,PayoutClaim,PayoutExecution} from '~/lib/payouts';
import {formatAtomic,TEST_USDT_ASSET} from '~/lib/wallet';
const client=createPayoutClient({baseUrl:import.meta.env.VITE_API_BASE_URL??'/api'});
const button='rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
const input='w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:outline-2 focus:outline-indigo-500';
const message=(error:unknown)=>error instanceof Error?error.message:'The request failed.';
interface Session {token:string;participant:Participant}
export function meta(){return [{title:'Your payouts · Goal Digger'}];}

function Award({challenge,session,onExpired}:{challenge:PayoutChallenge;session:Session;onExpired:()=>void}){
 const [plan,setPlan]=useState<PayoutPlan|null>(null);
 const [claim,setClaim]=useState<PayoutClaim|null>(null);
 const [execution,setExecution]=useState<PayoutExecution|null>(null);
 const [invoice,setInvoice]=useState('');const [busy,setBusy]=useState(true);const [error,setError]=useState('');
 const lock=useRef(false);const alive=useRef(true);
 const {id}=challenge;const {token}=session;
 const refresh=useCallback(async()=>{
  const [p,c,e]=await Promise.all([client.plan(id,token),client.claim(id,token),client.execution(id,token)]);
  if(alive.current){setPlan(p.plan);setClaim(c.claim);setExecution(e.execution);if(c.claim)setInvoice(c.claim.invoice);}
 },[id,token]);
 useEffect(()=>{alive.current=true;refresh().catch(e=>{if(alive.current){setError(message(e));if(e instanceof PayoutError&&e.status===401)onExpired();}}).finally(()=>{if(alive.current)setBusy(false);});return()=>{alive.current=false;};},[refresh,onExpired]);
 async function run(action:()=>Promise<unknown>){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{await action();await refresh();}
  catch(e){if(e instanceof PayoutError&&e.status===401)onExpired();else{try{await refresh();}catch{/* Preserve the action error. */}if(alive.current)setError(message(e));}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const allocation=plan?.allocations.find(a=>a.participantId===session.participant.id);
 const amount=allocation?formatAtomic(allocation.amountAtomic,6):null;
 const fundingReview=challenge.status==='funding_review';
 return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-busy={busy}>
  <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Completed challenge</p>
  <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{challenge.title}</h2>
  <p className="mt-2 text-sm text-slate-500">{challenge.outcome?.status==='success'?'The creator succeeded.':'The creator did not prove success.'}</p>
  {fundingReview&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">These funds need review before a payout can proceed.</p>}
  {error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
  {!plan&&!busy&&<div className="mt-6"><p className="mb-3 text-sm text-slate-600">Check the saved result to calculate your payout.</p><button className={button} disabled={busy} onClick={()=>run(()=>client.calculate(id,token))}>Check my payout</button></div>}
  {plan&&!allocation&&<p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">This participant has no winning allocation for this challenge.</p>}
  {amount&&<>
   <div className="my-6 rounded-xl bg-indigo-50 p-5"><p className="text-sm font-semibold text-indigo-600">Your payout</p><p className="mt-1 font-mono text-3xl font-bold text-indigo-950">{amount} <span className="text-base">test USDT</span></p><p className="mt-2 text-xs text-indigo-700">Includes your returned stake. Fixed from the confirmed betting pool.</p></div>
   {execution?.status==='accepted'?<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5" role="status"><h3 className="font-bold text-emerald-900">Payout sent</h3><p className="mt-2 text-sm text-emerald-800">The vault accepted the transfer. Settlement is not confirmed yet.</p><p className="mt-3 text-xs font-semibold text-emerald-900">Transaction ID</p><code className="mt-1 block break-all text-xs text-emerald-900">{execution.txid}</code><p className="mt-3 text-sm text-emerald-800">Check your wallet after confirmation.</p></div>:<>
    <ol className="mb-5 list-inside list-decimal space-y-2 text-sm text-slate-600"><li>In your Mutinynet RGB wallet, create a receive invoice for exactly <strong>{amount} test USDT</strong>.</li><li>Paste the invoice below and save it.</li><li>Select Claim payout to receive your funds.</li></ol>
    <details className="mb-4 text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Test USDT asset ID</summary><code className="mt-2 block break-all">{TEST_USDT_ASSET}</code></details>
    <form onSubmit={e=>{e.preventDefault();run(()=>client.prepare(id,token,claim?.invoice??invoice.trim()));}}>
     <label htmlFor="receive-invoice" className="text-sm font-semibold text-slate-700">RGB receive invoice</label>
     <textarea id="receive-invoice" className={`${input} mt-2 min-h-28 font-mono`} value={invoice} maxLength={3000} readOnly={!!claim} disabled={busy} onChange={e=>setInvoice(e.target.value)} placeholder="rgb:…" required aria-describedby="invoice-help" />
     <p id="invoice-help" className="mt-2 text-xs text-slate-500">{claim?'This invoice is fixed to your payout.':'Use a fresh invoice for this payout. Saving it does not send funds.'}</p>
     {!claim?.payout&&<button type="submit" className={`${button} mt-4`} disabled={busy||fundingReview||!(claim?.invoice??invoice.trim()).startsWith('rgb:')}>{claim?'Recover saved request':'Save receive invoice'}</button>}
    </form>
    {claim?.payout&&<div className="mt-5"><p className="mb-3 text-sm text-slate-600">{execution?.status==='unknown'?'The transfer result is uncertain. Retry this same request to recover its status. The vault protects against duplicate sends.':'Your invoice is ready. Claiming sends the saved payout to this invoice.'}</p><button className={button} disabled={busy||fundingReview} onClick={()=>run(async()=>{const result=await client.execute(id,token);if(alive.current)setExecution(result.execution);})}>{execution?.status==='unknown'?'Retry payout request':`Claim ${amount} USDT`}</button></div>}
   </>}
  </>}
  <div className="mt-6 flex items-center gap-4"><button className="text-sm font-semibold text-indigo-600 disabled:opacity-50" disabled={busy} onClick={()=>run(refresh)}>Refresh saved payout</button>{busy&&<span role="status" className="text-sm text-slate-500">Please wait…</span>}</div>
 </section>;
}

export default function Payouts(){
 const [session,setSession]=useState<Session|null>(null);const [ready,setReady]=useState(false);
 const [name,setName]=useState('');const [key,setKey]=useState('');const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [note,setNote]=useState('');const [challenges,setChallenges]=useState<PayoutChallenge[]>([]);
 const [selected,setSelected]=useState('');const [loading,setLoading]=useState(false);const generation=useRef(0);const offset=useRef(0);const [more,setMore]=useState(false);
 const disconnect=useCallback(()=>{generation.current++;payoutSession(localStorage).clear();setSession(null);setChallenges([]);offset.current=0;setMore(false);setSelected('');setError('');setNote('');},[]);
 const expired=useCallback(()=>{disconnect();setError('Your participant session expired. Restore a valid session to continue.');},[disconnect]);
 useEffect(()=>{let active=true;const token=payoutSession(localStorage).read();if(!token){setReady(true);return;}
  client.me(token).then(result=>{if(active)setSession({token,participant:result.participant});}).catch(e=>{if(active){setError(message(e));if(e instanceof PayoutError&&e.status===401)payoutSession(localStorage).clear();}}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
 const load=useCallback(async(append=false)=>{
  if(!session)return;const version=generation.current;setLoading(true);
  try{const result=await client.list(session.token,append?offset.current:0);if(version===generation.current){offset.current=(append?offset.current:0)+result.challenges.length;setMore(result.challenges.length===100);setChallenges(previous=>[...(append?previous:[]),...result.challenges.filter(c=>c.outcome!==null)].filter((c,i,all)=>all.findIndex(item=>item.id===c.id)===i));setError('');}}
  catch(e){if(version===generation.current){if(e instanceof PayoutError&&e.status===401)expired();else setError(message(e));}}
  finally{if(version===generation.current)setLoading(false);}
 },[session,expired]);
 useEffect(()=>{load();},[load]);
 async function connect(restore:boolean){
  if(busy)return;setBusy(true);setError('');setNote('');
  try{const result=restore?{...(await client.me(key.trim())),token:key.trim()}:await client.createSession(name.trim());generation.current++;setSession(result);setKey('');if(!payoutSession(localStorage).save(result.token))setNote('The session could not be saved. Keep this page open.');}
  catch(e){setError(message(e));}finally{setBusy(false);}
 }
 const current=challenges.find(c=>c.id===selected);
 return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
  <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Live payouts · Mutinynet</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Your winnings, in your wallet</h1><p className="mt-3 max-w-2xl text-sm text-slate-600">Claim your share from a completed challenge. Use the same participant session that created your challenge or placed your stake.</p>
  {error&&<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}{note&&<p role="status" className="mt-4 text-sm text-slate-600">{note}</p>}
  {!ready?<p role="status" className="mt-8 text-sm text-slate-500">Restore participant session…</p>:!session?<section className="mt-8 grid gap-6 md:grid-cols-2">
   <form className="rounded-2xl border border-slate-200 bg-white p-6" onSubmit={e=>{e.preventDefault();connect(true);}}><h2 className="text-lg font-bold text-slate-900">Restore your participant</h2><p className="my-3 text-sm text-slate-600">Use your existing participant access key. A new name does not recover previous stakes.</p><label htmlFor="participant-key" className="text-sm font-semibold">Participant access key</label><input id="participant-key" className={`${input} mt-2`} type="password" autoComplete="off" spellCheck={false} value={key} onChange={e=>setKey(e.target.value)} pattern="[a-f0-9]{64}" required /><p className="mt-2 text-xs text-slate-500">This is your Goal Digger session key. Never enter a wallet seed phrase.</p><button className={`${button} mt-4`} disabled={busy}>Restore participant</button></form>
   <form className="rounded-2xl border border-slate-200 bg-white p-6" onSubmit={e=>{e.preventDefault();connect(false);}}><h2 className="text-lg font-bold text-slate-900">New to the local demo?</h2><p className="my-3 text-sm text-slate-600">Create a participant for future challenges. This does not claim another participant’s winnings.</p><label htmlFor="participant-name" className="text-sm font-semibold">Your display name</label><input id="participant-name" className={`${input} mt-2`} maxLength={60} value={name} onChange={e=>setName(e.target.value)} required /><button className={`${button} mt-4`} disabled={busy||!name.trim()}>Create demo participant</button></form>
  </section>:<>
   <div className="my-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div><p className="text-sm font-bold text-slate-900">{session.participant.displayName}</p><p className="text-xs text-slate-500">Participant session active. Keep your access key to restore it elsewhere.</p></div><div className="flex flex-wrap gap-4 text-xs font-semibold text-indigo-600"><button onClick={async()=>{try{await navigator.clipboard.writeText(session.token);setNote('Participant access key copied. Keep it private.');}catch{setNote('The access key could not be copied.');}}}>Copy access key</button><button disabled={loading} onClick={()=>load()}>Refresh challenges</button><button onClick={disconnect}>Disconnect participant</button></div></div>
   <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]"><section aria-label="Completed challenges" className="space-y-3">{loading&&<p role="status" className="text-sm text-slate-500">Read completed challenges…</p>}{!loading&&!challenges.length&&<p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No completed challenges are available yet.</p>}{challenges.map(c=><button key={c.id} onClick={()=>setSelected(c.id)} aria-pressed={selected===c.id} className={`w-full rounded-xl border p-4 text-left transition ${selected===c.id?'border-indigo-400 bg-indigo-50':'border-slate-200 bg-white hover:border-indigo-300'}`}><span className="block text-sm font-bold text-slate-900">{c.title}</span><span className="mt-2 block text-xs text-slate-500">{c.status==='funding_review'?'Funds need review':c.outcome?.status==='success'?'Creator succeeded':'Opponents won'}</span></button>)}{more&&<button className="text-sm font-semibold text-indigo-600 disabled:opacity-50" disabled={loading} onClick={()=>load(true)}>Load older challenges</button>}</section>{current?<Award key={`${session.token}:${current.id}`} challenge={current} session={session} onExpired={expired}/>:<div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Select a completed challenge to check your payout.</div>}</div>
  </>}
 </main>;
}
