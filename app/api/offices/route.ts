import {z} from 'zod';
import {officeSchema,paymentSchema} from '@/lib/records';
import {can} from '@/lib/access';
import {context,failure,checkOffice,checkBranch} from '@/lib/server-records';
// A lease may arrive with a payment schedule: one pending rent payment per row, saved together with the office.
const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use a valid date');
const money=z.coerce.number().finite().min(0).max(1e11);
const scheduleSchema=z.object({on:z.boolean(),method:z.enum(['Check','Transfer','Cash']).default('Check'),rows:z.array(z.object({due:isoDate,amount:money,vat:money.default(0),deposit:money.default(0)})).max(24)}).nullable().optional();
export async function POST(req:Request){try{const{db,owner,user}=await context(req,'offices','edit');const body:any=await req.json();const data=officeSchema.parse(body);const plan=scheduleSchema.parse(body.schedule??null);checkBranch(user,data.branch);const id=data.id||crypto.randomUUID();if(data.id){await checkOffice(db,owner,user,id);const row:any=await db.prepare('SELECT data FROM offices WHERE id=? AND owner=?').bind(id,owner).first();const old=JSON.parse(row.data);if(old.company&&data.company!==old.company)throw new Error('Cancel the existing lease and confirm vacancy before replacing the tenant.');if(old.leaseClosed&&old.company)throw new Error('Confirm vacancy in Lease history before changing this office.');data.leaseClosed=!!old.leaseClosed&&!!old.company;}const duplicate=await db.prepare("SELECT id FROM offices WHERE owner=? AND id<>? AND (data::jsonb->>'code')=? AND COALESCE(data::jsonb->>'branch','BHB')=?").bind(owner,id,data.code,data.branch).first();if(duplicate)throw new Error('This office number already exists in this branch.');
 const statements=[db.prepare('INSERT INTO offices (id,owner,code,data) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,data=excluded.data WHERE offices.owner=excluded.owner').bind(id,owner,data.branch+':'+data.code,JSON.stringify({...data,id}))];
 let created=0;
 if(plan?.on&&plan.rows.length){
  if(!can(user,'cash','edit'))throw new Error('Saving a payment schedule needs edit rights on Cash flow. Untick the schedule or ask an admin.');
  if(!data.company||!data.start||!data.end)throw new Error('Add the tenant and lease dates before creating a payment schedule.');
  const n=plan.rows.length,today=new Date().toISOString().slice(0,10),base=(data.leaseReference||data.code).slice(0,90);
  for(const[i,r]of plan.rows.entries()){
   let reference=base+'-'+(i+1)+'/'+n;
   if(await db.prepare("SELECT p.id FROM payments p LEFT JOIN offices o ON o.id=p.office_id AND o.owner=p.owner WHERE p.owner=? AND (p.data::jsonb->>'direction')='Income' AND (p.data::jsonb->>'reference')=? AND COALESCE(o.data::jsonb->>'branch',p.data::jsonb->>'branch','BHB')=?").bind(owner,reference,data.branch).first())reference+='-'+crypto.randomUUID().slice(0,4);
   const pay=paymentSchema.parse({officeId:id,direction:'Income',branch:data.branch,reference,party:data.company,incomeType:'Rent',method:plan.method,category:'Rent',description:'Rent '+(i+1)+' of '+n+' · '+data.code,entryDate:today,due:r.due,amount:r.amount,vatAmount:r.vat,securityDeposit:r.deposit,status:'Pending',notes:'Created from the lease payment schedule.'});
   const pid=crypto.randomUUID();statements.push(db.prepare('INSERT INTO payments (id,owner,office_id,data) VALUES (?,?,?,?)').bind(pid,owner,id,JSON.stringify({...pay,leaseId:null,id:pid})));created++;
  }
 }
 await db.batch(statements);return Response.json({id,payments:created});}catch(e){return failure(e);}}
