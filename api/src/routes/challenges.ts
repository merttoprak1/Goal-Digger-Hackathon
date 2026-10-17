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
  const publishedAt=store.publication(challenge.id);
  const timely=credits.filter(c=>Date.parse(c.creditedAt)<Date.parse(challenge.bettingCutoff));
  const reviewRequired=timely.length!==credits.length;
  const funded=creator && Date.parse(creator.creditedAt)<Date.parse(challenge.bettingCutoff);
  const open=Date.now()<Date.parse(challenge.bettingCutoff);
  const outcome=store.getOutcome(challenge.id);
  return {...challenge,publishedAt,reviewRequired,outcome,
    confirmedPoolAtomic:credits.reduce((total,c)=>total+BigInt(c.amountAtomic),0n).toString(),
    eligiblePoolAtomic:timely.reduce((total,c)=>total+BigInt(c.amountAtomic),0n).toString(),
    status:reviewRequired?'funding_review':outcome?(outcome.status==='success'?'succeeded':'failed'):publishedAt?(open?'open':'betting_closed'):funded?'funded':'draft'};
 };
 router.use((req,res,next)=>{res.locals.participant=sessionIdentity(store,req.header('authorization')).participant;next();});
 router.post('/',(req,res)=>{
  const parsed=challengeDraftSchema.safeParse(req.body);
  if(!parsed.success)throw new ApiError(400,'Check the challenge terms, atomic stake, timezone, and ordered future deadlines.','INVALID_CHALLENGE');
  res.status(201).json({challenge:projection(store.createChallenge(res.locals.participant.id,parsed.data))});
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
 const ownedMath=(participantId:string,id:string)=>{
  const challenge=store.getChallenge(participantId,id);
  if(!challenge)throw new ApiError(404,'Challenge not found.','NOT_FOUND');
  if(challenge.template!=='wake_up'||challenge.proofMethod!=='timed_math')throw new ApiError(409,'This challenge does not use timed math proof.','WRONG_PROOF_METHOD');
  return challenge;
 };
 const proofWindow=(challenge:ReturnType<typeof store.getChallenge>)=>{
  const view=projection(challenge);
  if(!view.publishedAt||view.reviewRequired)throw new ApiError(409,'The challenge must be published and free from funding review.','PROOF_BLOCKED');
  if(Date.now()<Date.parse(challenge.startsAt)||Date.now()>=Date.parse(challenge.proofDeadline))throw new ApiError(409,'The proof window is not open.','PROOF_WINDOW_CLOSED');
 };
 router.post('/:id/math/problem',(req,res)=>{
  const challenge=ownedMath(res.locals.participant.id,String(req.params.id));
  if(!req.body||Array.isArray(req.body)||typeof req.body!=='object'||Object.keys(req.body).length)throw new ApiError(400,'Send an empty JSON object.','INVALID_PROBLEM');
  proofWindow(challenge);
  if(store.mathAccepted(challenge.id))throw new ApiError(409,'This challenge already has an accepted proof.','PROOF_ACCEPTED');
  const problem=store.createMathProblem(challenge.id);
  res.json({problem:{...problem,expiresAt:challenge.proofDeadline}});
 });
 router.post('/:id/math/submit',(req,res)=>{
  const challenge=ownedMath(res.locals.participant.id,String(req.params.id));
  const parsed=z.object({problemId:z.string().min(1).max(80),answer:z.string().regex(/^-?\d{1,6}$/)}).strict().safeParse(req.body);
  if(!parsed.success)throw new ApiError(400,'Send only problemId and an integer answer string.','INVALID_ANSWER');
  const previous=store.getMathReceipt(challenge.id,parsed.data.problemId);
  if(previous){
   if(previous.answer!==parsed.data.answer)throw new ApiError(409,'This problem already has a submitted answer.','PROBLEM_USED');
   res.json({proof:previous.proof});return;
  }
  proofWindow(challenge);
  res.json({proof:store.submitMath(challenge.id,parsed.data.problemId,parsed.data.answer)});
 });
 router.get('/:id/proofs',(req,res)=>{
  const challenge=ownedMath(res.locals.participant.id,String(req.params.id));
  res.json({proofs:store.listMathProofs(challenge.id),accepted:store.mathAccepted(challenge.id)});
 });
 router.post('/:id/finalize',(req,res)=>{
  if(!store.getPublished(String(req.params.id)))throw new ApiError(404,'Published challenge not found.','NOT_FOUND');
  if(!z.object({}).strict().safeParse(req.body).success)throw new ApiError(400,'Send an empty JSON object.','INVALID_OUTCOME');
  res.json({outcome:store.finalizeOutcome(String(req.params.id))});
 });
 router.get('/:id/outcome',(req,res)=>{
  if(!store.getPublished(String(req.params.id)))throw new ApiError(404,'Published challenge not found.','NOT_FOUND');
  res.json({outcome:store.getOutcome(String(req.params.id))});
 });
 router.post('/:id/close-betting',(req,res)=>{
  if(!store.getPublished(String(req.params.id)))throw new ApiError(404,'Published challenge not found.','NOT_FOUND');
  if(!z.object({}).strict().safeParse(req.body).success)throw new ApiError(400,'Send an empty JSON object.','INVALID_SNAPSHOT');
  res.json({snapshot:store.closeBetting(String(req.params.id))});
 });
 router.get('/:id/betting-snapshot',(req,res)=>{
  if(!store.getPublished(String(req.params.id)))throw new ApiError(404,'Published challenge not found.','NOT_FOUND');
  res.json({snapshot:store.getBettingSnapshot(String(req.params.id))});
 });
 router.post('/:id/payout-plan',(req,res)=>{
  if(!store.getPublished(String(req.params.id)))throw new ApiError(404,'Published challenge not found.','NOT_FOUND');
  if(!z.object({}).strict().safeParse(req.body).success)throw new ApiError(400,'Send an empty JSON object.','INVALID_PAYOUT_PLAN');
  res.json({plan:store.createPayoutPlan(String(req.params.id))});
 });
 router.get('/:id/payout-plan',(req,res)=>{
  if(!store.getPublished(String(req.params.id)))throw new ApiError(404,'Published challenge not found.','NOT_FOUND');
  res.json({plan:store.getPayoutPlan(String(req.params.id))});
 });
 router.post('/:id/publish',(req,res)=>{
  const challenge=store.getChallenge(res.locals.participant.id,String(req.params.id));
  if(!challenge)throw new ApiError(404,'Challenge not found.','NOT_FOUND');
  if(!req.body||Array.isArray(req.body)||typeof req.body!=='object'||Object.keys(req.body).length)throw new ApiError(400,'Send an empty JSON object.','INVALID_PUBLICATION');
  if(store.publication(challenge.id)){res.json({challenge:projection(challenge)});return;}
  if(projection(challenge).status!=='funded'||Date.now()>=Date.parse(challenge.bettingCutoff))throw new ApiError(409,'Confirm the creator stake before publishing and before the betting cutoff.','PUBLICATION_BLOCKED');
  store.publish(challenge.id);res.json({challenge:projection(challenge)});
 });
 router.post('/:id/opponent-deposit',async(req,res)=>{
  const challenge=store.getPublished(String(req.params.id));
  if(!challenge)throw new ApiError(404,'Published challenge not found.','NOT_FOUND');
  const participantId=res.locals.participant.id;
  if(participantId===challenge.creatorId)throw new ApiError(409,'The creator cannot bet against this challenge.','SELF_BET');
  const parsed=z.object({amountAtomic:z.string().regex(/^[1-9][0-9]{0,8}$/).refine(v=>/^[1-9][0-9]{0,8}$/.test(v)&&BigInt(v)<=100000000n)}).strict().safeParse(req.body);
  if(!parsed.success)throw new ApiError(400,'Send only a positive amountAtomic string. The test limit is 100 USDT.','INVALID_STAKE');
  if(!stakes)throw new ApiError(503,'The vault connection is not configured.','VAULT_UNAVAILABLE');
  let binding:{paymentId:string;amountAtomic:string}|null=store.getOpponentStake(challenge.id,participantId);
  if(binding&&binding.amountAtomic!==parsed.data.amountAtomic)throw new ApiError(409,'This participant already has a different stake amount.','STAKE_CONFLICT');
  const old=binding?stakes.getInvoice(binding.paymentId):null;
  if(old){res.json(old);return;}
  if(projection(challenge).status!=='open')throw new ApiError(409,'Betting is closed or the challenge needs review.','BETTING_CLOSED');
  binding=store.bindOpponentStake(challenge.id,participantId,parsed.data.amountAtomic);
  if(binding.amountAtomic!==parsed.data.amountAtomic)throw new ApiError(409,'The saved stake has a different amount.','STAKE_CONFLICT');
  try{res.json(await stakes.bind({paymentId:binding.paymentId,amountAtomic:binding.amountAtomic,challengeId:challenge.id,participantId}));}
  catch{throw new ApiError(503,'The opponent invoice request is unavailable. Retry this same stake.','VAULT_UNAVAILABLE');}
 });
 router.get('/:id/opponent-deposit',async(req,res)=>{
  const challenge=store.getPublished(String(req.params.id));
  if(!challenge)throw new ApiError(404,'Published challenge not found.','NOT_FOUND');
  if(!stakes)throw new ApiError(503,'The vault connection is not configured.','VAULT_UNAVAILABLE');
  const binding=store.getOpponentStake(challenge.id,res.locals.participant.id);
  if(!binding||!stakes.getInvoice(binding.paymentId))throw new ApiError(409,'Create an opponent invoice first.','DEPOSIT_NOT_CREATED');
  try{
   const result=await stakes.confirm(binding.paymentId);
   const late=result.credit&&Date.parse(result.credit.creditedAt)>=Date.parse(challenge.bettingCutoff);
   const view=projection(challenge);
   res.json({...result,status:late?'review_required':result.status,confirmedPoolAtomic:view.confirmedPoolAtomic,eligiblePoolAtomic:view.eligiblePoolAtomic});
  }catch{throw new ApiError(503,'The opponent deposit status is unavailable.','VAULT_UNAVAILABLE');}
 });
 router.get('/',(req,res)=>{
  const parsed=z.object({limit:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).default(50),offset:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(1000000)).default(0)}).strict().safeParse(req.query);
  if(!parsed.success)throw new ApiError(400,'Use a limit of 1 to 100 and a nonnegative offset.','INVALID_PAGINATION');
  res.json({challenges:store.listChallenges(res.locals.participant.id,parsed.data.limit,parsed.data.offset).map(projection)});
 });
 router.get('/:id',(req,res)=>{
  const challenge=store.getChallenge(res.locals.participant.id,String(req.params.id))??store.getPublished(String(req.params.id));
  if(!challenge)throw new ApiError(404,'Challenge not found.','NOT_FOUND');
  res.json({challenge:projection(challenge)});
 });
 return router;
}
