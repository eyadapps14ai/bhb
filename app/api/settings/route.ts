import {officeNumberingSchema} from '@/lib/records';
import {context,failure} from '@/lib/server-records';
// Workspace settings saved in Advanced settings (people who manage Users & roles): how office numbers are written.
export async function POST(req:Request){try{const{db,owner}=await context(req,'users','edit');const body=await req.json() as {action?:string};
 if(body.action!=='officeNumbering')throw new Error('Unknown setting.');const data=officeNumberingSchema.parse(body);
 await db.prepare('INSERT INTO app_settings (id,owner,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE app_settings.owner=excluded.owner').bind(owner+':officeNumbering',owner,JSON.stringify(data)).run();
 return Response.json(data);}catch(e){return failure(e);}}
