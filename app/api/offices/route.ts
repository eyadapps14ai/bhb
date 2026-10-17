import {z} from 'zod';
import {officeSchema,paymentSchema,leaseRoom,today} from '@/lib/records';
const aedText=(n:number)=>'AED '+new Intl.NumberFormat('en-AE',{maximumFractionDigits:2}).format(n);
import {can} from '@/lib/access';
import {context,failure,checkOffice,checkBranch} from '@/lib/server-records';
// A lease may arrive with a payment schedule: one pending rent payment per row, saved together with the office.
const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use a valid date');
const money=z.coerce.number().finite().min(0).max(1e11);
const scheduleSchema=z.object({on:z.boolean(),method:z.enum(['Check','Transfer','Cash']).default('Check'),rows:z.array(z.object({due:isoDate,amount:money,vat:money.default(0),deposit:money.default(0)})).max(24)}).nullable().optional();
export async function POST(req:Request){try{const{db,owner,user}=await context(req,'offices','edit');const body:any=await req.json();const data=officeSchema.parse(body);const plan=scheduleSchema.parse(body.schedule??null);checkBranch(user,data.branch);const id=data.id||crypto.randomUUID();let before:{company?:string;start?:string}|null=null;if(data.id){await checkOffice(db,owner,user,id);const row:any=await db.prepare('SELECT data FROM offices WHERE id=? AND owner=?').bind(id,owner).first();const old=JSON.parse(row.data);before=old;if(old.company&&data.company!==old.company)throw new Error('Cancel the existing lease and confirm vacancy before replacing the tenant.');if(old.leaseClosed&&old.company)throw new Error('Confirm vacancy in Lease history before changing this office.');data.leaseClosed=!!old.leaseClosed&&!!old.company;}
 // Leases on one office must not overlap: a new tenant, or a new start date, must begin after the last tenant's
 // move-out in Lease history. Saves that keep the tenant and start date as they are (other edits) are not checked.
 if(data.company&&data.start&&(!before?.company||before.start!==data.start)){const last=await db.prepare("SELECT MAX(data::jsonb->>'moveOut') AS d FROM leases WHERE owner=? AND office_id=?").bind(owner,id).first<{d:string|null}>();
  if(last?.d&&data.start<=last.d){const day=(d:string)=>new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}),next=new Date(Date.parse(last.d+'T00:00:00Z')+864e5).toISOString().slice(0,10);
   throw new Error('This office was occupied until '+day(last.d)+' (the last tenant moved out then). Start the new lease on '+day(next)+' or later.');}}const duplicate=await db.prepare("SELECT id FROM offices WHERE owner=? AND id<>? AND (data::jsonb->>'code')=? AND COALESCE(data::jsonb->>'branch','BHB')=?").bind(owner,id,data.code,data.branch).first();if(duplicate)throw new Error('This office number already exists in this branch.');
 const statements=[db.prepare('INSERT INTO offices (id,owner,code,data) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,data=excluded.data WHERE offices.owner=excluded.owner').bind(id,owner,data.branch+':'+data.code,JSON.stringify({...data,id}))];
 let created=0,batchId='';
 if(plan?.on&&plan.rows.length){
  if(!can(user,'cash','edit'))throw new Error('Saving a payment schedule needs edit rights on Cash flow. Untick the schedule or ask an admin.');
  if(!data.company||!data.start||!data.end)throw new Error('Add the tenant and lease dates before creating a payment schedule.');
  const existingRows:any[]=data.id?((await db.prepare('SELECT data FROM payments WHERE owner=? AND office_id=?').bind(owner,id).all()).results||[]):[];const room=leaseRoom(data,existingRows.map(r=>JSON.parse(r.data)),id),planned=plan.rows.reduce((a,r)=>a+r.amount,0);
  if(room.value>0&&planned>room.left+0.5)throw new Error('The schedule adds '+aedText(planned)+' of rent but the lease is worth '+aedText(room.value)+(room.used?' and '+aedText(room.used)+' is already recorded':'')+'. Lower the amounts or press Recalculate.');
  batchId=crypto.randomUUID();const n=plan.rows.length,entry=today(),base=(data.leaseReference||data.code).slice(0,90);
  for(const[i,r]of plan.rows.entries()){
   let reference=base+'-'+(i+1)+'/'+n;
   if(await db.prepare("SELECT p.id FROM payments p LEFT JOIN offices o ON o.id=p.office_id AND o.owner=p.owner WHERE p.owner=? AND (p.data::jsonb->>'direction')='Income' AND (p.data::jsonb->>'reference')=? AND COALESCE(o.data::jsonb->>'branch',p.data::jsonb->>'branch','BHB')=?").bind(owner,reference,data.branch).first())reference+='-'+crypto.randomUUID().slice(0,4);
   const pay=paymentSchema.parse({officeId:id,direction:'Income',branch:data.branch,reference,party:data.company,incomeType:'Rent',method:plan.method,category:'Rent',description:'Rent '+(i+1)+' of '+n+' · '+data.code,entryDate:entry,due:r.due,amount:r.amount,vatAmount:r.vat,securityDeposit:r.deposit,status:'Pending',notes:'Created from the lease payment schedule.'});
   // Two people saving a schedule for the same lease at once: the lock makes the second wait, and it then inserts
   // nothing because the first schedule's rows exist for this term.
   const pid=crypto.randomUUID();statements.push(db.prepare("INSERT INTO payments (id,owner,office_id,data) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.owner=? AND p.office_id=? AND p.data::jsonb->>'scheduleBatch' IS NOT NULL AND p.data::jsonb->>'scheduleBatch'<>? AND p.data::jsonb->>'due' BETWEEN ? AND ? AND COALESCE(p.data::jsonb->>'leaseId','')='' AND p.data::jsonb->>'status' NOT IN ('Cancelled','Bounced'))").bind(pid,owner,id,JSON.stringify({...pay,leaseId:null,id:pid,scheduleBatch:batchId}),owner,id,batchId,data.start,data.end));created++;
  }
 }
 if(created)statements.unshift(db.prepare('SELECT pg_advisory_xact_lock(hashtext(?))').bind('schedule:'+id));
 await db.batch(statements);
 if(created){const r:any=await db.prepare("SELECT COUNT(*) AS n FROM payments WHERE owner=? AND office_id=? AND data::jsonb->>'scheduleBatch'=?").bind(owner,id,batchId).first();const saved=Number(r?.n)||0;if(!saved)return Response.json({id,payments:0,note:'Saved. No new payments were added: this lease already has a payment schedule for these dates.'});created=saved}
 return Response.json({id,payments:created});}catch(e){return failure(e);}}
