import {openDb} from '@/lib/server-records';
import {getClient,exchangeCode,refresh,GrantError} from '@/lib/oauth';
// Token endpoint (form-encoded, RFC 6749): swaps a sign-in code for tokens, or a refresh token for new ones.
// An unknown client gets 401 invalid_client, which makes Claude register again.
const noStore={'Cache-Control':'no-store',Pragma:'no-cache'};
const fail=(error:string,error_description:string,status=400)=>Response.json({error,error_description},{status,headers:noStore});
export async function POST(req:Request){
 let form:FormData;try{form=await req.formData()}catch{return fail('invalid_request','Send the request as application/x-www-form-urlencoded.')}
 // A public client sends client_id in the body; some clients send it in a Basic header instead (the secret is ignored).
 const basic=/^Basic\s+(\S+)$/i.exec(req.headers.get('authorization')||''),fromHeader=basic?(()=>{try{return decodeURIComponent(atob(basic[1]).split(':')[0])}catch{return ''}})():'';
 const get=(k:string)=>String(form.get(k)??''),grant=get('grant_type'),clientId=get('client_id')||fromHeader;
 try{const db=await openDb();
  if(!clientId||!(await getClient(db,clientId)))return fail('invalid_client','Unknown client. Register again.',401);
  if(grant==='authorization_code'){const code=get('code'),redirectUri=get('redirect_uri'),verifier=get('code_verifier');if(!code||!redirectUri||!verifier)return fail('invalid_request','code, redirect_uri and code_verifier are required.');
   return Response.json(await exchangeCode(db,new URL(req.url).origin,{code,clientId,redirectUri,verifier,resource:get('resource')||undefined}),{headers:noStore});}
  if(grant==='refresh_token'){const token=get('refresh_token');if(!token)return fail('invalid_request','refresh_token is required.');return Response.json(await refresh(db,token,clientId),{headers:noStore});}
  return fail('unsupported_grant_type','Use authorization_code or refresh_token.');
 }catch(e){if(e instanceof GrantError)return fail('invalid_grant',e.message);console.error('Token request failed',e instanceof Error?e.message:e);return fail('server_error','Please try again.',500);}
}
