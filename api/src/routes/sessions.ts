import {Router} from 'express';
import {z} from 'zod';
import {ApiError} from '../middlewares/error-handler.js';
import type {openSessions} from '../store/sessions.js';
export function sessionRoutes(store:ReturnType<typeof openSessions>){
 const router=Router();
 const schema=z.object({displayName:z.string().trim().min(1).max(60).refine(name=>![...name].some(char=>char.charCodeAt(0)<32 || char.charCodeAt(0)===127))}).strict();
 router.post('/sessions',(req,res)=>{
  const parsed=schema.safeParse(req.body);
  if(!parsed.success)throw new ApiError(400,'Send only a displayName with 1 to 60 characters.','INVALID_PARTICIPANT');
  res.status(201).json(store.create(parsed.data.displayName));
 });
 function identity(header:string|undefined){
  const token=/^Bearer ([a-f0-9]{64})$/.exec(header??'')?.[1];
  const participant=token?store.find(token):null;
  if(!token||!participant)throw new ApiError(401,'A valid participant session is required.','UNAUTHORIZED');
  return {token,participant};
 }
 router.get('/me',(req,res)=>{res.json({participant:identity(req.header('authorization')).participant});});
 router.delete('/sessions/current',(req,res)=>{store.revoke(identity(req.header('authorization')).token);res.status(204).end();});
 return router;
}
