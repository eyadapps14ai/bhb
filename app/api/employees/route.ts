import {z} from 'zod';
import {context,failure,checkBranch,allow} from '@/lib/server-records';
import {has,can,JOBS,DEFAULT_RATES,SUPER_ADMIN} from '@/lib/access';
import {checkLogin,writeLogin} from '@/lib/server-users';
const schema=z.object({id:z.string().optional(),name:z.string().trim().min(1).max(200),email:z.string().email(),phone:z.string().max(80).default(''),position:z.string().max(200).default(''),job:z.enum(JOBS).default('Other'),commissionNew:z.coerce.number().finite().min(0).max(100).default(DEFAULT_RATES.commissionNew),commissionRenewal:z.coerce.number().finite().min(0).max(100).default(DEFAULT_RATES.commissionRenewal),branch:z.enum(['BHB','111']),status:z.enum(['Active','Inactive']).default('Active')});
const loginPart=z.object({id:z.string().max(80).optional(),roleId:z.string().min(1).max(80),branches:z.array(z.string()).max(4).default([]),active:z.boolean().default(true),password:z.string().max(200).optional()});
// The employee form can also give the employee a dashboard login (role, branches, password) or change it, in one save.
// The login signs in with the employee's email; an existing login keeps its own email unless it was the old employee email.
// Every login rule is checked before the employee is written; a new employee is removed again if the login still fails.
export async function POST(req:Request){try{const{db,owner,user}=await context(req,'employees','edit');const body=await req.json() as {login?:unknown},data=schema.parse(body),id=data.id||crypto.randomUUID();checkBranch(user,data.branch);let previous:{name?:string;email?:string;branch?:string}|null=null;if(data.id){const old=await db.prepare('SELECT data FROM employees WHERE id=? AND owner=?').bind(id,owner).first<{data:string}>();if(!old)throw new Error('Employee not found.');const prev=JSON.parse(old.data);previous=prev;checkBranch(user,prev.branch);}
 let plan=null;if(body.login){allow(can(user,'users','edit'));const l=loginPart.parse(body.login);let email=data.email,name=data.name;
  if(l.id){const u=await db.prepare('SELECT email,data FROM users WHERE id=?').bind(l.id).first<{email:string;data:string}>();if(!u)throw new Error('User not found.');const ud=JSON.parse(u.data);if(ud.employeeId!==id)throw new Error('This login belongs to someone else.');
   if(!previous||u.email!==String(previous.email||'').trim().toLowerCase())email=u.email;if(previous&&ud.name!==previous.name)name=ud.name;}
  plan=await checkLogin(db,user,{id:l.id,name,email,roleId:l.roleId,branches:l.roleId===SUPER_ADMIN?[]:l.branches,active:l.active,employeeId:id,password:l.password||undefined},{newEmployee:!data.id});}
 await db.prepare('INSERT INTO employees(id,owner,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE employees.owner=excluded.owner').bind(id,owner,JSON.stringify({...data,id})).run();
 if(!plan)return Response.json({id});
 try{const r=await writeLogin(db,user,plan);return Response.json({id,loginId:r.id,signOut:r.signOut});}catch(e){if(!data.id)await db.prepare('DELETE FROM employees WHERE id=? AND owner=?').bind(id,owner).run();throw e}}
catch(e){const r=failure(e);const b=await r.json() as {error:string};return Response.json({error:b.error==='This office code already exists.'?'This email already has an account.':b.error},{status:r.status});}}

export async function DELETE(req:Request){try{const{db,owner,user}=await context(req,'employees','edit');allow(has(user,'delete'));const body=z.object({id:z.string().min(1)}).parse(await req.json());const record=await db.prepare('SELECT data FROM employees WHERE id=? AND owner=?').bind(body.id,owner).first<{data:string}>();if(!record)throw new Error('Employee not found.');checkBranch(user,JSON.parse(record.data).branch);await db.prepare('DELETE FROM employees WHERE id=? AND owner=?').bind(body.id,owner).run();return Response.json({id:body.id});}catch(e){return failure(e);}}
