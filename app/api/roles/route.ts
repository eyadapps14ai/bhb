import {z} from 'zod';
import {context,failure} from '@/lib/server-records';
import {normaliseRole,SUPER_ADMIN} from '@/lib/access';
const input=z.object({roles:z.array(z.object({id:z.string().min(1).max(80),name:z.string().trim().min(1).max(80),pages:z.record(z.string(),z.string()),components:z.record(z.string(),z.boolean())})).max(20)});
// Saves the permission matrix. The super admin role always keeps full access, so nobody can lock themselves out.
export async function POST(req:Request){try{const{db}=await context(req,'users','edit');const {roles}=input.parse(await req.json());const saved=roles.filter(r=>r.id!==SUPER_ADMIN).map(r=>normaliseRole(r as never));if(saved.length)await db.batch(saved.map(r=>db.prepare('INSERT INTO roles(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(r.id,JSON.stringify(r))));return Response.json({saved:saved.length});}catch(e){return failure(e);}}
