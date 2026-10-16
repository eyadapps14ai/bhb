import {issuerSchema,invoiceSchema,invoiceTotals} from './invoices';
import {today} from './records';
// Tax invoices: the one place that checks and saves an invoice (Accounts > Create invoice and the automatic ones).
export async function createInvoice(db:any,owner:string,body:unknown){
 const input=invoiceSchema.parse(body);if(input.issueDate>today())throw new Error('Issue date cannot be in the future.');
 const row:any=await db.prepare('SELECT data FROM offices WHERE id=? AND owner=?').bind(input.officeId,owner).first();if(!row)throw new Error('Office not found.');let office=JSON.parse(row.data);let payment:any=null;
 if(input.paymentId){const p:any=await db.prepare('SELECT data FROM payments WHERE id=? AND office_id=? AND owner=?').bind(input.paymentId,input.officeId,owner).first();if(!p)throw new Error('Payment not found for this office.');payment=JSON.parse(p.data);if(payment.direction!=='Income'||payment.status==='Cancelled')throw new Error('Choose an income payment that has not been cancelled.');if(payment.leaseId){const lease:any=await db.prepare('SELECT data FROM leases WHERE id=? AND owner=?').bind(payment.leaseId,owner).first();if(!lease)throw new Error('Archived lease not found.');office=JSON.parse(lease.data).office;}if(payment.amount<=0)throw new Error('A deposit-only payment cannot create a service tax invoice.');const duplicate=await db.prepare("SELECT id FROM invoices WHERE owner=? AND (data::jsonb->>'paymentId')=?").bind(owner,input.paymentId).first();if(duplicate)throw new Error('An invoice has already been issued for this payment. Open it from Accounts.');}
 const branch=office.branch||'BHB',issuerRow:any=await db.prepare('SELECT data FROM invoice_issuers WHERE id=? AND owner=?').bind(owner+':'+branch,owner).first();if(!issuerRow)throw new Error('Save supplier details for this branch in Accounts before issuing a tax invoice.');
 const issuer=issuerSchema.parse(JSON.parse(issuerRow.data));const id=crypto.randomUUID(),data={...input,branch,issuer,office,payment,totals:invoiceTotals(input),created:new Date().toISOString()};
 await db.prepare('INSERT INTO invoices(id,owner,office_id,data) VALUES(?,?,?,?)').bind(id,owner,input.officeId,JSON.stringify(data)).run();return {id,url:'/invoice/'+id};
}
const day=(iso:string)=>new Date(iso+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
// The invoice an income payment gets automatically: one line for the payment's amount, VAT at the rate it carries.
export function invoiceFor(payment:any,office:any,issueDate:string){
 const what=payment.incomeType==='PRO service'?'PRO services':payment.incomeType==='Other income'?'Services':'Office rent';
 return {officeId:payment.officeId,paymentId:payment.id,issueDate,supplyDate:payment.due&&payment.due<=issueDate?payment.due:issueDate,buyerName:office.company||payment.party,buyerAddress:office.billingAddress||office.location||'United Arab Emirates',buyerTrn:office.trn||'',
  description:[what+' · '+office.code,(payment.description||'').replace(' · '+office.code,''),office.start&&office.end?'Lease '+day(office.start)+' to '+day(office.end):''].filter(Boolean).join(' · ').slice(0,2000),quantity:1,unitPrice:payment.amount,discount:0,vatRate:payment.amount?Math.round((payment.vatAmount||0)/payment.amount*10000)/100:0,notes:'Issued automatically for payment '+payment.reference+'.'};
}
export {dueForInvoice} from './invoices';
