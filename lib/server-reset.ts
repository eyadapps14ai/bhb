import {createHash} from 'node:crypto';
import type {Database,Statement} from '@/db';
import type {Access} from './access';
// Reset data from Advanced settings (Admin #831, rules from claude-bhb-deployer #849). It deletes offices, leases,
// payments (rent and expenses), documents and customers in every branch. It never deletes tax invoices or credit notes
// (UAE rules keep tax documents for years), nor what they point to: the office, payment and customer of each invoice,
// and everything tied to a kept office. Employees, logins, roles, settings, enquiries and to-dos stay. The backup a
// super admin downloads first holds exactly the rows the reset deletes: its fingerprint must still match, inside the
// same transaction, or nothing is deleted. Uploaded files are not erased from storage: only their records are deleted,
// and the backup keeps each file's storage key, so a restore can link them again.
type All=<R>(statement:Statement)=>Promise<R[]>;
type Office={id:string;code:string;data:string};type Payment={id:string;office_id:string|null;data:string};type Lease={id:string;office_id:string;data:string};
type Doc={id:string;office_id:string;payment_id:string|null;name:string;category:string;mime:string;size:number;key:string;created:string};type Customer={id:string;data:string};
export type ResetPlan={del:{offices:Office[];payments:Payment[];leases:Lease[];documents:Doc[];customers:Customer[]};kept:{invoices:number;creditNotes:number;offices:string[];payments:number;customers:number};fingerprint:string};
export const resetCounts=(p:ResetPlan)=>({offices:p.del.offices.length,leases:p.del.leases.length,payments:p.del.payments.length,documents:p.del.documents.length,customers:p.del.customers.length});
export async function resetPlan(db:Database,all:All,owner:string):Promise<ResetPlan>{
 const q=<R>(sql:string)=>all<R>(db.prepare(sql).bind(owner));
 const invoices=await q<{office_id:string|null;data:string}>('SELECT office_id,data FROM invoices WHERE owner=?'),notes=await q<{id:string}>('SELECT id FROM credit_notes WHERE owner=?');
 const offices=await q<Office>('SELECT id,code,data FROM offices WHERE owner=? ORDER BY id'),payments=await q<Payment>('SELECT id,office_id,data FROM payments WHERE owner=? ORDER BY id');
 const leases=await q<Lease>('SELECT id,office_id,data FROM leases WHERE owner=? ORDER BY id'),customers=await q<Customer>('SELECT id,data FROM customers WHERE owner=? ORDER BY id');
 const documents=await q<Doc>('SELECT id,office_id,payment_id,name,category,mime,size,key,created FROM documents WHERE owner=? ORDER BY id');
 const keepO=new Set<string>(),keepP=new Set<string>(),keepC=new Set<string>();
 for(const i of invoices){const d=JSON.parse(i.data);if(i.office_id)keepO.add(i.office_id);if(d.paymentId)keepP.add(d.paymentId);for(const r of d.replacedPayments||[])if(r?.paymentId)keepP.add(r.paymentId);if(d.customerId)keepC.add(d.customerId)}
 // Follow the links until nothing changes: a kept payment keeps its office, a kept office keeps its payments and
 // documents, and a document keeps its payment (so no kept row ever points to a deleted one).
 for(let size=-1;size!==keepO.size+keepP.size;){size=keepO.size+keepP.size;
  for(const p of payments){if(keepP.has(p.id)&&p.office_id)keepO.add(p.office_id);if(p.office_id&&keepO.has(p.office_id))keepP.add(p.id)}
  for(const d of documents)if(keepO.has(d.office_id)||(d.payment_id&&keepP.has(d.payment_id))){keepO.add(d.office_id);if(d.payment_id)keepP.add(d.payment_id)}}
 const del={offices:offices.filter(o=>!keepO.has(o.id)),payments:payments.filter(p=>!keepP.has(p.id)),leases:leases.filter(l=>!keepO.has(l.office_id)),documents:documents.filter(d=>!keepO.has(d.office_id)),customers:customers.filter(c=>!keepC.has(c.id))};
 return {del,kept:{invoices:invoices.length,creditNotes:notes.length,offices:offices.filter(o=>keepO.has(o.id)).map(o=>JSON.parse(o.data).code||o.code),payments:payments.filter(p=>keepP.has(p.id)).length,customers:customers.filter(c=>keepC.has(c.id)).length},fingerprint:createHash('sha256').update(JSON.stringify(del)).digest('hex')};
}
// The backup file: every row the reset will delete, readable (data parsed), plus what is kept and the fingerprint.
export function resetBackup(p:ResetPlan,user:Access){const parse=<T extends {data:string}>(l:T[])=>l.map(r=>({...r,data:JSON.parse(r.data)}));
 return {kind:'bhb-reset-backup',version:1,createdAt:new Date().toISOString(),createdBy:{name:user.name,email:user.email},fingerprint:p.fingerprint,willDelete:resetCounts(p),kept:p.kept,
  rows:{offices:parse(p.del.offices),leases:parse(p.del.leases),payments:parse(p.del.payments),documents:p.del.documents,customers:parse(p.del.customers)}}}
export async function resetData(db:Database,owner:string,user:Access,fingerprint:string){
 return db.transaction(async all=>{
  // No invoice or credit note can be issued (or changed), and no office, payment, lease, document or customer saved,
  // while this runs; if someone is saving right now, it waits at most 5 seconds and then asks to try again.
  await all(db.prepare("SET LOCAL lock_timeout = '5s'"));
  await all(db.prepare('LOCK TABLE invoices, credit_notes IN SHARE MODE'));
  await all(db.prepare('LOCK TABLE offices, payments, leases, documents, customers IN EXCLUSIVE MODE'));
  const plan=await resetPlan(db,all,owner);
  if(plan.fingerprint!==fingerprint)throw new Error('The data changed after your backup was made. Download a new backup, then reset.');
  if(Object.values(resetCounts(plan)).every(n=>!n))throw new Error('Nothing to delete.');
  const gone=async(table:'documents'|'leases'|'payments'|'offices'|'customers',rows:{id:string}[])=>{if(rows.length)await all(db.prepare('DELETE FROM '+table+' WHERE owner=? AND id IN (SELECT jsonb_array_elements_text(?::jsonb))').bind(owner,JSON.stringify(rows.map(r=>r.id))))};
  await gone('documents',plan.del.documents);await gone('leases',plan.del.leases);await gone('payments',plan.del.payments);await gone('offices',plan.del.offices);await gone('customers',plan.del.customers);
  const at=new Date().toISOString(),entry={action:'reset',at,by:user.userId,byName:user.name,byEmail:user.email,deleted:resetCounts(plan),kept:plan.kept,fingerprint};
  await all(db.prepare('INSERT INTO audit_log (id,owner,at,data) VALUES (?,?,?,?)').bind(crypto.randomUUID(),owner,at,JSON.stringify(entry)));
  return entry;
 });
}
export async function lastReset(db:Database,owner:string){const r=await db.prepare("SELECT data FROM audit_log WHERE owner=? AND data::jsonb->>'action'='reset' ORDER BY at DESC LIMIT 1").bind(owner).first<{data:string}>();return r?JSON.parse(r.data) as {at:string;byName:string;deleted:Record<string,number>}:null}
