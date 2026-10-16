import {z} from 'zod';
import {context,failure,allow} from '@/lib/server-records';
import {hashPassword,loadRoles} from '@/lib/auth';
import {BRANCHES,SUPER_ADMIN} from '@/lib/access';
const person=z.object({id:z.string().optional(),name:z.string().trim().min(1).max(120),email:z.string().trim().toLowerCase().email().max(200),roleId:z.string().min(1).max(80),branches:z.array(z.enum(BRANCHES)).max(BRANCHES.length).default([]),active:z.boolean().default(true),employeeId:z.string().max(80).default(''),password:z.string().max(200).optional()});
const password=z.string().min(10,'Use at least 10 characters for the password.').max(200);
// Only Users & roles editors get here. Only a super admin can create, change or reset a super admin,
// and at least one active super admin must always remain.
export async function POST(req:Request){try{const{db,user}=await context(req,'users','edit');const body=await req.json() as {action?:string;id?:string;password?:string};
const superAdmin=user.roleId===SUPER_ADMIN,isAdmin=async(id:string)=>(await db.prepare('SELECT data FROM users WHERE id=?').bind(id).first<{data:string}>())?.data.includes('"roleId":"'+SUPER_ADMIN+'"');
if(body.action==='password'){if(!superAdmin)allow(!(await isAdmin(String(body.id))));const pw=password.parse(body.password);const r=await db.prepare('UPDATE users SET password=? WHERE id=? RETURNING id').bind(await hashPassword(pw),String(body.id)).first();if(!r)throw new Error('User not found.');return Response.json({id:body.id});}
const data=person.parse(body);if(!(await loadRoles(db)).some(r=>r.id===data.roleId))throw new Error('Choose a role.');if(data.roleId!==SUPER_ADMIN&&!data.branches.length)throw new Error('Choose at least one branch.');
// A login can be linked to one employee record (their job, commission and leases sold).
if(data.employeeId){if(!(await db.prepare('SELECT id FROM employees WHERE id=?').bind(data.employeeId).first()))throw new Error('Employee not found.');const taken=await db.prepare("SELECT id FROM users WHERE data::jsonb->>'employeeId'=? AND id<>?").bind(data.employeeId,data.id||'').first();if(taken)throw new Error('This employee already has a login.');}
const existing=data.id?await db.prepare('SELECT data FROM users WHERE id=?').bind(data.id).first<{data:string}>():null;if(data.id&&!existing)throw new Error('User not found.');
const old=existing?JSON.parse(existing.data):null,wasAdmin=old?.roleId===SUPER_ADMIN&&old?.active,staysAdmin=data.roleId===SUPER_ADMIN&&data.active;
if(!superAdmin)allow(data.roleId!==SUPER_ADMIN&&old?.roleId!==SUPER_ADMIN);
if(wasAdmin&&!staysAdmin){const others=await db.prepare("SELECT COUNT(*) AS n FROM users WHERE id<>? AND data::jsonb->>'roleId'=? AND (data::jsonb->>'active')::boolean").bind(data.id,SUPER_ADMIN).first<{n:string|number}>();if(!Number(others?.n))throw new Error('Keep at least one active super admin.');}
const {password:pw,id:_,...fields}=data,record=JSON.stringify(fields);
if(data.id){await db.prepare('UPDATE users SET email=?,data=? WHERE id=?').bind(data.email,record,data.id).run();if(pw)await db.prepare('UPDATE users SET password=? WHERE id=?').bind(await hashPassword(password.parse(pw)),data.id).run();return Response.json({id:data.id,signOut:data.id===user.userId&&!staysAdmin});}
const id=crypto.randomUUID();await db.prepare('INSERT INTO users(id,email,password,data,created) VALUES(?,?,?,?,?)').bind(id,data.email,await hashPassword(password.parse(pw)),record,new Date().toISOString()).run();return Response.json({id,signOut:!!user.bootstrap&&staysAdmin});}
catch(e){const r=failure(e);const body=await r.json() as {error:string};return Response.json({error:body.error==='This office code already exists.'?'This email already has an account.':body.error},{status:r.status});}}
