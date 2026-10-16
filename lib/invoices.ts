import {z} from 'zod';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Use a valid date');
export const issuerSchema=z.object({branch:z.enum(['BHB','111']),name:z.string().trim().min(1).max(200),address:z.string().trim().min(1).max(2000),trn:z.string().regex(/^\d{15}$/,'Supplier TRN must be 15 digits'),email:z.union([z.literal(''),z.string().email()]).default(''),phone:z.string().max(80).default(''),autoFrom:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/,'Use a valid date').default('')});
export const invoiceSchema=z.object({officeId:z.string().min(1),paymentId:z.string().nullable().default(null),issueDate:date,supplyDate:date,buyerName:z.string().trim().min(1).max(200),buyerAddress:z.string().trim().min(1).max(2000),buyerTrn:z.string().regex(/^$|^\d{15}$/,'Tenant TRN must be 15 digits').default(''),description:z.string().trim().min(1).max(2000),quantity:z.coerce.number().finite().positive().max(1e6),unitPrice:z.coerce.number().finite().min(0).max(1e11),discount:z.coerce.number().finite().min(0).max(1e11),vatRate:z.coerce.number().finite().min(0).max(100),notes:z.string().max(4000).default('')}).superRefine((d,c)=>{if(d.discount>d.quantity*d.unitPrice)c.addIssue({code:'custom',path:['discount'],message:'Discount cannot exceed the line amount'});if(d.quantity*d.unitPrice<=0)c.addIssue({code:'custom',message:'Invoice must have a positive line amount'});});
export const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function invoiceTotals(d:{quantity:number;unitPrice:number;discount:number;vatRate:number}){const gross=round(d.quantity*d.unitPrice),net=round(gross-d.discount),vat=round(net*d.vatRate/100);return {gross,net,vat,total:round(net+vat)};}
// Numbers run per branch and year without gaps (number); invoices issued before that keep their old sequence (seq).
export function invoiceNumber(i:{seq:number;number?:number;branch:string;issueDate:string}){return i.branch+'-'+i.issueDate.slice(0,4)+'-'+String(i.number??i.seq).padStart(6,'0');}
// Automatic invoices are only for money received: an income payment with an amount, on a current lease, cleared on
// or after the branch's go-live date ("Issue invoices automatically from" with your company details in Accounts). Off when unset.
export const receivedForInvoice=(p:{direction:string;amount:number;officeId:string|null;leaseId?:string|null;status:string;actual?:string},from:string)=>!!from&&p.direction==='Income'&&p.amount>0&&!!p.officeId&&!p.leaseId&&p.status==='Cleared'&&!!p.actual&&p.actual>=from;
// Why a received payment is not invoiced automatically ('' when it can be). The server and the Accounts count share it.
// vat: its VAT does not match the lease rate. hand: the lease has an invoice made by hand in its current term, so the
// rest of that lease is invoiced by hand too (no guessing which payments a hand-made invoice covers).
export function autoInvoiceBlock(p:{officeId:string|null;amount:number;vatAmount?:number},office:{vat?:number;start?:string;end?:string}|undefined,invoices:{paymentId?:string|null;officeId?:string;supplyDate?:string;issueDate?:string}[]):''|'vat'|'hand'{
 if(!office)return 'hand';const expected=Math.round(p.amount*(Number(office.vat)||0))/100;if(Math.abs(expected-(p.vatAmount||0))>0.01)return 'vat';
 const when=(i:{supplyDate?:string;issueDate?:string})=>i.supplyDate||i.issueDate||'';
 return invoices.some(i=>!i.paymentId&&i.officeId===p.officeId&&!!office.start&&!!office.end&&when(i)>=office.start&&when(i)<=office.end)?'hand':'';
}
// An invoice whose payment bounced or was cancelled, for the same office and amount: the replacement payment takes it
// over instead of getting a second invoice for the same rent.
export function invoiceToReuse<I extends {id:string;paymentId?:string|null;officeId?:string;totals?:{net:number}}>(p:{id:string;officeId:string|null;amount:number},invoices:I[],statusOf:(paymentId:string)=>string|undefined){return invoices.find(i=>i.officeId===p.officeId&&!!i.paymentId&&i.paymentId!==p.id&&Math.abs((i.totals?.net||0)-p.amount)<0.01&&['Bounced','Cancelled'].includes(statusOf(i.paymentId)||''))}
