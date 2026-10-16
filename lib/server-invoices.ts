import {issuerSchema,invoiceSchema,invoiceTotals,autoInvoiceBlock,invoiceToReuse} from './invoices';
import {today} from './records';
// Tax invoices: the one place that checks and saves an invoice (Accounts > Create invoice and the automatic ones).
// Numbers run per branch and year without gaps: the next number is worked out inside the insert, and a unique index
// on (branch, year, number) makes a simultaneous insert retry with the following number instead of skipping one.
export async function createInvoice(db:any,owner:string,body:unknown){
 const input=invoiceSchema.parse(body);if(input.issueDate>today())throw new Error('Issue date cannot be in the future.');
 // For a tenant the invoice follows the office (and its payment); for a customer without an office it follows the customer.
 let office:any=null,customer:any=null,payment:any=null;
 if(input.officeId){const row:any=await db.prepare('SELECT data FROM offices WHERE id=? AND owner=?').bind(input.officeId,owner).first();if(!row)throw new Error('Office not found.');office=JSON.parse(row.data)}
 else{const row:any=await db.prepare('SELECT data FROM customers WHERE id=? AND owner=?').bind(input.customerId,owner).first();if(!row)throw new Error('Customer not found.');customer={...JSON.parse(row.data),id:input.customerId}}
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
export {receivedForInvoice} from './invoices';
const BLOCKED={vat:'its VAT does not match the lease VAT rate; issue this invoice by hand',hand:'this lease has an invoice made by hand in its current term; issue its invoices by hand'};
// The automatic invoice for one received payment: skipped with a reason (VAT mismatch, lease invoiced by hand),
// or the invoice of a bounced or cancelled payment it replaces is moved to it, or a new invoice is issued.
export async function autoInvoice(db:any,owner:string,payment:any,office:any,on:string):Promise<{id?:string;url?:string;reused?:boolean;skipped?:string}>{
 const rows=((await db.prepare('SELECT id,data FROM invoices WHERE owner=? AND office_id=?').bind(owner,payment.officeId).all()).results as any[]).map(r=>({...JSON.parse(r.data),id:r.id,officeId:payment.officeId}));
 if(rows.some(i=>i.paymentId===payment.id))return {skipped:'already invoiced'};
 const block=autoInvoiceBlock(payment,office,rows);if(block==='vat'){const rate=Number(office.vat)||0;return {skipped:payment.reference+': VAT is '+aed(payment.vatAmount||0)+' but the lease rate of '+rate+'% gives '+aed(Math.round(payment.amount*rate)/100)+'; issue this invoice by hand'}}if(block)return {skipped:payment.reference+': '+BLOCKED[block]};
 const linked=rows.map(i=>i.paymentId).filter(Boolean),statuses=new Map<string,string>();
 for(const pid of linked){const r:any=await db.prepare('SELECT data FROM payments WHERE id=? AND owner=?').bind(pid,owner).first();if(r)statuses.set(pid,JSON.parse(r.data).status)}
 const reuse=invoiceToReuse(payment,rows,pid=>statuses.get(pid));
 if(reuse){const moved:any=await db.prepare("UPDATE invoices SET data=(jsonb_set(jsonb_set(jsonb_set(data::jsonb,'{paymentId}',to_jsonb(?::text)),'{payment}',?::jsonb),'{replacedPayments}',COALESCE(data::jsonb->'replacedPayments','[]'::jsonb)||jsonb_build_array(?::text)))::text WHERE id=? AND owner=? AND data::jsonb->>'paymentId'=? RETURNING id").bind(payment.id,JSON.stringify(payment),(statuses.get(reuse.paymentId)||'').toLowerCase()+' payment '+(reuse.payment?.reference||reuse.paymentId),reuse.id,owner,reuse.paymentId).first();if(moved)return {id:reuse.id,url:'/invoice/'+reuse.id,reused:true}}
 const made=await createInvoice(db,owner,invoiceFor(payment,office,on));return made;
}
