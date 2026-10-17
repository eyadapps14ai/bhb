import {context,failure,allow} from '@/lib/server-records';
import {SUPER_ADMIN} from '@/lib/access';
import {revokeAllClaudeAccess} from '@/lib/claude-keys';
import {checkLogin,writeLogin,password,isSuperAdminLogin} from '@/lib/server-users';
import {hashPassword} from '@/lib/auth';
// Only Users & roles editors get here. The rules for logins live in lib/server-users (the employee form uses them too).
export async function POST(req:Request){try{const{db,user}=await context(req,'users','edit');const body=await req.json() as {action?:string;id?:string;password?:string};
if(body.action==='password'){if(user.roleId!==SUPER_ADMIN)allow(!(await isSuperAdminLogin(db,String(body.id))));const pw=password.parse(body.password);const r=await db.prepare('UPDATE users SET password=? WHERE id=? RETURNING id').bind(await hashPassword(pw),String(body.id)).first();if(!r)throw new Error('User not found.');await revokeAllClaudeAccess(db,String(body.id));return Response.json({id:body.id});}
return Response.json(await writeLogin(db,user,await checkLogin(db,user,body)));}
catch(e){const r=failure(e);const body=await r.json() as {error:string};return Response.json({error:body.error==='This office code already exists.'?'This email already has an account.':body.error},{status:r.status});}}
