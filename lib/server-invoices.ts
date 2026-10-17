import {issuerSchema,invoiceSchema,invoiceTotals,autoInvoiceBlock} from './invoices';
import {inLeaseTerm} from './records';
import {today} from './records';
// Tax invoices: the one place that checks and saves an invoice (Accounts > Create invoice and the automatic ones).
// Numbers run per branch and year without gaps: the next number is worked out inside the insert, and a unique index
// on (branch, year, number) makes a simultaneous insert retry with the following number instead of skipping one.
export async function createInvoice(db:any,owner:string,body:unknown){
 const input=invoiceSchema.parse(body);if(input.issueDate>today())throw new Error('Issue date cannot be in the future.');if(input.supplyDate>input.issueDate)throw new Error('The date of supply cannot be after the issue date.');
 // For a tenant the invoice follows the office (and its payment); for a customer without an office it follows the customer.
 let office:any=null,customer:any=null,payment:any=null;
 if(input.officeId){const row:any=await db.prepare('SELECT data FROM offices WHERE id=? AND owner=?').bind(input.officeId,owner).first();if(!row)throw new Error('Office not found.');office=JSON.parse(row.data)}
 else{const row:any=await db.prepare('SELECT data FROM customers WHERE id=? AND owner=?').bind(input.customerId,owner).first();if(!row)throw new Error('Customer not found.');const c=JSON.parse(row.data);customer={id:input.customerId,branch:c.branch,name:c.name,trn:c.trn,billingAddress:c.billingAddress,contact:c.contact,email:c.email,phone:c.phone}}
 if(input.paymentId){const p:any=await db.prepare('SELECT data FROM payments WHERE id=? AND office_id=? AND owner=?').bind(input.paymentId,input.officeId,owner).first();if(!p)throw new Error('Payment not found for this office.');payment=JSON.parse(p.data);if(payment.direction!=='Income'||payment.status==='Cancelled')throw new Error('Choose an income payment that has not been cancelled.');if(payment.leaseId){const lease:any=await db.prepare('SELECT data FROM leases WHERE id=? AND owner=?').bind(payment.leaseId,owner).first();if(!lease)throw new Error('Archived lease not found.');office=JSON.parse(lease.data).office;}if(payment.amount<=0)throw new Error('A deposit-only payment cannot create a service tax invoice.');const duplicate=await db.prepare("SELECT id FROM invoices WHERE owner=? AND (data::jsonb->>'paymentId')=?").bind(owner,input.paymentId).first();if(duplicate)throw new Error(ALREADY);}
 const branch=(office||customer).branch||'BHB',issuerRow:any=await db.prepare('SELECT data FROM invoice_issuers WHERE id=? AND owner=?').bind(owner+':'+branch,owner).first();if(!issuerRow)throw new Error('Save your company details (seller) for this branch in Accounts before issuing a tax invoice.');
 const issuer=issuerSchema.parse(JSON.parse(issuerRow.data));const id=crypto.randomUUID(),data={...input,officeId:input.officeId||null,customerId:input.officeId?null:input.customerId,branch,issuer,office,customer,payment,totals:invoiceTotals(input),created:new Date().toISOString()};
 for(let attempt=0;;attempt++){try{
  const r:any=await db.prepare("INSERT INTO invoices(id,owner,office_id,data) SELECT ?,?,?,jsonb_set(?::jsonb,'{number}',to_jsonb(COALESCE((SELECT MAX(COALESCE((i.data::jsonb->>'number')::int,i.seq)) FROM invoices i WHERE i.owner=? AND COALESCE(i.data::jsonb->>'branch','BHB')=? AND substr(i.data::jsonb->>'issueDate',1,4)=?),0)+1))::text RETURNING (data::jsonb->>'number')::int AS number")
   .bind(id,owner,input.officeId||null,JSON.stringify(data),owner,branch,input.issueDate.slice(0,4)).first();
  return {id,url:'/invoice/'+id,number:r?.number};
 }catch(e){const m=String((e as Error).message);if(/invoice_owner_payment/.test(m))throw new Error(ALREADY);if(/invoice_branch_year_number/.test(m)){if(attempt<5)continue;throw new Error('Could not get the next invoice number because several invoices were issued at once. Please try again.')}throw e}}
}
export const ALREADY='An invoice has already been issued for this payment. Open it from Accounts.';
// "18 Sep 2026" (the same on every server; some locales print "Sept").
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],day=(iso:string)=>+iso.slice(8,10)+' '+MON[+iso.slice(5,7)-1]+' '+iso.slice(0,4);
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
export {receivedForInvoice} from './invoices';
const BLOCKED={vat:'its VAT does not match the lease VAT rate; issue this invoice by hand',hand:'this lease has an invoice made by hand in its current term; issue its invoices by hand'};
// The automatic invoice for one received payment: skipped with a reason (VAT mismatch, lease invoiced by hand),
// or the invoice of a bounced payment it names as replaced is moved to it, or a new invoice is issued.
export async function autoInvoice(db:any,owner:string,payment:any,office:any,on:string,by:{userId:string;name:string}={userId:'',name:''}):Promise<{id?:string;url?:string;reused?:boolean;skipped?:string}>{
 const rows=((await db.prepare('SELECT id,data FROM invoices WHERE owner=? AND office_id=?').bind(owner,payment.officeId).all()).results as any[]).map(r=>({...JSON.parse(r.data),id:r.id,officeId:payment.officeId}));
 if(rows.some(i=>i.paymentId===payment.id))return {skipped:'already invoiced'};
 const block=autoInvoiceBlock(payment,office,rows);if(block==='vat'){const rate=Number(office.vat)||0;return {skipped:payment.reference+': VAT is '+aed(payment.vatAmount||0)+' but the lease rate of '+rate+'% gives '+aed(Math.round(payment.amount*rate)/100)+'; issue this invoice by hand'}}if(block)return {skipped:payment.reference+': '+BLOCKED[block]};
 // A replacement for a bounced cheque takes over that cheque's invoice only when the person recording it chose the
 // bounced payment (replacesPaymentId) and everything matches: same office, the original bounced (never cancelled,
 // which needs a credit note), due in the current lease term, same tenant name and TRN, same amount and VAT.
 // A bounced cheque that was never invoiced has nothing to take over: its replacement gets a new invoice, unless the
 // bounced cheque's invoice already moved to another replacement (then it is skipped, to avoid naming it twice).
 if(payment.replacesPaymentId){const orig:any=await db.prepare('SELECT data FROM payments WHERE id=? AND owner=? AND office_id=?').bind(payment.replacesPaymentId,owner,payment.officeId).first(),o=orig?JSON.parse(orig.data):null,inv=rows.find(i=>i.paymentId===payment.replacesPaymentId);
  const movedTo=rows.find(i=>(i.replacedPayments||[]).some((r:{paymentId?:string})=>r.paymentId===payment.replacesPaymentId));
  const why=!o?'the replaced payment was not found on this office':o.status!=='Bounced'?(inv?'the replaced payment was cancelled, not bounced, and its invoice needs a credit note':'the replaced payment is not bounced'):!inLeaseTerm(office,o.due)?'the replaced payment is from another lease term':!inv?(movedTo?'the bounced payment\'s invoice already moved to '+(movedTo.payment?.reference||'another payment'):''):inv.buyerName!==office.company||(inv.buyerTrn||'')!==(office.trn||'')?'its invoice is for another tenant':Math.abs((inv.totals?.net||0)-payment.amount)>=0.01||Math.abs((inv.totals?.vat||0)-(payment.vatAmount||0))>=0.01?'the amount or VAT differs from its invoice':'';
  if(why)return {skipped:payment.reference+': not invoiced automatically because '+why+'; issue it by hand'};
  if(!inv)return await createInvoice(db,owner,invoiceFor(payment,office,on));
  try{const moved:any=await db.prepare("UPDATE invoices SET data=(jsonb_set(jsonb_set(jsonb_set(data::jsonb,'{paymentId}',to_jsonb(?::text)),'{payment}',?::jsonb),'{replacedPayments}',COALESCE(data::jsonb->'replacedPayments','[]'::jsonb)||jsonb_build_object('reference',?::text,'paymentId',?::text,'at',?::text,'by',?::text,'byName',?::text)))::text WHERE id=? AND owner=? AND data::jsonb->>'paymentId'=? RETURNING id").bind(payment.id,JSON.stringify(payment),o.reference,payment.replacesPaymentId,new Date().toISOString(),by.userId,by.name,inv.id,owner,payment.replacesPaymentId).first();if(moved)return {id:inv.id,url:'/invoice/'+inv.id,reused:true}}
  catch(e){if(/invoice_owner_payment/.test(String((e as Error).message)))return {skipped:'already invoiced'};throw e}
  return {skipped:payment.reference+': the bounced payment\'s invoice changed meanwhile; try again'}}
 const made=await createInvoice(db,owner,invoiceFor(payment,office,on));return made;
}
