import {context,failure,checkOffice,checkBranch,allow} from '@/lib/server-records';
import {has} from '@/lib/access';
import {issuerSchema,invoiceSchema} from '@/lib/invoices';
import {today} from '@/lib/records';
import {createInvoice,invoiceFor,dueForInvoice} from '@/lib/server-invoices';
export async function POST(req:Request){try{const{db,owner,user}=await context(req,'cash','view');allow(has(user,'invoices'));const body:any=await req.json();if(body.action==='saveIssuer'){const issuer=issuerSchema.parse(body);for(const b of body.both?['BHB','111']:[issuer.branch])checkBranch(user,b);await db.batch((body.both?['BHB','111']:[issuer.branch]).map(branch=>db.prepare('INSERT INTO invoice_issuers(id,owner,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE invoice_issuers.owner=excluded.owner').bind(owner+':'+branch,owner,JSON.stringify({...issuer,branch}))));return Response.json({saved:true});}
 // Issue an invoice for every payment that is due one (cleared, or due today or earlier) in the branches this person sees.
 // since (optional): only payments due, or received, on or after that date; the daily automatic run uses the last 7 days.
 if(body.action==='issueDue'){const on=today(),since=typeof body.since==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(body.since)?body.since:'',okBranch=(b:string)=>{try{checkBranch(user,b);return true}catch{return false}};
  const offices=new Map(((await db.prepare('SELECT id,data FROM offices WHERE owner=?').bind(owner).all()).results as any[]).map(r=>[r.id,JSON.parse(r.data)]));
  const invoiced=new Set(((await db.prepare("SELECT data::jsonb->>'paymentId' AS pid FROM invoices WHERE owner=?").bind(owner).all()).results as any[]).map(r=>r.pid).filter(Boolean));
  const due=((await db.prepare('SELECT data FROM payments WHERE owner=?').bind(owner).all()).results as any[]).map(r=>JSON.parse(r.data)).filter(p=>dueForInvoice(p,on)&&(!since||(p.status==='Cleared'?(p.actual||p.due):p.due)>=since)&&!invoiced.has(p.id)&&offices.has(p.officeId)&&!offices.get(p.officeId).leaseClosed&&okBranch(offices.get(p.officeId).branch||'BHB')).sort((a,b)=>(a.due||'').localeCompare(b.due||'')).slice(0,200);
  const created:string[]=[],failed:string[]=[];
  for(const p of due){try{created.push((await createInvoice(db,owner,invoiceFor(p,offices.get(p.officeId),on))).id)}catch(e){const m=(e as Error).message;if(/supplier details/.test(m))return Response.json({created:created.length,waiting:due.length-created.length,reason:m});failed.push(p.reference+': '+m)}}
  return Response.json({created:created.length,waiting:failed.length,failed:failed.slice(0,5)});}
 const input=invoiceSchema.parse(body);await checkOffice(db,owner,user,input.officeId);return Response.json(await createInvoice(db,owner,input));}catch(e){return failure(e);}}
