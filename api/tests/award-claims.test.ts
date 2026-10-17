import {afterEach,it,expect,vi} from 'vitest';
import request from 'supertest';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {vaultPayouts} from '../src/services/vault-payouts.js';
import {createApp} from '../src/app.js';
import {openStakeDeposits} from '../../stake-deposits.mjs';
const cleanup:Array<()=>void>=[];afterEach(()=>{vi.useRealTimers();for(const f of cleanup.splice(0).reverse())f();});
async function setup(template='wake_up',creatorStakeAtomic='5000000'){
 const dir=mkdtempSync(join(tmpdir(),'outcomes-'));cleanup.push(()=>rmSync(dir,{recursive:true}));const databasePath=join(dir,'api.sqlite');const invoices=new Map<string,Record<string,unknown>>();let settled=true;
 const stakes=openStakeDeposits({databasePath,token:'secret',fetchService:async(url,init)=>{const body=init?.body?JSON.parse(String(init.body)):null;const id=body?.paymentId??String(url).split('/').at(-1)!;if(body)invoices.set(id,{paymentId:id,amountAtomic:body.amountAtomic,assetId:'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0',invoice:'rgb:'+id,recipientId:'sbc:wvout:'+id,status:'awaiting_payment',expirationTimestamp:Date.now()/1000+3600});return Response.json({...invoices.get(id),status:body?'awaiting_payment':settled?'settled':'pending',txid:'a'.repeat(64)});}});cleanup.push(()=>stakes.close());
 const remote=new Map<string,Record<string,unknown>>();const calls:Array<{path:string;body:Record<string,unknown>}>=[];
 const control={lost:false,mismatch:false,reject:false,sameRecipient:false,duringValidation:()=>{}};
 const payoutVault=vaultPayouts('private-test-token',async(url,init)=>{
  const path=String(url);const body=JSON.parse(String(init?.body));calls.push({path,body});
  if(path.endsWith('/validate')){
   control.duringValidation();
   if(control.reject)return Response.json({valid:false},{status:422});
   return Response.json({valid:true,network:'SignetCustom',assetId:'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0',amountAtomic:body.amountAtomic,recipientId:'sbc:wvout:'+(control.sameRecipient?'same':body.invoice),expirationTimestamp:Math.floor(Date.now()/1000)+3600});
  }
  if(!path.endsWith('/vault/payouts'))throw new Error('Unexpected vault operation');
  if(!remote.has(body.payoutId))remote.set(body.payoutId,{...body,assetId:'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0',recipientId:'sbc:wvout:'+(control.sameRecipient?'same':body.invoice),expirationTimestamp:Math.floor(Date.now()/1000)+3600,status:'prepared',createdAt:new Date().toISOString()});
  if(control.lost)throw new Error('Response lost after saving');
  return Response.json({...remote.get(body.payoutId),...(control.mismatch?{amountAtomic:'1'}:{})});
 });
 const app=createApp({databasePath,stakeDeposits:stakes,payoutVault});cleanup.push(()=>app.locals.close());const a=(await request(app).post('/api/sessions').send({displayName:'Mert'})).body;const b=(await request(app).post('/api/sessions').send({displayName:'Ege'})).body;
 const starts=Date.now()+3600000;const deadline=starts+600000;const challenge=(await request(app).post('/api/challenges').set('Authorization',`Bearer ${a.token}`).send({template,title:'Wake up',successRule:'Solve the fresh problem',proofMethod:template==='wake_up'?'timed_math':'official_result',proofSource:'Server response and timestamp',timezone:'Europe/Rome',bettingCutoff:new Date(starts-60000).toISOString(),startsAt:new Date(starts).toISOString(),proofDeadline:new Date(deadline).toISOString(),creatorStakeAtomic})).body.challenge;
 const base='/api/challenges/'+challenge.id;const post=(path:string,body:unknown={},token=a.token)=>request(app).post(base+path).set('Authorization',`Bearer ${token}`).send(body);const get=(path:string,token=a.token)=>request(app).get(base+path).set('Authorization',`Bearer ${token}`);
 await post('/creator-deposit');await get('/creator-deposit');await post('/publish');
 const opponent=async(amountAtomic='5000000',token=b.token)=>{await post('/opponent-deposit',{amountAtomic},token);await get('/opponent-deposit',token);};
 const c=(await request(app).post('/api/sessions').send({displayName:'Vesim'})).body;
 const time=(t:number)=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(t);};
 return {app,databasePath,payoutVault,remote,calls,control,a,b,c,base,post,get,opponent,time,starts,deadline,set:(v:boolean)=>{settled=v;}};
}
async function finish(f:Awaited<ReturnType<typeof setup>>,success=false){
 await f.opponent();
 if(success){f.time(f.starts);const p=(await f.post('/math/problem')).body.problem;await f.post('/math/submit',{problemId:p.id,answer:String(p.left+p.right)});}
 f.time(f.deadline);await f.post('/finalize');await f.post('/payout-plan');
}
it('prepares only the signed-in winner allocation and keeps claims private',async()=>{
 const f=await setup();await finish(f);
 expect((await f.post('/payout-request',{invoice:'rgb:creator'})).status).toBe(403);
 expect((await f.post('/payout-request',{invoice:'rgb:ege',amountAtomic:'1'},f.b.token)).status).toBe(400);
 const result=await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token);expect(result.status).toBe(200);
 expect(result.body.claim).toMatchObject({participantId:f.b.participant.id,amountAtomic:'10000000',invoice:'rgb:ege',payout:{status:'prepared',amountAtomic:'10000000'}});
 expect((await f.get('/payout-request')).body.claim).toBeNull();
 expect((await f.get('/payout-request',f.c.token)).body.claim).toBeNull();
 expect((await f.get('/payout-request',f.b.token)).body).toEqual(result.body);
 expect(f.remote.size).toBe(1);expect(f.calls.every(c=>!c.path.includes('/execute'))).toBe(true);
});
it('allows only the creator to claim after creator success',async()=>{
 const f=await setup();await finish(f,true);
 expect((await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token)).status).toBe(403);
 expect((await f.post('/payout-request',{invoice:'rgb:mert'})).body.claim.amountAtomic).toBe('10000000');
});
it('rejects invalid invoices before binding and blocks replacement after binding',async()=>{
 const f=await setup();await finish(f);f.control.reject=true;
 expect((await f.post('/payout-request',{invoice:'rgb:bad'},f.b.token)).status).toBe(422);
 expect((await f.get('/payout-request',f.b.token)).body.claim).toBeNull();
 f.control.reject=false;expect((await f.post('/payout-request',{invoice:'rgb:valid'},f.b.token)).status).toBe(200);
 expect((await f.post('/payout-request',{invoice:'rgb:changed'},f.b.token)).status).toBe(409);expect(f.remote.size).toBe(1);
});
it('recovers a lost vault response after restart with the same payout ID and invoice',async()=>{
 const f=await setup();await finish(f);f.control.lost=true;
 expect((await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token)).status).toBe(503);
 const binding=(await f.get('/payout-request',f.b.token)).body.claim;expect(binding.payout).toBeNull();expect(f.remote.size).toBe(1);
 f.control.lost=false;const app=createApp({databasePath:f.databasePath,payoutVault:f.payoutVault});cleanup.push(()=>app.locals.close());
 const result=await request(app).post(f.base+'/payout-request').set('Authorization',`Bearer ${f.b.token}`).send({invoice:'rgb:ege'});
 expect(result.status).toBe(200);expect(result.body.claim.payoutId).toBe(binding.payoutId);expect(f.remote.size).toBe(1);
 expect(f.calls.filter(c=>c.path.endsWith('/validate'))).toHaveLength(1);
 expect((await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token)).body).toEqual(result.body);
 expect(f.calls.filter(c=>c.path.endsWith('/vault/payouts'))).toHaveLength(2);
});
it('rechecks the funds after invoice validation and before binding',async()=>{
 const f=await setup();await finish(f);
 f.control.duringValidation=()=>{const db=new DatabaseSync(f.databasePath);db.prepare('UPDATE stake_deposits SET amount=? WHERE participant_id=?').run('6000000',f.b.participant.id);db.close();};
 expect((await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token)).status).toBe(409);
 expect(f.remote.size).toBe(0);expect((await f.get('/payout-request',f.b.token)).body.claim).toBeNull();
});
it('prevents two awards from using the same recipient',async()=>{
 const f=await setup();await f.opponent('5000000',f.c.token);await finish(f);f.control.sameRecipient=true;
 expect((await f.post('/payout-request',{invoice:'rgb:one'},f.b.token)).status).toBe(200);
 expect((await f.post('/payout-request',{invoice:'rgb:two'},f.c.token)).status).toBe(409);expect(f.remote.size).toBe(1);
});
it('does not accept a mismatched vault response and retries the reserved award',async()=>{
 const f=await setup();await finish(f);f.control.mismatch=true;
 expect((await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token)).status).toBe(503);
 expect((await f.get('/payout-request',f.b.token)).body.claim.payout).toBeNull();
 f.control.mismatch=false;expect((await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token)).status).toBe(200);expect(f.remote.size).toBe(1);
});
it('requires authentication and a payout plan before contacting the vault',async()=>{
 const f=await setup();
 expect((await request(f.app).post(f.base+'/payout-request').send({invoice:'rgb:test'})).status).toBe(401);
 expect((await request(f.app).get(f.base+'/payout-request')).status).toBe(401);
 expect((await request(f.app).post('/api/challenges/missing/payout-request').set('Authorization',`Bearer ${f.a.token}`).send({invoice:'rgb:test'})).status).toBe(404);
 expect((await f.post('/payout-request',{invoice:'rgb:test'},f.b.token)).status).toBe(409);expect(f.calls).toHaveLength(0);
});

