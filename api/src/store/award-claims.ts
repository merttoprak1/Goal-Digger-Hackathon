import type {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {ApiError} from '../middlewares/error-handler.js';
import type {ValidatedInvoice,PreparedPayout,PayoutRequest} from '../services/vault-payouts.js';
interface AwardPlan {assetId:string;allocations:Array<{participantId:string;amountAtomic:string}>}
interface AwardClaim extends PayoutRequest {validation:ValidatedInvoice;payout:PreparedPayout|null;createdAt:string}
export function awardClaims(db:DatabaseSync,now:()=>number,checkPlan: (id:string)=>AwardPlan){
 db.exec('CREATE TABLE IF NOT EXISTS award_claims(challenge_id TEXT NOT NULL REFERENCES challenges(id),participant_id TEXT NOT NULL REFERENCES participants(id),payout_id TEXT NOT NULL UNIQUE,recipient_id TEXT NOT NULL UNIQUE,result TEXT NOT NULL,PRIMARY KEY(challenge_id,participant_id))');
 const getAwardClaim=(id:string,participantId:string):AwardClaim|null=>{
  const row=db.prepare('SELECT result FROM award_claims WHERE challenge_id=? AND participant_id=?').get(id,participantId);
  return row?JSON.parse(String(row.result)):null;
 };
 const allocation=(id:string,participantId:string)=>{
  const plan=checkPlan(id);const award=plan.allocations.find(a=>a.participantId===participantId);
  if(!award)throw new ApiError(403,'This participant has no winning allocation.','NOT_A_WINNER');
  if(BigInt(award.amountAtomic)>100000000n)throw new ApiError(409,'This award exceeds the vault test limit of 100 USDT.','PAYOUT_LIMIT');
  return {...award,assetId:plan.assetId};
 };
 const transaction=<T>(fn:()=>T)=>{
  db.exec('BEGIN IMMEDIATE');
  try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}
 };
 return {getAwardClaim,awardAllocation:(id:string,participantId:string)=>transaction(()=>allocation(id,participantId)),
  bindAward(id:string,participantId:string,invoice:string,validation:ValidatedInvoice){return transaction(()=>{
   const award=allocation(id,participantId);const old=getAwardClaim(id,participantId);
   if(old){if(old.invoice!==invoice)throw new ApiError(409,'This award already has a different invoice.','AWARD_BOUND');return old;}
   if(validation.assetId!==award.assetId||validation.amountAtomic!==award.amountAtomic||validation.expirationTimestamp<=Math.floor(now()/1000)+60)throw new ApiError(422,'The invoice does not match the award or expired.','INVALID_INVOICE');
   if(db.prepare('SELECT payout_id FROM award_claims WHERE recipient_id=?').get(validation.recipientId))throw new ApiError(409,'This recipient already belongs to another award.','PAYOUT_CONFLICT');
   const payoutId='award-'+createHash('sha256').update(id+':'+participantId).digest('hex');
   const claim:AwardClaim={payoutId,challengeId:id,participantId,amountAtomic:award.amountAtomic,invoice,validation,payout:null,createdAt:new Date(now()).toISOString()};
   db.prepare('INSERT INTO award_claims VALUES(?,?,?,?,?)').run(id,participantId,payoutId,validation.recipientId,JSON.stringify(claim));return claim;
  });},
  completeAward(id:string,participantId:string,payout:PreparedPayout){return transaction(()=>{
   allocation(id,participantId);const old=getAwardClaim(id,participantId);
   if(!old||payout.challengeId!==id||payout.participantId!==participantId||old.validation.expirationTimestamp!==payout.expirationTimestamp||old.payoutId!==payout.payoutId||old.invoice!==payout.invoice||old.amountAtomic!==payout.amountAtomic||old.validation.recipientId!==payout.recipientId||old.validation.assetId!==payout.assetId)throw new ApiError(409,'The payout does not match the saved award.','PAYOUT_CONFLICT');
   if(old.payout)return old;
   const claim={...old,payout};db.prepare('UPDATE award_claims SET result=? WHERE challenge_id=? AND participant_id=?').run(JSON.stringify(claim),id,participantId);return claim;
  });}
 };
}
