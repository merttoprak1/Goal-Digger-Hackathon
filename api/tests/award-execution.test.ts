import {it,expect} from 'vitest';
import request from 'supertest';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/app.js';
import {setup,finish,cleanup} from './helpers/challenge-fixture.js';
async function prepared(){const f=await setup();await finish(f);await f.post('/payout-request',{invoice:'rgb:ege'},f.b.token);return f;}
it('requires a session, an empty body, the winning identity, and a prepared claim',async()=>{
 const f=await setup();await finish(f);
 expect((await request(f.app).post(f.base+'/payout-execution').send({})).status).toBe(401);
 expect((await request(f.app).get(f.base+'/payout-execution')).status).toBe(401);
 expect((await f.post('/payout-execution',{amountAtomic:'1'},f.b.token)).status).toBe(400);
 expect((await f.post('/payout-execution',{},f.a.token)).status).toBe(403);
 expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(409);
 expect((await f.get('/payout-execution',f.b.token)).body.execution).toBeNull();expect(f.control.sends).toBe(0);
});
it('journals before the vault call and returns one accepted transaction for concurrent retries',async()=>{
 const f=await prepared();
 f.control.duringExecution=()=>{const db=new DatabaseSync(f.databasePath);const row=db.prepare('SELECT result FROM award_executions').get()!;expect(JSON.parse(String(row.result)).status).toBe('unknown');db.close();};
 const results=await Promise.all([f.post('/payout-execution',{},f.b.token),f.post('/payout-execution',{},f.b.token)]);
 expect(results.map(r=>r.status)).toEqual([200,200]);expect(results[0].body).toEqual(results[1].body);
 expect(results[0].body.execution).toMatchObject({status:'accepted',txid:'b'.repeat(64)});expect(f.control.sends).toBe(1);
 expect((await f.get('/payout-execution',f.b.token)).body).toEqual(results[0].body);
 expect((await f.get('/payout-execution',f.a.token)).body.execution).toBeNull();
 const app=createApp({databasePath:f.databasePath,payoutVault:f.payoutVault});cleanup.push(()=>app.locals.close());
 expect((await request(app).post(f.base+'/payout-execution').set('Authorization',`Bearer ${f.b.token}`).send({})).body).toEqual(results[0].body);expect(f.control.sends).toBe(1);
});
it('recovers a lost accepted response after restart through the same vault payout ID',async()=>{
 const f=await prepared();f.control.executionLost=true;
 expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(503);
 expect((await f.get('/payout-execution',f.b.token)).body.execution.status).toBe('unknown');
 f.control.executionLost=false;const app=createApp({databasePath:f.databasePath,payoutVault:f.payoutVault});cleanup.push(()=>app.locals.close());
 const result=await request(app).post(f.base+'/payout-execution').set('Authorization',`Bearer ${f.b.token}`).send({});
 expect(result.status).toBe(200);expect(result.body.execution.status).toBe('accepted');expect(f.control.sends).toBe(1);
 const calls=f.calls.filter(c=>c.path.endsWith('/execute'));expect(calls).toHaveLength(2);expect(calls[0].path).toBe(calls[1].path);expect(calls.every(c=>JSON.stringify(c.body)==='{}')).toBe(true);
});
it('keeps uncertain vault attempts unknown without another transfer',async()=>{
 const f=await prepared();f.control.executionUnknown=true;
 expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(409);
 f.control.executionUnknown=false;
 expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(409);
 expect((await f.get('/payout-execution',f.b.token)).body.execution).toMatchObject({status:'unknown',txid:null});expect(f.control.sends).toBe(1);
});
it('rejects mismatched execution receipts without recording acceptance',async()=>{
 const f=await prepared();f.control.executionMismatch=true;
 expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(503);
 expect((await f.get('/payout-execution',f.b.token)).body.execution.status).toBe('unknown');
 f.control.executionMismatch=false;expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(200);expect(f.control.sends).toBe(1);
});
it('blocks changed funds before an execution request reaches the vault',async()=>{
 const f=await prepared();const db=new DatabaseSync(f.databasePath);db.prepare('DELETE FROM stake_credits WHERE payment_id LIKE ?').run('creator-%');db.close();
 expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(409);expect(f.control.sends).toBe(0);
 expect(f.calls.filter(c=>c.path.endsWith('/execute'))).toHaveLength(0);expect((await f.get('/payout-execution',f.b.token)).body.execution).toBeNull();
});
it('does not record acceptance when the vault rejects an expired invoice',async()=>{
 const f=await prepared();f.control.executionReject=true;
 expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(422);expect(f.control.sends).toBe(0);
 expect((await f.get('/payout-execution',f.b.token)).body.execution.status).toBe('unknown');
});
it('keeps an accepted receipt even if funds change while the vault call runs',async()=>{
 const f=await prepared();f.control.duringExecution=()=>{const db=new DatabaseSync(f.databasePath);db.prepare('DELETE FROM stake_credits WHERE payment_id LIKE ?').run('creator-%');db.close();};
 expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(200);
 expect((await f.get('/payout-execution',f.b.token)).body.execution.status).toBe('accepted');
 expect((await f.post('/payout-execution',{},f.b.token)).status).toBe(409);expect(f.control.sends).toBe(1);
});
