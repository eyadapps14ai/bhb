import {openDb} from '@/lib/server-records';
import {allowedRedirect,registerClient} from '@/lib/oauth';
// Dynamic client registration (RFC 7591) for Claude. Only Claude's callback addresses are accepted, and
// registrations are capped per instance so the table cannot be flooded.
const window={start:0,count:0};
const fail=(error:string,error_description:string)=>Response.json({error,error_description},{status:400,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 const now=Date.now();if(now-window.start>60000){window.start=now;window.count=0}if(++window.count>30)return Response.json({error:'temporarily_unavailable',error_description:'Too many registrations. Try again in a minute.'},{status:429});
 let body:{redirect_uris?:unknown;client_name?:unknown;token_endpoint_auth_method?:unknown};try{body=await req.json()}catch{return fail('invalid_client_metadata','Send the client metadata as JSON.')}
 const uris=Array.isArray(body.redirect_uris)?body.redirect_uris.filter((u):u is string=>typeof u==='string'):[];
 if(!uris.length||uris.length>5||uris.some(u=>!allowedRedirect(u)))return fail('invalid_redirect_uri','Only Claude can connect to the BHB dashboard.');
 if(body.token_endpoint_auth_method&&body.token_endpoint_auth_method!=='none')return fail('invalid_client_metadata','Only public clients (token_endpoint_auth_method "none") are supported.');
 try{const client=await registerClient(await openDb(),typeof body.client_name==='string'?body.client_name:'Claude',uris);
  return Response.json({client_id:client.id,client_id_issued_at:Math.floor(now/1000),client_name:client.name,redirect_uris:client.redirectUris,grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Client registration failed',e instanceof Error?e.message:e);return Response.json({error:'server_error'},{status:500});}
}
