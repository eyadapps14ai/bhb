import {z} from 'zod';
import {context,failure,allow} from '@/lib/server-records';
import {can,SUPER_ADMIN} from '@/lib/access';
import {listKeys,createKey,revokeKey,listAllKeys} from '@/lib/claude-keys';
import {listGrants,revokeGrant,listAllGrants} from '@/lib/oauth';
// Each person manages their own Claude access: Claude connections and personal keys for Claude Code.
// People who edit Users & roles also see everyone's and can revoke them; only a super admin can revoke a
// super admin's. The temporary setup account has none.
export async function GET(req:Request){try{const{db,user}=await context(req);if(user.bootstrap)return Response.json({keys:[],connections:[]});
 const mine={keys:await listKeys(db,user.userId),connections:await listGrants(db,user.userId)};
 return Response.json(can(user,'users','edit')?{...mine,everyone:{keys:await listAllKeys(db),connections:await listAllGrants(db)}}:mine);}catch(e){return failure(e);}}
export async function POST(req:Request){try{const{db,user}=await context(req);allow(!user.bootstrap);const{label}=z.object({label:z.string().trim().min(1,'Name the key, for example "Claude Code on my laptop".').max(80)}).parse(await req.json());return Response.json(await createKey(db,user.userId,label));}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{const{db,user}=await context(req);const{id,kind,anyone}=z.object({id:z.string().min(1),kind:z.enum(['key','connection']),anyone:z.boolean().default(false)}).parse(await req.json());
 if(anyone){allow(can(user,'users','edit'));const all=kind==='key'?await listAllKeys(db):await listAllGrants(db),item=all.find(x=>x.id===id);if(!item)throw new Error(kind==='key'?'Key not found.':'Connection not found.');allow(item.roleId!==SUPER_ADMIN||user.roleId===SUPER_ADMIN);}
 await (kind==='key'?revokeKey:revokeGrant)(db,anyone?null:user.userId,id);return Response.json({id});}catch(e){return failure(e);}}
