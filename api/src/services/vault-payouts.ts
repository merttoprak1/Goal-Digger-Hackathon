import {z} from 'zod';
import {ApiError} from '../middlewares/error-handler.js';
const validationSchema=z.object({valid:z.literal(true),network:z.literal('SignetCustom'),assetId:z.string(),amountAtomic:z.string(),recipientId:z.string().startsWith('sbc:wvout:'),expirationTimestamp:z.number().int()});
export type ValidatedInvoice=z.infer<typeof validationSchema>;
export interface PayoutRequest {payoutId:string;challengeId:string;participantId:string;amountAtomic:string;invoice:string}
const payoutSchema=z.object({payoutId:z.string(),challengeId:z.string(),participantId:z.string(),amountAtomic:z.string(),invoice:z.string(),assetId:z.string(),recipientId:z.string(),expirationTimestamp:z.number().int(),status:z.literal('prepared'),createdAt:z.string().datetime()});
export type PreparedPayout=z.infer<typeof payoutSchema>;
const executionSchema=z.discriminatedUnion('status',[
 payoutSchema.extend({status:z.literal('accepted'),txid:z.string().regex(/^[a-f0-9]{64}$/),attemptedAt:z.string().datetime()}),
 payoutSchema.extend({status:z.literal('unknown'),txid:z.null(),attemptedAt:z.string().datetime()})
]);
export type ExecutedPayout=z.infer<typeof executionSchema>;
export function vaultPayouts(token:string,fetchService:typeof fetch=fetch){
 const call=async(path:string,body:unknown,allowConflict=false)=>{
  let response:Response;
  try{response=await fetchService(`http://127.0.0.1:4001/vault/payouts${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(70000)});}
  catch{throw new ApiError(503,'The vault is unavailable. Retry the same invoice.','VAULT_UNAVAILABLE');}
  if(response.status===422)throw new ApiError(422,'The invoice failed the vault checks.','INVALID_INVOICE');
  if(response.status===409&&!allowConflict)throw new ApiError(409,'The payout ID or recipient needs review.','PAYOUT_CONFLICT');
  if(!response.ok&&!(allowConflict&&response.status===409))throw new ApiError(503,'The vault request failed. Retry the same invoice.','VAULT_UNAVAILABLE');
  try{return await response.json();}catch{throw new ApiError(503,'The vault response is invalid.','VAULT_UNAVAILABLE');}
 };
 return {
  async validate(invoice:string,amountAtomic:string,assetId:string){
   const parsed=validationSchema.safeParse(await call('/validate',{invoice,amountAtomic}));
   if(!parsed.success||parsed.data.assetId!==assetId||parsed.data.amountAtomic!==amountAtomic||parsed.data.expirationTimestamp<=Math.floor(Date.now()/1000)+60)throw new ApiError(503,'The vault response does not match the award.','VAULT_UNAVAILABLE');
   return parsed.data;
  },
  async execute(saved:PreparedPayout){
   const parsed=executionSchema.safeParse(await call(`/${saved.payoutId}/execute`,{},true));
   if(!parsed.success||Object.entries(saved).some(([key,value])=>key!=='status'&&parsed.data[key as keyof PreparedPayout]!==value))throw new ApiError(503,'The vault execution response does not match the saved payout.','VAULT_UNAVAILABLE');
   return parsed.data;
  },
  async prepare(request:PayoutRequest,expected:ValidatedInvoice){
   const parsed=payoutSchema.safeParse(await call('',request));
   if(!parsed.success||Object.entries(request).some(([key,value])=>parsed.data[key as keyof PayoutRequest]!==value)||parsed.data.assetId!==expected.assetId||parsed.data.recipientId!==expected.recipientId||parsed.data.expirationTimestamp!==expected.expirationTimestamp)throw new ApiError(503,'The vault response does not match the saved request.','VAULT_UNAVAILABLE');
   return parsed.data;
  }
 };
}
