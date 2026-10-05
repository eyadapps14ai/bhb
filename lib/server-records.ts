import {getDb,type Database} from '@/db';
import {getUser} from './auth';
import {getBucket} from './storage';
import {ZodError} from 'zod';
// All signed-in staff share one set of records; IAP controls who can sign in.
const SHARED_OWNER='bhb';
export async function context(request:Request){const user=await getUser();if(!user)throw new Error('Sign in to access your records.');if(request.method!=='GET'){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new Error('Request origin does not match.');}let db:Database;try{db=await getDb();}catch(e){console.error('Database connection failed',e instanceof Error?e.message:e);throw new Error('Record storage is unavailable. Please try again.');}return{db,owner:SHARED_OWNER,bucket:getBucket()};}
export function failure(error:unknown){const sqlState=error&&typeof error==='object'&&'severity' in error?String((error as {code?:unknown}).code):null;console.error('Record request failed',error instanceof Error?error.name:'Unknown error',sqlState??'');const message=error instanceof ZodError?error.issues.map(i=>i.message).join('\n'):sqlState==='23505'?'This office code already exists.':sqlState?'Unable to save records. Please try again.':error instanceof Error?error.message:'Unable to save. Please try again.';return Response.json({error:message},{status:message.includes('Sign in')?401:400});}
export async function checkOffice(db:Database,owner:string,id:string|null){if(id&&!await db.prepare('SELECT id FROM offices WHERE id=? AND owner=?').bind(id,owner).first())throw new Error('Office not found.');}
