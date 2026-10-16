import {z} from 'zod';
import {context,failure,allow} from '@/lib/server-records';
import {listKeys,createKey,revokeKey} from '@/lib/claude-keys';
import {listGrants,revokeGrant} from '@/lib/oauth';
// Each person manages only their own Claude access: Claude sign-ins (connections) and personal keys for
// Claude Code. The temporary setup account cannot have any.
export async function GET(req:Request){try{const{db,user}=await context(req);return Response.json(user.bootstrap?{keys:[],connections:[]}:{keys:await listKeys(db,user.userId),connections:await listGrants(db,user.userId)});}catch(e){return failure(e);}}
export async function POST(req:Request){try{const{db,user}=await context(req);allow(!user.bootstrap);const{label}=z.object({label:z.string().trim().min(1,'Name the key, for example "Claude Code on my laptop".').max(80)}).parse(await req.json());return Response.json(await createKey(db,user.userId,label));}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{const{db,user}=await context(req);const{id,kind}=z.object({id:z.string().min(1),kind:z.enum(['key','connection'])}).parse(await req.json());await (kind==='key'?revokeKey:revokeGrant)(db,user.userId,id);return Response.json({id});}catch(e){return failure(e);}}