it('binds one invoice when competing requests arrive for the same award',async()=>{
 const f=await setup();await finish(f);
 const results=await Promise.all([f.post('/payout-request',{invoice:'rgb:first'},f.b.token),f.post('/payout-request',{invoice:'rgb:second'},f.b.token)]);
 expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(f.remote.size).toBe(1);
 const saved=(await f.get('/payout-request',f.b.token)).body.claim;
 expect(saved.invoice).toBe(results.find(r=>r.status===200)!.body.claim.invoice);
});
it('holds awards above the existing private vault test limit',async()=>{
 const f=await setup('wake_up','100000000');await finish(f,true);
 const result=await f.post('/payout-request',{invoice:'rgb:mert'});
 expect(result.status).toBe(409);expect(result.body.error.code).toBe('PAYOUT_LIMIT');expect(f.calls).toHaveLength(0);
});
it('keeps a prepared claim blocked for new preparation if funds change',async()=>{
 const f=await setup();await finish(f);await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token);
 const count=f.calls.length;const db=new DatabaseSync(f.databasePath);db.prepare('DELETE FROM stake_credits WHERE payment_id LIKE ?').run('creator-%');db.close();
 expect((await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token)).status).toBe(409);expect(f.calls).toHaveLength(count);
 expect((await f.get('/payout-request',f.b.token)).body.claim.payout.status).toBe('prepared');
});
