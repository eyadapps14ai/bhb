import {openDb} from '@/lib/server-records';
import {allowedRedirect,registerClient,pruneOAuth} from '@/lib/oauth';
import {clientAddress} from '@/lib/attempts';
// Dynamic client registration (RFC 7591) for Claude. Only Claude's callback addresses are accepted.
// Registrations are limited per address and per instance, and stale ones are pruned as new ones arrive.
const window={start:0,count:0},perAddress=new Map<string,{start:number;count:number}>();
const over=(ip:string,now:number)=>{const c=perAddress.get(ip);if(!c||now-c.start>60000){if(perAddress.size>5000)perAddress.clear();perAddress.set(ip,{start:now,count:1});return false}return ++c.count>10};
const fail=(error:string,error_description:string)=>Response.json({error,error_description},{status:400,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 const now=Date.now();if(now-window.start>60000){window.start=now;window.count=0}if(++window.count>60||over(clientAddress(req),now))return Response.json({error:'temporarily_unavailable',error_description:'Too many registrations. Try again in a minute.'},{status:429});
 let body:{redirect_uris?:unknown;client_name?:unknown;token_endpoint_auth_method?:unknown};try{body=await req.json()}catch{return fail('invalid_client_metadata','Send the client metadata as JSON.')}
 const uris=Array.isArray(body.redirect_uris)?body.redirect_uris.filter((u):u is string=>typeof u==='string'):[];
 if(!uris.length||uris.length>5||uris.some(u=>!allowedRedirect(u)))return fail('invalid_redirect_uri','Only Claude can connect to the BHB dashboard.');
 if(body.token_endpoint_auth_method&&body.token_endpoint_auth_method!=='none')return fail('invalid_client_metadata','Only public clients (token_endpoint_auth_method "none") are supported.');
 try{const db=await openDb();await pruneOAuth(db);const client=await registerClient(db,typeof body.client_name==='string'?body.client_name:'Claude',uris);
  return Response.json({client_id:client.id,client_id_issued_at:Math.floor(now/1000),client_name:client.name,redirect_uris:client.redirectUris,grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Client registration failed',e instanceof Error?e.message:e);return Response.json({error:'server_error'},{status:500});}
}
