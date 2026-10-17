import {z} from 'zod';
import {allow} from '@/lib/server-records';
import {hashPassword,loadRoles} from '@/lib/auth';
import {BRANCHES,SUPER_ADMIN,type Access} from '@/lib/access';
import {revokeAllClaudeAccess} from '@/lib/claude-keys';
import type {Database} from '@/db';
// Dashboard logins, shared by Users & roles (Advanced settings) and the employee form, which creates or changes the
// login of that employee in the same save. checkLogin runs every rule before anything is written; writeLogin saves.
export const person=z.object({id:z.string().optional(),name:z.string().trim().min(1).max(120),email:z.string().trim().toLowerCase().email().max(200),roleId:z.string().min(1).max(80),branches:z.array(z.enum(BRANCHES)).max(BRANCHES.length).default([]),active:z.boolean().default(true),employeeId:z.string().max(80).default(''),password:z.string().max(200).optional()});
export const password=z.string().min(10,'Use at least 10 characters for the password.').max(200);
export type LoginPlan={data:z.infer<typeof person>;staysAdmin:boolean};
export const isSuperAdminLogin=async(db:Database,id:string)=>!!(await db.prepare('SELECT data FROM users WHERE id=?').bind(id).first<{data:string}>())?.data.includes('"roleId":"'+SUPER_ADMIN+'"');
// Only a super admin can create, change or reset a super admin, and at least one active super admin must remain.
// newEmployee: the employee record is saved right after this check, so it does not exist yet.
export async function checkLogin(db:Database,user:Access,body:unknown,{newEmployee=false}={}):Promise<LoginPlan>{
 const superAdmin=user.roleId===SUPER_ADMIN,data=person.parse(body);
 if(!(await loadRoles(db)).some(r=>r.id===data.roleId))throw new Error('Choose a role.');if(data.roleId!==SUPER_ADMIN&&!data.branches.length)throw new Error('Choose at least one branch.');
 // A login can be linked to one employee record (their job, commission and leases sold).
 // A login still pointing to a deleted employee is unlinked when saved, rather than refused.
 if(data.employeeId&&!newEmployee&&data.id&&!(await db.prepare('SELECT id FROM employees WHERE id=?').bind(data.employeeId).first())){const was=await db.prepare('SELECT data FROM users WHERE id=?').bind(data.id).first<{data:string}>();if(was&&JSON.parse(was.data).employeeId===data.employeeId)data.employeeId=''}
 if(data.employeeId&&!newEmployee){if(!(await db.prepare('SELECT id FROM employees WHERE id=?').bind(data.employeeId).first()))throw new Error('Employee not found.');const taken=await db.prepare("SELECT id FROM users WHERE data::jsonb->>'employeeId'=? AND id<>?").bind(data.employeeId,data.id||'').first();if(taken)throw new Error('This employee already has a login.');}
 const existing=data.id?await db.prepare('SELECT data FROM users WHERE id=?').bind(data.id).first<{data:string}>():null;if(data.id&&!existing)throw new Error('User not found.');
 const old=existing?JSON.parse(existing.data):null,wasAdmin=old?.roleId===SUPER_ADMIN&&old?.active,staysAdmin=data.roleId===SUPER_ADMIN&&data.active;
 if(!superAdmin)allow(data.roleId!==SUPER_ADMIN&&old?.roleId!==SUPER_ADMIN);
 if(wasAdmin&&!staysAdmin){const others=await db.prepare("SELECT COUNT(*) AS n FROM users WHERE id<>? AND data::jsonb->>'roleId'=? AND (data::jsonb->>'active')::boolean").bind(data.id,SUPER_ADMIN).first<{n:string|number}>();if(!Number(others?.n))throw new Error('Keep at least one active super admin.');}
 if(!data.id||data.password)password.parse(data.password);
 if(await db.prepare('SELECT id FROM users WHERE email=? AND id<>?').bind(data.email,data.id||'').first())throw new Error('This email already has an account.');
 return {data,staysAdmin};
}
export async function writeLogin(db:Database,user:Access,{data,staysAdmin}:LoginPlan):Promise<{id:string;signOut:boolean}>{
 const {password:pw,id:_id,...fields}=data,record=JSON.stringify(fields);void _id;
 if(data.id){await db.prepare('UPDATE users SET email=?,data=? WHERE id=?').bind(data.email,record,data.id).run();if(pw)await db.prepare('UPDATE users SET password=? WHERE id=?').bind(await hashPassword(password.parse(pw)),data.id).run();
  // A new password or a deactivation also ends every Claude key and connection of that person.
  if(pw||!data.active)await revokeAllClaudeAccess(db,data.id);return {id:data.id,signOut:data.id===user.userId&&!staysAdmin};}
 const id=crypto.randomUUID();await db.prepare('INSERT INTO users(id,email,password,data,created) VALUES(?,?,?,?,?)').bind(id,data.email,await hashPassword(password.parse(pw)),record,new Date().toISOString()).run();return {id,signOut:!!user.bootstrap&&staysAdmin};
}
