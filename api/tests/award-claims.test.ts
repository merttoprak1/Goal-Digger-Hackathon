import {it,expect} from 'vitest';
import request from 'supertest';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/app.js';
import {setup,finish,cleanup} from './helpers/challenge-fixture.js';
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
