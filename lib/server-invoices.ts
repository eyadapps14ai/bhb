import {issuerSchema,invoiceSchema,invoiceTotals,autoInvoiceBlock,replacementBlock,creditNoteSchema,invoiceNumber,round} from './invoices';
import type {Database} from '@/db';
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
 if(input.paymentId){const p:any=await db.prepare('SELECT data FROM payments WHERE id=? AND office_id=? AND owner=?').bind(input.paymentId,input.officeId,owner).first();if(!p)throw new Error('Payment not found for this office.');payment=JSON.parse(p.data);if(payment.direction!=='Income'||payment.status==='Cancelled')throw new Error('Choose an income payment that has not been cancelled.');if(payment.leaseId){const lease:any=await db.prepare('SELECT data FROM leases WHERE id=? AND owner=?').bind(payment.leaseId,owner).first();if(!lease)throw new Error('Archived lease not found.');office=JSON.parse(lease.data).office;}if(payment.amount<=0)throw new Error('A deposit-only payment cannot create a service tax invoice.');const duplicate=await db.prepare("SELECT id FROM invoices WHERE owner=? AND (data::jsonb->>'paymentId')=?").bind(owner,input.paymentId).first();if(duplicate)throw new Error(ALREADY);
  // Several lines on one payment (e.g. a PRO fee plus government fees) must add up to that payment: its amount is the
  // services alone or services plus fees, and its VAT is the services' VAT. Otherwise issue it without the payment.
  if(input.lines.length>1){const t=invoiceTotals(input),near=(a:number,b:number)=>Math.abs(a-b)<0.01;if(!near(t.vat,payment.vatAmount||0)||!(near(t.net,payment.amount)||near(t.net+t.outside,payment.amount)))throw new Error('These lines (services '+aed(t.net)+', VAT '+aed(t.vat)+(t.outside?', government fees '+aed(t.outside):'')+') do not match payment '+payment.reference+' ('+aed(payment.amount)+', VAT '+aed(payment.vatAmount||0)+'). Correct the lines, or issue the invoice without choosing the payment.')}}
 const branch=(office||customer).branch||'BHB',issuerRow:any=await db.prepare('SELECT data FROM invoice_issuers WHERE id=? AND owner=?').bind(owner+':'+branch,owner).first();if(!issuerRow)throw new Error('Save your company details (seller) for this branch in Accounts before issuing a tax invoice.');
 // Numbers and dates must run in the same order: an invoice cannot be dated before the newest one in its branch and year.
 const year=input.issueDate.slice(0,4),last=(await db.prepare("SELECT MAX(data::jsonb->>'issueDate') AS d FROM invoices WHERE owner=? AND COALESCE(data::jsonb->>'branch','BHB')=? AND substr(data::jsonb->>'issueDate',1,4)=?").bind(owner,branch,year).first()) as {d:string|null}|null;
 if(last?.d&&input.issueDate<last.d)throw new Error(lastDateError(last.d));
 const issuer=issuerSchema.parse(JSON.parse(issuerRow.data));const id=crypto.randomUUID(),data={...input,officeId:input.officeId||null,customerId:input.officeId?null:input.customerId,branch,issuer,office,customer,payment,totals:invoiceTotals(input),created:new Date().toISOString()};
 for(let attempt=0;;attempt++){try{
  const r:any=await db.prepare("INSERT INTO invoices(id,owner,office_id,data) SELECT ?,?,?,jsonb_set(?::jsonb,'{number}',to_jsonb(COALESCE((SELECT MAX(COALESCE((i.data::jsonb->>'number')::int,i.seq)) FROM invoices i WHERE i.owner=? AND COALESCE(i.data::jsonb->>'branch','BHB')=? AND substr(i.data::jsonb->>'issueDate',1,4)=?),0)+1))::text WHERE NOT EXISTS (SELECT 1 FROM invoices n WHERE n.owner=? AND COALESCE(n.data::jsonb->>'branch','BHB')=? AND substr(n.data::jsonb->>'issueDate',1,4)=? AND n.data::jsonb->>'issueDate'>?) AND (?::text IS NULL OR EXISTS (SELECT 1 FROM customers c WHERE c.id=? AND c.owner=?)) RETURNING (data::jsonb->>'number')::int AS number")
   .bind(id,owner,input.officeId||null,JSON.stringify(data),owner,branch,year,owner,branch,year,input.issueDate,customer?.id??null,customer?.id??null,owner).first();
  // A customer deleted meanwhile (e.g. by a reset) gets no invoice.
  if(!r&&customer&&!(await db.prepare('SELECT 1 FROM customers WHERE id=? AND owner=?').bind(customer.id,owner).first()))throw new Error('Customer not found.');
  if(!r){const now=(await db.prepare("SELECT MAX(data::jsonb->>'issueDate') AS d FROM invoices WHERE owner=? AND COALESCE(data::jsonb->>'branch','BHB')=? AND substr(data::jsonb->>'issueDate',1,4)=?").bind(owner,branch,year).first()) as {d:string|null}|null;throw new Error(lastDateError(now?.d||input.issueDate))}
  return {id,url:'/invoice/'+id,number:r.number};
 }catch(e){const m=String((e as Error).message);if(/invoice_owner_payment/.test(m))throw new Error(ALREADY);if(/invoice_branch_year_number/.test(m)){if(attempt<5)continue;throw new Error('Could not get the next invoice number because several invoices were issued at once. Please try again.')}throw e}}
}
export const ALREADY='An invoice has already been issued for this payment. Open it from Accounts.';
const lastDateError=(d:string)=>'The last invoice in this series is dated '+day(d)+'. Date this one '+day(d)+' or later, so numbers and dates stay in order.';
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
export const BLOCKED={pro:'PRO services are invoiced by hand, so government fees can go on their own line outside VAT',vat:'its VAT does not match the lease VAT rate; issue this invoice by hand',hand:'this lease has an invoice made by hand in its current term; issue its invoices by hand'};
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
  const cr=inv?(await db.prepare("SELECT COALESCE(SUM((data::jsonb->'credit'->>'net')::numeric),0) AS net FROM credit_notes WHERE owner=? AND invoice_id=?").bind(owner,inv.id).first()) as {net:string}|null:null,creditedNet=Number(cr?.net||0);
  const why=replacementBlock(payment,office,o,inv,movedTo,creditedNet);
  if(why)return {skipped:payment.reference+': not invoiced automatically because '+why+'; issue it by hand'};
  // Never invoiced, or its invoice credited in full: the replacement gets its own invoice.
  if(!inv||creditedNet>0)return await createInvoice(db,owner,invoiceFor(payment,office,on));
  try{const moved:any=await db.prepare("UPDATE invoices SET data=(jsonb_set(jsonb_set(jsonb_set(data::jsonb,'{paymentId}',to_jsonb(?::text)),'{payment}',?::jsonb),'{replacedPayments}',COALESCE(data::jsonb->'replacedPayments','[]'::jsonb)||jsonb_build_object('reference',?::text,'paymentId',?::text,'at',?::text,'by',?::text,'byName',?::text)))::text WHERE id=? AND owner=? AND data::jsonb->>'paymentId'=? AND NOT EXISTS (SELECT 1 FROM credit_notes c WHERE c.owner=invoices.owner AND c.invoice_id=invoices.id) RETURNING id").bind(payment.id,JSON.stringify(payment),o.reference,payment.replacesPaymentId,new Date().toISOString(),by.userId,by.name,inv.id,owner,payment.replacesPaymentId).first();if(moved)return {id:inv.id,url:'/invoice/'+inv.id,reused:true}}
  catch(e){if(/invoice_owner_payment/.test(String((e as Error).message)))return {skipped:'already invoiced'};throw e}
  return {skipped:payment.reference+': the bounced payment\'s invoice changed meanwhile; try again'}}
 const made=await createInvoice(db,owner,invoiceFor(payment,office,on));return made;
}

