import {afterEach,it,expect} from 'vitest';
import request from 'supertest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.js';
const cleanup:Array<()=>void>=[];
afterEach(()=>{for(const f of cleanup.splice(0).reverse())f();});
async function setup(){const dir=mkdtempSync(join(tmpdir(),'challenge-api-'));cleanup.push(()=>rmSync(dir,{recursive:true}));const databasePath=join(dir,'api.sqlite');const app=createApp({databasePath});cleanup.push(()=>app.locals.sessionStore.close());const a=await request(app).post('/api/sessions').send({displayName:'Mert'});const b=await request(app).post('/api/sessions').send({displayName:'Ege'});return {app,databasePath,a:a.body,b:b.body};}
function draft(){const start=Date.now()+3600000;return {template:'wake_up',title:'Respond at 7',successRule:'Solve the fresh math problem during the agreed window',proofMethod:'timed_math',proofSource:'Server-recorded answer and submission time',timezone:'Europe/Rome',bettingCutoff:new Date(start-60000).toISOString(),startsAt:new Date(start).toISOString(),proofDeadline:new Date(start+600000).toISOString(),creatorStakeAtomic:'1000000'};}
it('creates a draft owned by the session with exact saved proof terms and no funded pool',async()=>{
 const {app,a}=await setup();const input=draft();const result=await request(app).post('/api/challenges').set('Authorization',`Bearer ${a.token}`).send(input);
 expect(result.status).toBe(201);expect(result.body.challenge).toMatchObject({...input,creatorId:a.participant.id,status:'draft',confirmedPoolAtomic:'0'});expect(result.body.challenge.id).toMatch(/^[a-f0-9-]{36}$/);expect(result.body.challenge.createdAt).toBeTruthy();
 const read=await request(app).get('/api/challenges/'+result.body.challenge.id).set('Authorization',`Bearer ${a.token}`);expect(read.body).toEqual(result.body);
});
it('requires sessions and prevents other participants from reading private drafts',async()=>{
 const {app,a,b}=await setup();expect((await request(app).post('/api/challenges').send(draft())).status).toBe(401);expect((await request(app).get('/api/challenges')).status).toBe(401);
 const saved=await request(app).post('/api/challenges').set('Authorization',`Bearer ${a.token}`).send(draft());
 expect((await request(app).get('/api/challenges/'+saved.body.challenge.id).set('Authorization',`Bearer ${b.token}`)).status).toBe(404);
 expect((await request(app).get('/api/challenges').set('Authorization',`Bearer ${b.token}`)).body.challenges).toEqual([]);
 expect((await request(app).get('/api/challenges').set('Authorization',`Bearer ${a.token}`)).body.challenges).toHaveLength(1);
});
it('rejects invalid terms, amounts, timezones, dates, and supplied authority fields',async()=>{
 const {app,a}=await setup();const input=draft();
 for(const change of [{creatorId:'other'},{status:'open'},{confirmedPoolAtomic:'1000000'},{title:'a'},{successRule:''},{proofSource:''},{timezone:'bad/time'},{creatorStakeAtomic:1000000},{creatorStakeAtomic:'0'},{creatorStakeAtomic:'abc'},{creatorStakeAtomic:'1.5'},{creatorStakeAtomic:'100000001'},{template:'unknown'},{proofMethod:'unknown'},{startsAt:'2026-01-01T00:00:00'},{bettingCutoff:new Date(Date.now()-1).toISOString()},{bettingCutoff:input.proofDeadline},{proofDeadline:input.startsAt}]){
  const response=await request(app).post('/api/challenges').set('Authorization',`Bearer ${a.token}`).send({...input,...change});expect(response.status,JSON.stringify(change)).toBe(400);
 }
 expect((await request(app).get('/api/challenges').set('Authorization',`Bearer ${a.token}`)).body.challenges).toEqual([]);
});
it('persists drafts across restart and bounds list queries',async()=>{
 const {app,a,databasePath}=await setup();const saved=await request(app).post('/api/challenges').set('Authorization',`Bearer ${a.token}`).send(draft());
 const second=createApp({databasePath});cleanup.push(()=>second.locals.sessionStore.close());
 expect((await request(second).get('/api/challenges/'+saved.body.challenge.id).set('Authorization',`Bearer ${a.token}`)).body).toEqual(saved.body);
 expect((await request(second).get('/api/challenges?limit=1&offset=0').set('Authorization',`Bearer ${a.token}`)).body.challenges).toHaveLength(1);
 for(const query of ['limit=0','limit=101','offset=-1','limit=abc'])expect((await request(second).get('/api/challenges?'+query).set('Authorization',`Bearer ${a.token}`)).status).toBe(400);
});
it('supports all four templates with matching proof methods only',async()=>{
 const {app,a}=await setup();
 for(const [template,proofMethod] of [['wake_up','timed_math'],['exam','official_result'],['run','activity_record'],['custom','custom']]){
  expect((await request(app).post('/api/challenges').set('Authorization',`Bearer ${a.token}`).send({...draft(),template,proofMethod})).status).toBe(201);
 }
 expect((await request(app).post('/api/challenges').set('Authorization',`Bearer ${a.token}`).send({...draft(),template:'exam'})).status).toBe(400);
});
