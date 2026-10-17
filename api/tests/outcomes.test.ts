import {afterEach,it,expect,vi} from 'vitest';
import request from 'supertest';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../src/app.js';
import {openStakeDeposits} from '../../stake-deposits.mjs';
const cleanup:Array<()=>void>=[];afterEach(()=>{vi.useRealTimers();for(const f of cleanup.splice(0).reverse())f();});
async function setup(template='wake_up'){
 const dir=mkdtempSync(join(tmpdir(),'outcomes-'));cleanup.push(()=>rmSync(dir,{recursive:true}));const databasePath=join(dir,'api.sqlite');const invoices=new Map<string,Record<string,unknown>>();let settled=true;
 const stakes=openStakeDeposits({databasePath,token:'secret',fetchService:async(url,init)=>{const body=init?.body?JSON.parse(String(init.body)):null;const id=body?.paymentId??String(url).split('/').at(-1)!;if(body)invoices.set(id,{paymentId:id,amountAtomic:body.amountAtomic,assetId:'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0',invoice:'rgb:'+id,recipientId:'sbc:wvout:'+id,status:'awaiting_payment',expirationTimestamp:Date.now()/1000+3600});return Response.json({...invoices.get(id),status:body?'awaiting_payment':settled?'settled':'pending',txid:'a'.repeat(64)});}});cleanup.push(()=>stakes.close());
 const app=createApp({databasePath,stakeDeposits:stakes});cleanup.push(()=>app.locals.close());const a=(await request(app).post('/api/sessions').send({displayName:'Mert'})).body;const b=(await request(app).post('/api/sessions').send({displayName:'Ege'})).body;
 const starts=Date.now()+3600000;const deadline=starts+600000;const challenge=(await request(app).post('/api/challenges').set('Authorization',`Bearer ${a.token}`).send({template,title:'Wake up',successRule:'Solve the fresh problem',proofMethod:template==='wake_up'?'timed_math':'official_result',proofSource:'Server response and timestamp',timezone:'Europe/Rome',bettingCutoff:new Date(starts-60000).toISOString(),startsAt:new Date(starts).toISOString(),proofDeadline:new Date(deadline).toISOString(),creatorStakeAtomic:'1000000'})).body.challenge;
 const base='/api/challenges/'+challenge.id;const post=(path:string,body:unknown={},token=a.token)=>request(app).post(base+path).set('Authorization',`Bearer ${token}`).send(body);const get=(path:string,token=a.token)=>request(app).get(base+path).set('Authorization',`Bearer ${token}`);
 await post('/creator-deposit');await get('/creator-deposit');await post('/publish');
 const opponent=async()=>{await post('/opponent-deposit',{amountAtomic:'2000000'},b.token);await get('/opponent-deposit',b.token);};
 const time=(t:number)=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(t);};
 return {app,databasePath,a,b,base,post,get,opponent,time,starts,deadline,set:(v:boolean)=>{settled=v;}};
}
it('saves success after the deadline from an accepted proof, with an immutable exact pool snapshot',async()=>{
 const f=await setup();await f.opponent();f.time(f.starts);const problem=(await f.post('/math/problem')).body.problem;await f.post('/math/submit',{problemId:problem.id,answer:String(problem.left+problem.right)});
 expect((await f.post('/finalize')).status).toBe(409);f.time(f.deadline);
 const response=await f.post('/finalize');expect(response.status).toBe(200);expect(response.body.outcome.status).toBe('success');expect(response.body.outcome.poolAtomic).toBe('3000000');expect(response.body.outcome.proofId).toBe(problem.id);expect(response.body.outcome.stakes).toHaveLength(2);
 expect((await f.post('/finalize',{},f.b.token)).body).toEqual(response.body);
 const second=createApp({databasePath:f.databasePath});cleanup.push(()=>second.locals.close());expect((await request(second).get(f.base+'/outcome').set('Authorization',`Bearer ${f.b.token}`)).body).toEqual(response.body);
});
it('saves failure for missing or rejected proof only after the deadline',async()=>{
 const f=await setup();await f.opponent();expect((await f.get('/outcome')).body.outcome).toBeNull();expect((await f.post('/finalize',{status:'success'})).status).toBe(400);
 f.time(f.starts);const problem=(await f.post('/math/problem')).body.problem;await f.post('/math/submit',{problemId:problem.id,answer:'0'});f.time(f.deadline);
 const result=await f.post('/finalize');expect(result.body.outcome.status).toBe('failure');expect(result.body.outcome.proofId).toBeNull();expect((await f.get('')).body.challenge.status).toBe('failed');
});
it('holds finalization for no opponents, unresolved invoices, or late credits',async()=>{
 const f=await setup();f.time(f.deadline);expect((await f.post('/finalize')).status).toBe(409);
 f.time(f.starts-120000);f.set(false);await f.opponent();f.time(f.deadline);expect((await f.post('/finalize')).status).toBe(409);
 f.set(true);await f.get('/opponent-deposit',f.b.token);expect((await f.post('/finalize')).status).toBe(409);expect((await f.get('/outcome')).body.outcome).toBeNull();
});
it('requires a participant session and allows only published challenges to expose outcomes',async()=>{
 const f=await setup();expect((await request(f.app).get(f.base+'/outcome')).status).toBe(401);
 expect((await request(f.app).post('/api/challenges/missing/finalize').set('Authorization',`Bearer ${f.a.token}`).send({})).status).toBe(404);
});

it('records failure when the creator sends no proof',async()=>{
 const f=await setup();await f.opponent();f.time(f.deadline);
 const responses=await Promise.all([f.post('/finalize'),f.post('/finalize',{},f.b.token)]);
 expect(responses[0].status).toBe(200);expect(responses[1].body).toEqual(responses[0].body);
 expect(responses[0].body.outcome).toMatchObject({status:'failure',proofId:null,poolAtomic:'3000000'});
});
it('does not decide official results with timed math rules',async()=>{
 const f=await setup('exam');await f.opponent();f.time(f.deadline);
 expect((await f.post('/finalize')).status).toBe(409);expect((await f.get('/outcome')).body.outcome).toBeNull();
});
