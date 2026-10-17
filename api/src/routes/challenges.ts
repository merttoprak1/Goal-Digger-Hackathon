import {Router} from 'express';
import {z} from 'zod';
import type {openSessions} from '../store/sessions.js';
import {sessionIdentity} from './sessions.js';
import {challengeDraftSchema} from '../contracts/challenge.js';
import {ApiError} from '../middlewares/error-handler.js';
export function challengeRoutes(store:ReturnType<typeof openSessions>){
 const router=Router();
 router.use((req,res,next)=>{res.locals.participant=sessionIdentity(store,req.header('authorization')).participant;next();});
 router.post('/',(req,res)=>{
  const parsed=challengeDraftSchema.safeParse(req.body);
  if(!parsed.success)throw new ApiError(400,'Check the challenge terms, atomic stake, timezone, and ordered future deadlines.','INVALID_CHALLENGE');
  res.status(201).json({challenge:store.createChallenge(res.locals.participant.id,parsed.data)});
 });
 router.get('/',(req,res)=>{
  const parsed=z.object({limit:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).default(50),offset:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(1000000)).default(0)}).strict().safeParse(req.query);
  if(!parsed.success)throw new ApiError(400,'Use a limit of 1 to 100 and a nonnegative offset.','INVALID_PAGINATION');
  res.json({challenges:store.listChallenges(res.locals.participant.id,parsed.data.limit,parsed.data.offset)});
 });
 router.get('/:id',(req,res)=>{
  const challenge=store.getChallenge(res.locals.participant.id,String(req.params.id));
  if(!challenge)throw new ApiError(404,'Challenge not found.','NOT_FOUND');
  res.json({challenge});
 });
 return router;
}