// A tax credit note for an issued invoice. It takes off all that is left on the invoice or part of it (before VAT,
// with the VAT at the invoice's rate; crediting the rest takes exactly the VAT that is left). Its number runs per branch
// and year like invoices, dates stay in number order, and a lock per invoice stops two people over-crediting it.
export async function createCreditNote(db:Database,owner:string,body:unknown,by:{userId:string;name:string}){
 const input=creditNoteSchema.parse(body);if(input.issueDate>today())throw new Error('The credit note date cannot be in the future.');
 const row=await db.prepare('SELECT seq,data FROM invoices WHERE id=? AND owner=?').bind(input.invoiceId,owner).first<{seq:number;data:string}>();if(!row)throw new Error('Invoice not found.');
 const inv=JSON.parse(row.data),branch=inv.branch||'BHB',year=input.issueDate.slice(0,4);
 if(input.issueDate<inv.issueDate)throw new Error('A credit note cannot be dated before its invoice ('+day(inv.issueDate)+').');
 const done=await db.prepare("SELECT COALESCE(SUM((data::jsonb->'credit'->>'net')::numeric),0) AS net,COALESCE(SUM((data::jsonb->'credit'->>'vat')::numeric),0) AS vat FROM credit_notes WHERE owner=? AND invoice_id=?").bind(owner,input.invoiceId).first<{net:string;vat:string}>();
 const doneNet=Number(done?.net||0),leftNet=round(inv.totals.net-doneNet),leftVat=round(inv.totals.vat-Number(done?.vat||0));
 if(leftNet<=0.004)throw new Error('This invoice is already credited in full.');
 const net=round(input.net);if(net<0.01)throw new Error('Enter at least AED 0.01 to credit.');if(net>leftNet+0.004)throw new Error('At most '+aed(leftNet)+' before VAT is left to credit on this invoice.');
 // VAT in fils (no float drift on .5 cases); the rest takes exactly the VAT left, and a part never more than that.
 const vat=Math.abs(net-leftNet)<0.005?leftVat:Math.max(0,Math.min(leftVat,Math.round(Math.round(net*100)*(Number(inv.vatRate)||0)/100)/100)),after={net:round(leftNet-net),vat:round(leftVat-vat)};
 const last=await db.prepare("SELECT MAX(data::jsonb->>'issueDate') AS d FROM credit_notes WHERE owner=? AND data::jsonb->>'branch'=? AND substr(data::jsonb->>'issueDate',1,4)=?").bind(owner,branch,year).first<{d:string|null}>();
 if(last?.d&&input.issueDate<last.d)throw new Error('The last credit note in this series is dated '+day(last.d)+'. Date this one '+day(last.d)+' or later, so numbers and dates stay in order.');
 const id=crypto.randomUUID(),data={invoiceId:input.invoiceId,invoiceNumber:invoiceNumber({...inv,seq:row.seq}),invoiceDate:inv.issueDate,branch,issueDate:input.issueDate,reason:input.reason,
  issuer:inv.issuer,buyerName:inv.buyerName,buyerAddress:inv.buyerAddress,buyerTrn:inv.buyerTrn||'',description:inv.lines?.length?(inv.lines as {kind?:string;description:string}[]).filter(l=>l.kind!=='disbursement').map(l=>l.description).join('; ').slice(0,2000):inv.description,vatRate:inv.vatRate,officeId:inv.officeId||null,customerId:inv.customerId||null,paymentId:inv.paymentId||null,office:inv.office?{code:inv.office.code}:null,
  original:{net:inv.totals.net,vat:inv.totals.vat,total:inv.totals.total},credit:{net,vat,total:round(net+vat)},corrected:{...after,outside:inv.totals.outside||0,total:round(after.net+after.vat+(inv.totals.outside||0))},full:after.net<=0.004,by:by.userId,byName:by.name,created:new Date().toISOString()};
 for(let attempt=0;;attempt++){try{
  const [,ins]=await db.batch([db.prepare('SELECT pg_advisory_xact_lock(hashtext(?))').bind('credit-note:'+owner+':'+input.invoiceId),
   db.prepare("INSERT INTO credit_notes(id,owner,invoice_id,data) SELECT ?,?,?,jsonb_set(?::jsonb,'{number}',to_jsonb(COALESCE((SELECT MAX((c.data::jsonb->>'number')::int) FROM credit_notes c WHERE c.owner=? AND c.data::jsonb->>'branch'=? AND substr(c.data::jsonb->>'issueDate',1,4)=?),0)+1))::text WHERE (SELECT COALESCE(SUM((x.data::jsonb->'credit'->>'net')::numeric),0) FROM credit_notes x WHERE x.owner=? AND x.invoice_id=?)=?::numeric AND NOT EXISTS (SELECT 1 FROM credit_notes n WHERE n.owner=? AND n.data::jsonb->>'branch'=? AND substr(n.data::jsonb->>'issueDate',1,4)=? AND n.data::jsonb->>'issueDate'>?) RETURNING (data::jsonb->>'number')::int AS number")
    .bind(id,owner,input.invoiceId,JSON.stringify(data),owner,branch,year,owner,input.invoiceId,String(doneNet),owner,branch,year,input.issueDate)]);
  const r=ins.results[0] as {number:number}|undefined;if(!r)throw new Error('Another credit note was issued for this invoice or series just now. Reload and try again.');
  return {id,url:'/credit-note/'+id,number:r.number};
 }catch(e){if(/credit_note_branch_year_number/.test(String((e as Error).message))){if(attempt<5)continue;throw new Error('Could not get the next credit note number because several were issued at once. Please try again.')}throw e}}
}
