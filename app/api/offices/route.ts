import {z} from 'zod';
import {officeSchema,paymentSchema,leaseRoom,today} from '@/lib/records';
const aedText=(n:number)=>'AED '+new Intl.NumberFormat('en-AE',{maximumFractionDigits:2}).format(n);
import {can} from '@/lib/access';
import type {Database} from '@/db';
import {context,failure,checkOffice,checkBranch} from '@/lib/server-records';
// A lease may arrive with a payment schedule: one pending rent payment per row, saved together with the office.
const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use a valid date');
const money=z.coerce.number().finite().min(0).max(1e11);
const scheduleSchema=z.object({on:z.boolean(),method:z.enum(['Check','Transfer','Cash']).default('Check'),rows:z.array(z.object({due:isoDate,amount:money,vat:money.default(0),deposit:money.default(0)})).max(24)}).nullable().optional();
// Many offices at once (Admin #784): numbers From..To with an optional prefix, all Available until they are leased.
// One transaction; a number that already exists is skipped and reported, never overwritten.
const bulkSchema=z.object({from:z.coerce.number().int().min(0).max(99999),to:z.coerce.number().int().min(0).max(99999),prefix:z.string().trim().max(20).default(''),branch:z.enum(['BHB','111']),kind:z.enum(['Physical','Virtual']),location:z.string().max(2000).default(''),area:z.coerce.number().finite().min(0).max(1e7).default(0),desks:z.coerce.number().int().min(0).max(100000).default(0),vat:z.coerce.number().finite().min(0).max(100).default(0)}).refine(b=>b.to>=b.from,'"To" must not be below "From".').refine(b=>b.to-b.from<200,'Add up to 200 offices at a time.');
async function addMany(db:Database,owner:string,body:unknown){const b=bulkSchema.parse(body),rows:{id:string;code:string;data:string}[]=[];
 // The code column holds branch + ':' + number (as single saves do); numbers already in this branch are skipped first,
 // using the same test as the single-save duplicate check, so older rows are covered too.
 const taken=new Set(((await db.prepare("SELECT data::jsonb->>'code' AS code FROM offices WHERE owner=? AND COALESCE(data::jsonb->>'branch','BHB')=?").bind(owner,b.branch).all()).results as {code:string}[]).map(r=>r.code));
 for(let n=b.from;n<=b.to;n++){const code=b.prefix+n;if(taken.has(code))continue;const id=crypto.randomUUID(),o=officeSchema.parse({code,branch:b.branch,kind:b.kind,status:'Available',location:b.location,area:b.area,desks:b.desks,company:'',contact:'',email:'',phone:'',trn:'',billingAddress:'',licenseNumber:'',licenseExpiry:'',leaseReference:'',start:'',end:'',rent:0,period:'Yearly',deposit:0,vat:b.vat,services:'',notes:''});rows.push({id,code,data:JSON.stringify({...o,id})})}
 const res=rows.length?await db.batch(rows.map(r=>db.prepare("INSERT INTO offices (id,owner,code,data) VALUES (?,?,?,?) ON CONFLICT (owner,code) DO NOTHING RETURNING data::jsonb->>'code' AS code").bind(r.id,owner,b.branch+':'+r.code,r.data))):[];
 const made=new Set((res as {results:{code:string}[]}[]).flatMap(r=>r.results.map(x=>x.code))),all=Array.from({length:b.to-b.from+1},(_,i)=>b.prefix+(b.from+i));return {created:made.size,skipped:all.filter(c=>!made.has(c))}}
export async function POST(req:Request){try{const{db,owner,user}=await context(req,'offices','edit');const body:any=await req.json();if(body.action==='bulk'){checkBranch(user,body.branch);return Response.json(await addMany(db,owner,body))}const data=officeSchema.parse(body);const plan=scheduleSchema.parse(body.schedule??null);checkBranch(user,data.branch);const id=data.id||crypto.randomUUID();let before:{company?:string;start?:string}|null=null;if(data.id){await checkOffice(db,owner,user,id);const row:any=await db.prepare('SELECT data FROM offices WHERE id=? AND owner=?').bind(id,owner).first();const old=JSON.parse(row.data);before=old;if(old.company&&data.company!==old.company)throw new Error('Cancel the existing lease and confirm vacancy before replacing the tenant.');if(old.leaseClosed&&old.company)throw new Error('Confirm vacancy in Lease history before changing this office.');data.leaseClosed=!!old.leaseClosed&&!!old.company;}
 // A tenant with lease dates means the office is let. The map and the connector read Status while Leases reads tenant
 // and start, so a lease saved with Status left on Available showed a let office as Vacant (#679).
 const madeActive=!!(data.company&&data.start&&data.end&&!data.leaseClosed&&data.status==='Available');if(madeActive)data.status='Active';const activeNote='Status set to Active: this office has a tenant and lease dates. To free it, cancel the lease in Leases.';
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
 if(created){const r:any=await db.prepare("SELECT COUNT(*) AS n FROM payments WHERE owner=? AND office_id=? AND data::jsonb->>'scheduleBatch'=?").bind(owner,id,batchId).first();const saved=Number(r?.n)||0;if(!saved)return Response.json({id,payments:0,note:'Saved. No new payments were added: this lease already has a payment schedule for these dates.'+(madeActive?' '+activeNote:'')});created=saved}
 return Response.json({id,payments:created,...(madeActive?{note:activeNote}:{})});}catch(e){return failure(e);}}
