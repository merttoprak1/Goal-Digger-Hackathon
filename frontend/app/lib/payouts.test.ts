import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPayoutClient,payoutSession,PayoutError} from './payouts.ts';
const token='a'.repeat(64);
test('sends only the receive invoice for preparation and an empty body for execution',async()=>{
 const calls:Array<{url:string;init?:RequestInit}>=[];
 const client=createPayoutClient({fetchService:async(url,init)=>{calls.push({url:String(url),init});return Response.json(String(url).endsWith('/payout-request')?{claim:{payoutId:'award',invoice:'rgb:receipt',amountAtomic:'6666667',payout:{status:'prepared'}}}:{execution:{status:'accepted',txid:'b'.repeat(64)}});}});
 await client.prepare('challenge',token,'rgb:receipt');await client.execute('challenge',token);
 assert.equal(calls[0].url,'/api/challenges/challenge/payout-request');assert.deepEqual(JSON.parse(String(calls[0].init?.body)),{invoice:'rgb:receipt'});
 assert.equal(calls[0].init?.headers&&new Headers(calls[0].init.headers).get('Authorization'),`Bearer ${token}`);
 assert.deepEqual(JSON.parse(String(calls[1].init?.body)),{});
});
test('preserves an uncertain execution returned as HTTP 409 instead of calling it accepted',async()=>{
 const client=createPayoutClient({fetchService:async()=>Response.json({execution:{status:'unknown',txid:null}},{status:409})});
 assert.deepEqual(await client.execute('id',token),{execution:{status:'unknown',txid:null}});
});
test('rejects invalid accepted transactions and never substitutes a mock payout',async()=>{
 const client=createPayoutClient({fetchService:async()=>Response.json({execution:{status:'accepted',txid:'bad'}})});
 await assert.rejects(client.execute('id',token),e=>e instanceof PayoutError&&e.code==='INVALID_RESPONSE');
 const offline=createPayoutClient({fetchService:async()=>{throw Error('offline');}});
 await assert.rejects(offline.plan('id',token),e=>e instanceof PayoutError&&e.status===503);
});
test('keeps server authorization and funding review errors visible',async()=>{
 for(const status of [401,403,409,422]){
  const client=createPayoutClient({fetchService:async()=>Response.json({error:{code:'HOLD',message:'Funds need review.'}},{status})});
  await assert.rejects(client.execute('id',token),e=>e instanceof PayoutError&&e.status===status&&e.message==='Funds need review.');
 }
});
test('read calls never prepare or execute payments',async()=>{
 const calls:RequestInit[]=[];
 const client=createPayoutClient({fetchService:async(url,init)=>{calls.push(init!);return Response.json(String(url).includes('payout-plan')?{plan:null}:String(url).includes('payout-request')?{claim:null}:{execution:null});}});
 await Promise.all([client.plan('id',token),client.claim('id',token),client.execution('id',token)]);
 assert.ok(calls.every(c=>c.method==='GET'&&c.body===undefined));
});
test('restores only the saved participant token and clears it on disconnect',()=>{
 const data=new Map<string,string>();const session=payoutSession({getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);},removeItem:key=>{data.delete(key);}});
 assert.equal(session.read(),null);assert.equal(session.save(token),true);assert.equal(session.read(),token);session.clear();assert.equal(session.read(),null);
 session.save('invalid');assert.equal(session.read(),null);
 const blocked=payoutSession({getItem:()=>{throw Error();},setItem:()=>{throw Error();},removeItem:()=>{throw Error();}});assert.equal(blocked.read(),null);assert.equal(blocked.save(token),false);assert.doesNotThrow(()=>blocked.clear());
});
