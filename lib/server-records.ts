import {getDb,type Database} from '@/db';
import {getUser} from './auth';
import {getBucket} from './storage';
import {can,type Access,type Page} from './access';
import {ZodError} from 'zod';
// All staff share one set of records; each person's role decides which pages and branches they can use.
const SHARED_OWNER='bhb';
export const DENIED='Your role does not allow this.';
// Every route names the page it belongs to and whether it reads or changes it; branches are checked per record.
export async function context(request:Request,page?:Page,level:'view'|'edit'='view'){const user=await getUser();if(!user)throw new Error('Sign in to access your records.');if(page&&!can(user,page,level))throw new Error(DENIED);if(request.method!=='GET'){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new Error('Request origin does not match.');}return{db:await openDb(),owner:SHARED_OWNER,bucket:getBucket(),user};}
export function allow(ok:boolean){if(!ok)throw new Error(DENIED);}
export function checkBranch(user:Access,branch:string|null|undefined){allow(user.branches.includes(branch||'BHB'));}
// Connection errors name internal hosts, so callers only ever see a generic message.
export async function openDb():Promise<Database>{try{return await getDb();}catch(e){console.error('Database connection failed',e instanceof Error?e.message:e);throw new Error('Record storage is unavailable. Please try again.');}}
export function failure(error:unknown){const sqlState=error&&typeof error==='object'&&'severity' in error?String((error as {code?:unknown}).code):null;console.error('Record request failed',error instanceof Error?error.name:'Unknown error',sqlState??'');const message=error instanceof ZodError?error.issues.map(i=>i.message).join('\n'):sqlState==='23505'?'This office code already exists.':sqlState?'Unable to save records. Please try again.':error instanceof Error?error.message:'Unable to save. Please try again.';return Response.json({error:message},{status:message.includes('Sign in')?401:message===DENIED?403:400});}
export async function checkOffice(db:Database,owner:string,user:Access,id:string|null){if(!id)return;const row=await db.prepare('SELECT data FROM offices WHERE id=? AND owner=?').bind(id,owner).first<{data:string}>();if(!row)throw new Error('Office not found.');checkBranch(user,JSON.parse(row.data).branch);}
