import {issuerSchema,invoiceSchema,invoiceTotals} from './invoices';
import {today} from './records';
// Tax invoices: the one place that checks and saves an invoice (Accounts > Create invoice and the automatic ones).
// Numbers run per branch and year without gaps: the next number is worked out inside the insert, and a unique index
// on (branch, year, number) makes a simultaneous insert retry with the following number instead of skipping one.
export async function createInvoice(db:any,owner:string,body:unknown){
 const input=invoiceSchema.parse(body);if(input.issueDate>today())throw new Error('Issue date cannot be in the future.');
 const row:any=await db.prepare('SELECT data FROM offices WHERE id=? AND owner=?').bind(input.officeId,owner).first();if(!row)throw new Error('Office not found.');let office=JSON.parse(row.data);let payment:any=null;
 if(input.paymentId){const p:any=await db.prepare('SELECT data FROM payments WHERE id=? AND office_id=? AND owner=?').bind(input.paymentId,input.officeId,owner).first();if(!p)throw new Error('Payment not found for this office.');payment=JSON.parse(p.data);if(payment.direction!=='Income'||payment.status==='Cancelled')throw new Error('Choose an income payment that has not been cancelled.');if(payment.leaseId){const lease:any=await db.prepare('SELECT data FROM leases WHERE id=? AND owner=?').bind(payment.leaseId,owner).first();if(!lease)throw new Error('Archived lease not found.');office=JSON.parse(lease.data).office;}if(payment.amount<=0)throw new Error('A deposit-only payment cannot create a service tax invoice.');const duplicate=await db.prepare("SELECT id FROM invoices WHERE owner=? AND (data::jsonb->>'paymentId')=?").bind(owner,input.paymentId).first();if(duplicate)throw new Error(ALREADY);}
 const branch=office.branch||'BHB',issuerRow:any=await db.prepare('SELECT data FROM invoice_issuers WHERE id=? AND owner=?').bind(owner+':'+branch,owner).first();if(!issuerRow)throw new Error('Save supplier details for this branch in Accounts before issuing a tax invoice.');
 const issuer=issuerSchema.parse(JSON.parse(issuerRow.data));const id=crypto.randomUUID(),data={...input,branch,issuer,office,payment,totals:invoiceTotals(input),created:new Date().toISOString()};
 for(let attempt=0;;attempt++){try{
  const r:any=await db.prepare("INSERT INTO invoices(id,owner,office_id,data) SELECT ?,?,?,jsonb_set(?::jsonb,'{number}',to_jsonb(COALESCE((SELECT MAX(COALESCE((i.data::jsonb->>'number')::int,i.seq)) FROM invoices i WHERE i.owner=? AND COALESCE(i.data::jsonb->>'branch','BHB')=? AND substr(i.data::jsonb->>'issueDate',1,4)=?),0)+1))::text RETURNING (data::jsonb->>'number')::int AS number")
   .bind(id,owner,input.officeId,JSON.stringify(data),owner,branch,input.issueDate.slice(0,4)).first();
  return {id,url:'/invoice/'+id,number:r?.number};
 }catch(e){const m=String((e as Error).message);if(/invoice_owner_payment/.test(m))throw new Error(ALREADY);if(/invoice_branch_year_number/.test(m)&&attempt<5)continue;throw e}}
}
export const ALREADY='An invoice has already been issued for this payment. Open it from Accounts.';
const day=(iso:string)=>new Date(iso+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const aed=(n:number)=>'AED '+new Intl.NumberFormat('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
// The invoice an income payment gets automatically: one line for the payment, VAT at the lease's rate. A payment
// whose VAT does not match that rate is not invoiced automatically (it is reported, to be issued by hand).
export function invoiceFor(payment:any,office:any,issueDate:string){
 const rate=Number(office.vat)||0,expected=Math.round(payment.amount*rate)/100;
 if(Math.abs(expected-(payment.vatAmount||0))>0.01)throw new Error('VAT on '+payment.reference+' is '+aed(payment.vatAmount||0)+' but the lease rate of '+rate+'% gives '+aed(expected)+'. Issue this invoice by hand.');
 const what=payment.incomeType==='PRO service'?'PRO services':payment.incomeType==='Other income'?'Services':'Office rent';
 const supply=payment.due&&payment.due<=issueDate?payment.due:issueDate;
 return {officeId:payment.officeId,paymentId:payment.id,issueDate,supplyDate:supply,buyerName:office.company||payment.party,buyerAddress:office.billingAddress||office.location||'United Arab Emirates',buyerTrn:office.trn||'',
  description:[what+' · '+office.code,(payment.description||'').replace(' · '+office.code,''),office.start&&office.end?'Lease '+day(office.start)+' to '+day(office.end):''].filter(Boolean).join(' · ').slice(0,2000),quantity:1,unitPrice:payment.amount,discount:0,vatRate:rate,notes:'Issued automatically for payment '+payment.reference+'.'};
}
// A hand-made invoice with no payment link for the same office and amount within 45 days probably covers this payment.
export function invoicedByHand(invoices:any[],payment:any){const when=Date.parse((payment.actual||payment.due)+'T00:00:00Z');return invoices.find(i=>!i.paymentId&&i.officeId===payment.officeId&&Math.abs((i.totals?.net||0)-payment.amount)<0.01&&Math.abs(Date.parse((i.supplyDate||i.issueDate)+'T00:00:00Z')-when)<=45*864e5)}
export {receivedForInvoice} from './invoices';
