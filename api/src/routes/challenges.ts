import type {StakeDeposits} from '../../../stake-deposits.mjs';
import {Router} from 'express';
import {z} from 'zod';
import type {openSessions} from '../store/sessions.js';
import {sessionIdentity} from './sessions.js';
import {challengeDraftSchema} from '../contracts/challenge.js';
import {ApiError} from '../middlewares/error-handler.js';
export function challengeRoutes(store:ReturnType<typeof openSessions>,stakes?:StakeDeposits){
 const router=Router();
 const projection=(challenge:ReturnType<typeof store.getChallenge>)=>{
  const credits=store.listStakeCredits(challenge.id);
  const creator=credits.find(c=>c.participantId===challenge.creatorId && c.paymentId===`creator-${challenge.id}`);
  return {...challenge,confirmedPoolAtomic:credits.reduce((total,c)=>total+BigInt(c.amountAtomic),0n).toString(),
    status:creator?(Date.parse(creator.creditedAt)<Date.parse(challenge.bettingCutoff)?'funded':'funding_review'):'draft'};
 };
 router.use((req,res,next)=>{res.locals.participant=sessionIdentity(store,req.header('authorization')).participant;next();});
 router.post('/',(req,res)=>{
  const parsed=challengeDraftSchema.safeParse(req.body);
  if(!parsed.success)throw new ApiError(400,'Check the challenge terms, atomic stake, timezone, and ordered future deadlines.','INVALID_CHALLENGE');
  res.status(201).json({challenge:store.createChallenge(res.locals.participant.id,parsed.data)});
 });
 router.post('/:id/creator-deposit',async(req,res)=>{
  const challenge=store.getChallenge(res.locals.participant.id,String(req.params.id));
  if(!challenge)throw new ApiError(404,'Challenge not found.','NOT_FOUND');
  if(!req.body||Array.isArray(req.body)||typeof req.body!=='object'||Object.keys(req.body).length)throw new ApiError(400,'Send an empty JSON object. The draft sets the stake.','INVALID_DEPOSIT');
  if(!stakes)throw new ApiError(503,'The vault connection is not configured.','VAULT_UNAVAILABLE');
  const paymentId=`creator-${challenge.id}`;
  const old=stakes.getInvoice(paymentId);
  if(old){res.json(old);return;}
  if(Date.now()>=Date.parse(challenge.bettingCutoff))throw new ApiError(409,'The betting cutoff passed. Create a new draft before funding.','FUNDING_CLOSED');
  try{res.json(await stakes.bind({paymentId,challengeId:challenge.id,participantId:res.locals.participant.id,amountAtomic:challenge.creatorStakeAtomic}));}
  catch{throw new ApiError(503,'The vault deposit request failed. Retry the same challenge to check its saved invoice.','VAULT_UNAVAILABLE');}
 });
 router.get('/:id/creator-deposit',async(req,res)=>{
  const challenge=store.getChallenge(res.locals.participant.id,String(req.params.id));
  if(!challenge)throw new ApiError(404,'Challenge not found.','NOT_FOUND');
  if(!stakes)throw new ApiError(503,'The vault connection is not configured.','VAULT_UNAVAILABLE');
  const paymentId=`creator-${challenge.id}`;
  if(!stakes.getInvoice(paymentId))throw new ApiError(409,'Create the deposit invoice first.','DEPOSIT_NOT_CREATED');
  try{
   const result=await stakes.confirm(paymentId);
   const late=result.credit && Date.parse(result.credit.creditedAt)>=Date.parse(challenge.bettingCutoff);
   res.json({...result,status:late?'review_required':result.status,confirmedPoolAtomic:projection(challenge).confirmedPoolAtomic,eligibleToOpen:result.status==='credited'&&!late&&Date.now()<Date.parse(challenge.bettingCutoff)});
  }catch{throw new ApiError(503,'The vault status is unavailable. No new stake credit was confirmed.','VAULT_UNAVAILABLE');}
 });
 router.get('/',(req,res)=>{
  const parsed=z.object({limit:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).default(50),offset:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(1000000)).default(0)}).strict().safeParse(req.query);
  if(!parsed.success)throw new ApiError(400,'Use a limit of 1 to 100 and a nonnegative offset.','INVALID_PAGINATION');
  res.json({challenges:store.listChallenges(res.locals.participant.id,parsed.data.limit,parsed.data.offset).map(projection)});
 });
 router.get('/:id',(req,res)=>{
  const challenge=store.getChallenge(res.locals.participant.id,String(req.params.id));
  if(!challenge)throw new ApiError(404,'Challenge not found.','NOT_FOUND');
  res.json({challenge:projection(challenge)});
 });
 return router;
}
