export interface StakeCredit {paymentId:string;challengeId:string;participantId:string;amountAtomic:string;assetId:string;txid:string;recipientId:string;creditedAt:string}
export interface DepositInvoice {paymentId:string;assetId:string;amountAtomic:string;invoice:string;recipientId:string;expirationTimestamp:number;status:string;fresh?:boolean}
export interface StakeDeposits {
 health():Promise<boolean>;
 bind(binding:{paymentId:string;challengeId:string;participantId:string;amountAtomic:string}):Promise<DepositInvoice>;
 confirm(paymentId:string):Promise<{status:string;newlyCredited:boolean;credit:StakeCredit|null}>;
 getInvoice(paymentId:string):DepositInvoice|null;
 listCredits(challengeId:string):StakeCredit[];
 close():void;
}
export function openStakeDeposits(options:{databasePath:string;token:string;fetchService?:typeof fetch}):StakeDeposits;
