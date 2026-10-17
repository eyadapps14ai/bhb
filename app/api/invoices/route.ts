import {context,failure,checkOffice,checkBranch,allow} from '@/lib/server-records';
import {has} from '@/lib/access';
import {issuerSchema,invoiceSchema} from '@/lib/invoices';
import {today} from '@/lib/records';
import {createInvoice,autoInvoice,receivedForInvoice} from '@/lib/server-invoices';
export async function POST(req:Request){try{const{db,owner,user}=await context(req,'cash','view');allow(has(user,'invoices'));const body:any=await req.json();// Supplier details may be copied to both branches, but the automatic-invoice start date belongs to one branch and only
 // a super admin may set or change it (it decides which received payments get invoices in bulk).
 if(body.action==='saveIssuer'){const issuer=issuerSchema.parse(body),branches=body.both?['BHB','111']:[issuer.branch];for(const b of branches)checkBranch(user,b);
  const saved=new Map<string,any>();for(const b of branches){const r:any=await db.prepare('SELECT data FROM invoice_issuers WHERE id=? AND owner=?').bind(owner+':'+b,owner).first();saved.set(b,r?JSON.parse(r.data):null)}
  if((saved.get(issuer.branch)?.autoFrom||'')!==issuer.autoFrom&&user.roleId!=='super-admin')throw new Error('Only a super admin can set or change the date automatic invoices start.');
  await db.batch(branches.map(branch=>db.prepare('INSERT INTO invoice_issuers(id,owner,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE invoice_issuers.owner=excluded.owner').bind(owner+':'+branch,owner,JSON.stringify({...issuer,branch,autoFrom:branch===issuer.branch?issuer.autoFrom:saved.get(branch)?.autoFrom||''}))));return Response.json({saved:true});}
 // Invoice the payments received in one branch since its go-live date (and, for the daily run, since a later date)
 // that have no invoice yet. Skips a payment a hand-made invoice already seems to cover, and a VAT mismatch.
 if(body.action==='issueDue'){const branch=body.branch==='111'?'111':'BHB';checkBranch(user,branch);const on=today(),since=typeof body.since==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(body.since)?body.since:'';
  const issuerRow:any=await db.prepare('SELECT data FROM invoice_issuers WHERE id=? AND owner=?').bind(owner+':'+branch,owner).first();if(!issuerRow)return Response.json({created:0,reason:'Save your company details (seller) for this branch in Accounts before issuing a tax invoice.'});
  const issuer=JSON.parse(issuerRow.data);if(!issuer.autoFrom)return Response.json({created:0,reason:'Automatic invoices are off for '+branch+'. Set "Issue invoices automatically from" in Accounts (your company details) to turn them on.'});
  const from=since>issuer.autoFrom?since:issuer.autoFrom;
  const offices=new Map(((await db.prepare('SELECT id,data FROM offices WHERE owner=?').bind(owner).all()).results as any[]).map(r=>[r.id,JSON.parse(r.data)]));
  const invoices=((await db.prepare('SELECT id,office_id AS "officeId",data FROM invoices WHERE owner=?').bind(owner).all()).results as any[]).map(r=>({...JSON.parse(r.data),officeId:r.officeId}));const invoiced=new Set(invoices.map(i=>i.paymentId).filter(Boolean));
  const due=((await db.prepare('SELECT data FROM payments WHERE owner=?').bind(owner).all()).results as any[]).map(r=>JSON.parse(r.data)).filter(p=>receivedForInvoice(p,from)&&!invoiced.has(p.id)&&offices.has(p.officeId)&&!offices.get(p.officeId).leaseClosed&&(offices.get(p.officeId).branch||'BHB')===branch).sort((a,b)=>(a.actual||'').localeCompare(b.actual||'')).slice(0,200);
  const created:string[]=[],skipped:string[]=[];
  for(const p of due){try{const r=await autoInvoice(db,owner,p,offices.get(p.officeId),on,{userId:user.userId,name:user.name});if(r.id)created.push(r.id);else if(r.skipped)skipped.push(r.skipped)}catch(e){skipped.push(p.reference+': '+(e as Error).message)}}
  return Response.json({created:created.length,skipped:skipped.length,notes:skipped.slice(0,5)});}
 const input=invoiceSchema.parse(body);if(input.officeId)await checkOffice(db,owner,user,input.officeId);else{const row:any=await db.prepare('SELECT data FROM customers WHERE id=? AND owner=?').bind(input.customerId,owner).first();if(!row)throw new Error('Customer not found.');checkBranch(user,JSON.parse(row.data).branch||'BHB')}return Response.json(await createInvoice(db,owner,input));}catch(e){return failure(e);}}
