import {afterEach,it,expect,vi} from 'vitest';
import request from 'supertest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.js';
import {openStakeDeposits} from '../../stake-deposits.mjs';
const cleanup:Array<()=>void>=[];afterEach(()=>{vi.useRealTimers();for(const f of cleanup.splice(0).reverse())f();});
async function setup(){
 const dir=mkdtempSync(join(tmpdir(),'opponents-'));cleanup.push(()=>rmSync(dir,{recursive:true}));const databasePath=join(dir,'api.sqlite');
 const invoices=new Map<string,Record<string,unknown>>();let settled=false;let calls=0;
 const stakes=openStakeDeposits({databasePath,token:'secret',fetchService:async(url,init)=>{
  calls++;const body=init?.body?JSON.parse(String(init.body)):null;const id=body?.paymentId??String(url).split('/').at(-1)!;
  if(body)invoices.set(id,{paymentId:id,amountAtomic:body.amountAtomic,assetId:'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0',invoice:'rgb:'+id,recipientId:'sbc:wvout:'+id,expirationTimestamp:Date.now()/1000+3600,status:'awaiting_payment'});
  return Response.json({...invoices.get(id),status:body?'awaiting_payment':settled?'settled':'pending',txid:'a'.repeat(64)});
 }});cleanup.push(()=>stakes.close());const app=createApp({databasePath,stakeDeposits:stakes});cleanup.push(()=>app.locals.close());
 const a=(await request(app).post('/api/sessions').send({displayName:'Mert'})).body;const b=(await request(app).post('/api/sessions').send({displayName:'Ege'})).body;
 const start=Date.now()+3600000;const input={template:'wake_up',title:'Wake up',successRule:'Solve the fresh math problem',proofMethod:'timed_math',proofSource:'Server answer and time',timezone:'Europe/Rome',bettingCutoff:new Date(start-60000).toISOString(),startsAt:new Date(start).toISOString(),proofDeadline:new Date(start+60000).toISOString(),creatorStakeAtomic:'1000000'};
 const challenge=(await request(app).post('/api/challenges').set('Authorization',`Bearer ${a.token}`).send(input)).body.challenge;
 const base='/api/challenges/'+challenge.id;
 const post=(path:string,body:unknown,token=a.token)=>request(app).post(base+path).set('Authorization',`Bearer ${token}`).send(body);
 const get=(path:string,token=b.token)=>request(app).get(base+path).set('Authorization',`Bearer ${token}`);
 const fund=async()=>{await post('/creator-deposit',{});settled=true;await get('/creator-deposit',a.token);};
 return {app,a,b,challenge,post,get,fund,databasePath,stakes,calls:()=>calls,set:(value:boolean)=>{settled=value;}};
}
it('only the funded creator can publish and published terms become readable to opponents',async()=>{
 const f=await setup();expect((await f.post('/publish',{},f.b.token)).status).toBe(404);expect((await f.post('/publish',{})).status).toBe(409);
 await f.fund();const pub=await f.post('/publish',{});expect(pub.status).toBe(200);expect(pub.body.challenge.status).toBe('open');
 expect((await f.post('/publish',{})).body.challenge.publishedAt).toBe(pub.body.challenge.publishedAt);
 expect((await f.get('')).body.challenge.successRule).toBe(f.challenge.successRule);
 expect((await request(f.app).get('/api/challenges').set('Authorization',`Bearer ${f.b.token}`)).body.challenges).toHaveLength(1);
});
it('opponent invoices require publication and reject self-bets, supporting bets, and changed amounts',async()=>{
 const f=await setup();expect((await f.post('/opponent-deposit',{amountAtomic:'2000000'},f.b.token)).status).toBe(404);
 await f.fund();await f.post('/publish',{});
 expect((await f.post('/opponent-deposit',{amountAtomic:'2000000'})).status).toBe(409);
 expect((await f.post('/opponent-deposit',{amountAtomic:'2000000',side:'yes'},f.b.token)).status).toBe(400);
 const first=await f.post('/opponent-deposit',{amountAtomic:'2000000'},f.b.token);expect(first.status).toBe(200);expect(first.body.paymentId.length).toBeLessThanOrEqual(80);
 const calls=f.calls();expect((await f.post('/opponent-deposit',{amountAtomic:'2000000'},f.b.token)).body).toEqual(first.body);expect(f.calls()).toBe(calls);
 expect((await f.post('/opponent-deposit',{amountAtomic:'3000000'},f.b.token)).status).toBe(409);
});
it('only settled opponent deposits enter the pool once and survive restart',async()=>{
 const f=await setup();await f.fund();await f.post('/publish',{});f.set(false);
 await f.post('/opponent-deposit',{amountAtomic:'2000000'},f.b.token);
 expect((await f.get('/opponent-deposit')).body.confirmedPoolAtomic).toBe('1000000');
 f.set(true);expect((await f.get('/opponent-deposit')).body.confirmedPoolAtomic).toBe('3000000');expect((await f.get('/opponent-deposit')).body.confirmedPoolAtomic).toBe('3000000');
 const second=createApp({databasePath:f.databasePath});cleanup.push(()=>second.locals.close());
 const detail=await request(second).get('/api/challenges/'+f.challenge.id).set('Authorization',`Bearer ${f.b.token}`);expect(detail.body.challenge.confirmedPoolAtomic).toBe('3000000');expect(detail.body.challenge.status).toBe('open');
});
it('cutoff blocks new bets and late receipts require review without discarding funds',async()=>{
 const f=await setup();await f.fund();await f.post('/publish',{});await f.post('/opponent-deposit',{amountAtomic:'2000000'},f.b.token);
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(Date.parse(f.challenge.bettingCutoff)+1000));
 expect((await f.post('/opponent-deposit',{amountAtomic:'1000000'})).status).toBe(409);
 expect((await f.get('/opponent-deposit')).body.status).toBe('review_required');
 const detail=(await f.get('')).body.challenge;expect(detail.confirmedPoolAtomic).toBe('3000000');expect(detail.eligiblePoolAtomic).toBe('1000000');expect(detail.reviewRequired).toBe(true);
});
it('blocks a new opponent after cutoff and keeps saved invoice access for an existing opponent',async()=>{
 const f=await setup();await f.fund();await f.post('/publish',{});const invoice=await f.post('/opponent-deposit',{amountAtomic:'2000000'},f.b.token);
 const c=(await request(f.app).post('/api/sessions').send({displayName:'Vesim'})).body;
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(Date.parse(f.challenge.bettingCutoff)+1000));
 expect((await f.post('/opponent-deposit',{amountAtomic:'1000000'},c.token)).status).toBe(409);
 expect((await f.post('/opponent-deposit',{amountAtomic:'2000000'},f.b.token)).body).toEqual(invoice.body);
 expect((await f.get('')).body.challenge.status).toBe('betting_closed');
});
it('stake amount bindings persist after restart and proof terms cannot be changed',async()=>{
 const f=await setup();await f.fund();await f.post('/publish',{});await f.post('/opponent-deposit',{amountAtomic:'2000000'},f.b.token);
 const second=createApp({databasePath:f.databasePath,stakeDeposits:f.stakes});cleanup.push(()=>second.locals.close());
 expect((await request(second).post('/api/challenges/'+f.challenge.id+'/opponent-deposit').set('Authorization',`Bearer ${f.b.token}`).send({amountAtomic:'3000000'})).status).toBe(409);
 expect((await request(second).patch('/api/challenges/'+f.challenge.id).set('Authorization',`Bearer ${f.a.token}`).send({successRule:'Change terms'})).status).toBe(404);
});
