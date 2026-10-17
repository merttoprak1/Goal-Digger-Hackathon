import type {DatabaseSync} from 'node:sqlite';
import {ApiError} from '../middlewares/error-handler.js';
import {bettingBook} from './betting.js';
import {payoutPlans} from './payout-plans.js';

export function outcomes(db:DatabaseSync,now:()=>number){
 db.exec('CREATE TABLE IF NOT EXISTS challenge_outcomes(challenge_id TEXT PRIMARY KEY REFERENCES challenges(id),result TEXT NOT NULL)');
 const book=bettingBook(db,now);
 const getOutcome=(id:string)=>{
  const row=db.prepare('SELECT result FROM challenge_outcomes WHERE challenge_id=?').get(id);
  return row?JSON.parse(String(row.result)):null;
 };
 return {getOutcome,getBettingSnapshot:book.getBettingSnapshot,closeBetting:book.closeBetting,...payoutPlans(db,now,book,getOutcome),finalizeOutcome(id:string){
  db.exec('BEGIN IMMEDIATE');
  try{
   const previous=getOutcome(id);
   if(previous){db.exec('COMMIT');return previous;}
   const row=db.prepare('SELECT c.result FROM challenges c JOIN publications p ON p.challenge_id=c.id WHERE c.id=?').get(id);
   if(!row)throw new ApiError(404,'Published challenge not found.','NOT_FOUND');
   const challenge=JSON.parse(String(row.result));
   if(challenge.template!=='wake_up'||challenge.proofMethod!=='timed_math')throw new ApiError(409,'This challenge does not use timed math proof.','WRONG_PROOF_METHOD');
   const finalizedAt=now();
   if(finalizedAt<Date.parse(challenge.proofDeadline))throw new ApiError(409,'The proof deadline has not passed.','PROOF_WINDOW_OPEN');
   const snapshot=book.sealInsideTransaction(id);
   const stakes=snapshot.stakes;
   const proof=db.prepare("SELECT id,result FROM math_problems WHERE challenge_id=? AND json_extract(result,'$.status')='accepted'").all(id).find(p=>{
    const receipt=JSON.parse(String(p.result));const submittedAt=Date.parse(receipt.submittedAt);
    return submittedAt>=Date.parse(challenge.startsAt)&&submittedAt<Date.parse(challenge.proofDeadline);
   });
   const outcome={challengeId:id,status:proof?'success':'failure',proofId:proof?String(proof.id):null,poolAtomic:stakes.reduce((total,s)=>total+BigInt(s.amountAtomic),0n).toString(),stakes,finalizedAt:new Date(finalizedAt).toISOString()};
   db.prepare('INSERT INTO challenge_outcomes VALUES(?,?)').run(id,JSON.stringify(outcome));
   db.exec('COMMIT');return outcome;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }};
}
