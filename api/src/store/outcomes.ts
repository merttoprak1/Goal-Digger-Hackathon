import type {DatabaseSync} from 'node:sqlite';
import {ApiError} from '../middlewares/error-handler.js';

export function outcomes(db:DatabaseSync,now:()=>number){
 db.exec('CREATE TABLE IF NOT EXISTS challenge_outcomes(challenge_id TEXT PRIMARY KEY REFERENCES challenges(id),result TEXT NOT NULL)');
 const getOutcome=(id:string)=>{
  const row=db.prepare('SELECT result FROM challenge_outcomes WHERE challenge_id=?').get(id);
  return row?JSON.parse(String(row.result)):null;
 };
 return {getOutcome,finalizeOutcome(id:string){
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
   const hold=()=>{throw new ApiError(409,'The challenge funds need review before a final outcome.','FUNDING_REVIEW');};
   if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stake_credits'").get())hold();
   const deposits=db.prepare('SELECT d.*,c.asset_id,c.txid,c.recipient_id,c.credited_at FROM stake_deposits d LEFT JOIN stake_credits c ON c.payment_id=d.payment_id WHERE d.challenge_id=? ORDER BY d.payment_id').all(id);
   const reserved=db.prepare('SELECT * FROM opponent_stakes WHERE challenge_id=?').all(id);
   if(reserved.some(r=>!deposits.some(d=>d.payment_id===r.payment_id&&d.participant_id===r.participant_id&&d.amount===r.amount)))hold();
   const creator=deposits.find(d=>d.payment_id===`creator-${id}`&&d.participant_id===challenge.creatorId&&d.amount===challenge.creatorStakeAtomic);
   if(!creator||deposits.length<2)hold();
   for(const d of deposits){
    if(!d.credited_at||!Number.isFinite(Date.parse(String(d.credited_at)))||Date.parse(String(d.credited_at))>=Date.parse(challenge.bettingCutoff))hold();
    if(d.asset_id!=='rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0'||! /^[1-9][0-9]{0,8}$/.test(String(d.amount)))hold();
    if(d!==creator&&!reserved.some(r=>r.payment_id===d.payment_id&&r.participant_id===d.participant_id&&r.amount===d.amount&&r.participant_id!==challenge.creatorId))hold();
   }
   const stakes=deposits.map(d=>({paymentId:String(d.payment_id),participantId:String(d.participant_id),amountAtomic:String(d.amount),assetId:String(d.asset_id),txid:String(d.txid),recipientId:String(d.recipient_id),creditedAt:String(d.credited_at)}));
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
