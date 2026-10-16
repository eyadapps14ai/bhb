import {z} from 'zod';
import {can} from '@/lib/access';
import {context,failure} from '@/lib/server-records';
// To-dos: people who manage Users & roles (and the super admin) send them; the person they are for marks them done.
const create=z.object({action:z.literal('create'),assignee:z.string().min(1),title:z.string().trim().min(1).max(200),details:z.string().trim().max(4000).default(''),due:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default('')});
const status=z.object({action:z.literal('setStatus'),id:z.string().min(1),status:z.enum(['Open','Done'])});
const remove=z.object({action:z.literal('delete'),id:z.string().min(1)});
export async function POST(req:Request){try{const{db,owner,user}=await context(req);const body:any=await req.json(),manager=can(user,'users','edit');
 if(body.action==='create'){if(!manager)throw new Error('Only people who manage Users & roles can send to-dos.');const input=create.parse(body);
  const row:any=await db.prepare('SELECT data FROM users WHERE id=?').bind(input.assignee).first();if(!row)throw new Error('Choose who this to-do is for.');const person=JSON.parse(row.data);
  const id=crypto.randomUUID(),data={title:input.title,details:input.details,due:input.due,status:'Open',assigneeName:person.name||'',createdBy:user.userId,createdByName:user.name,created:new Date().toISOString(),doneAt:''};
  await db.prepare('INSERT INTO tasks (id,owner,assignee,data) VALUES (?,?,?,?)').bind(id,owner,input.assignee,JSON.stringify(data)).run();return Response.json({id});}
 const input=body.action==='delete'?remove.parse(body):status.parse(body);const row:any=await db.prepare('SELECT assignee,data FROM tasks WHERE id=? AND owner=?').bind(input.id,owner).first();if(!row)throw new Error('To-do not found.');
 if(input.action==='delete'){if(!manager)throw new Error('Only people who manage Users & roles can delete to-dos.');await db.prepare('DELETE FROM tasks WHERE id=? AND owner=?').bind(input.id,owner).run();return Response.json({deleted:true});}
 if(!manager&&row.assignee!==user.userId)throw new Error('This to-do is for someone else.');
 const data={...JSON.parse(row.data),status:input.status,doneAt:input.status==='Done'?new Date().toISOString():''};await db.prepare('UPDATE tasks SET data=? WHERE id=? AND owner=?').bind(JSON.stringify(data),input.id,owner).run();return Response.json({id:input.id,status:input.status});}catch(e){return failure(e);}}
