import {getUser,signIn,accessFor} from '@/lib/auth';
import {openDb} from '@/lib/server-records';
import {getClient,redirectMatches,createCode,resourceFor,isOurResource,destination,appName,type Client} from '@/lib/oauth';
import type {Access} from '@/lib/access';
import {blocked,recordFailure,clearFailures,clientAddress,TOO_MANY} from '@/lib/attempts';
// The page Claude opens so a person can sign in and allow it to read the dashboard as them. Requests with an
// unknown client or an unregistered redirect address get an error page here and are never redirected.
type Params={client_id:string;redirect_uri:string;response_type:string;code_challenge:string;code_challenge_method:string;state:string;scope:string;resource:string};
const keys:(keyof Params)[]=['client_id','redirect_uri','response_type','code_challenge','code_challenge_method','state','scope','resource'];
const read=(get:(k:string)=>unknown)=>Object.fromEntries(keys.map(k=>[k,String(get(k)??'')])) as Params;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'",'Referrer-Policy':'same-origin'};
function page(title:string,body:string,status=200){return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f7f3;font:16px/1.55 Arial,Helvetica,sans-serif;color:#202020}main{width:min(440px,100% - 32px);background:#fff;border:1px solid #e6dcc5;border-radius:14px;padding:28px 26px;box-shadow:0 10px 30px #2020200d}img{width:150px;display:block;margin:0 auto 14px}h1{font-size:21px;margin:0 0 12px}p{margin:0 0 14px;color:#3a372f}.who{background:#faf3e3;border-left:3px solid #c79636;padding:10px 12px;border-radius:6px}.warn{background:#fff2d5;color:#6b4a0b;padding:10px 12px;border-radius:6px;font-size:14px}.error{background:#fdecec;color:#a23030;padding:10px 12px;border-radius:6px;font-size:14px}label{display:block;font-size:14px;color:#5f5a4d;margin:0 0 12px}input{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:11px 12px;border:1px solid #d9d2c1;border-radius:7px;font:inherit}.actions{display:flex;gap:10px;margin-top:18px}button{font:inherit;font-weight:700;border-radius:8px;padding:11px 18px;cursor:pointer;border:1px solid #d9d2c1;background:#fff;color:#202020}button[value=allow]{background:#202020;border-color:#202020;color:#f8dfa4;flex:1}small{display:block;color:#6f6a5c;font-size:13px;margin-top:14px}</style></head><body><main><img src="/bhb-logo.png" alt="BHB Business Centre">${body}</main></body></html>`,{status,headers});}
const problem=(text:string)=>page('Cannot connect',`<h1>Cannot connect to the BHB dashboard</h1><p class="error">${esc(text)}</p><p>Go back to the app and try connecting again.</p>`,400);
async function check(p:Params,origin:string):Promise<{client:Client}|{error:Response}>{
 const client=p.client_id?await getClient(await openDb(),p.client_id):null;
 if(!client)return {error:problem('This connection request is not from a registered app.')};
 if(!p.redirect_uri||!redirectMatches(client,p.redirect_uri))return {error:problem('The return address of this request is not registered.')};
 const back=(error:string)=>({error:redirect(p,origin,{error,state:p.state})});
 if(p.response_type!=='code')return back('unsupported_response_type');
 if(!p.code_challenge||p.code_challenge_method!=='S256')return back('invalid_request');
 if(p.resource&&!isOurResource(p.resource,origin))return back('invalid_target');
 return {client};
}
// Every authorization response, errors included, carries iss (RFC 9207); ChatGPT relies on it.
function redirect(p:Params,origin:string,query:Record<string,string>){const u=new URL(p.redirect_uri);for(const[k,v]of Object.entries({...query,iss:origin}))if(v)u.searchParams.set(k,v);return new Response(null,{status:302,headers:{Location:u.href,'Cache-Control':'no-store'}});}
function consent(p:Params,user:Access|null,error=''){
 const hidden=keys.map(k=>`<input type="hidden" name="${k}" value="${esc(p[k])}">`).join('');
 const local=destination(p.redirect_uri).startsWith('Claude Code'),warn=local?'Allow this only if you just started connecting the BHB dashboard in Claude Code on this computer.':'Allow this only if you just started connecting the BHB dashboard in '+appName(p.redirect_uri)+' yourself.';
 return page('Connect '+appName(p.redirect_uri),`<h1>Connect ${esc(appName(p.redirect_uri))} to the BHB dashboard</h1><p><strong>${esc(destination(p.redirect_uri))}</strong> asks to read your dashboard: offices, payments and website enquiries, limited to what your role and branches allow. It cannot change anything.</p><p class="warn">${esc(warn)}</p>${error?`<p class="error" role="alert">${esc(error)}</p>`:''}<form method="post">${hidden}${user?`<p class="who">Signed in as <strong>${esc(user.name)}</strong> · ${esc(user.roleName)}</p>`:'<label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label>'}<div class="actions"><button type="submit" name="action" value="allow">${user?'Allow':'Sign in and allow'}</button><button type="submit" name="action" value="cancel" formnovalidate>Cancel</button></div></form><small>You can disconnect it at any time under Connect Claude in the dashboard.</small>`);
}
const signedIn=async()=>{const u=await getUser();return u&&!u.bootstrap?u:null};
export async function GET(req:Request){const url=new URL(req.url),p=read(k=>url.searchParams.get(k)),c=await check(p,url.origin);if('error' in c)return c.error;return consent(p,await signedIn());}
export async function POST(req:Request){
 const origin=new URL(req.url).origin,sent=req.headers.get('origin');if(sent&&sent!==origin)return problem('This form was sent from another site.');
 const form=await req.formData(),p=read(k=>form.get(k)),c=await check(p,origin);if('error' in c)return c.error;
 if(form.get('action')!=='allow')return redirect(p,origin,{error:'access_denied',state:p.state});
 const email=String(form.get('email')??'').trim();let user:Access|null=null;
 if(email){const db=await openDb(),ip=clientAddress(req);if(await blocked(db,email,ip))return consent(p,null,TOO_MANY);
  const id=await signIn(email,String(form.get('password')??''));user=id?await accessFor(id):null;
  if(!user||user.bootstrap){await recordFailure(db,email,ip);await new Promise(r=>setTimeout(r,1000));return consent(p,null,'The email or password is not correct.');}
  await clearFailures(db,email);}
 else{user=await signedIn();if(!user)return consent(p,null,'Sign in to allow Claude.');}
 const code=await createCode(await openDb(),{clientId:c.client.id,redirectUri:p.redirect_uri,challenge:p.code_challenge,userId:user.userId,resource:resourceFor(origin)});
 return redirect(p,origin,{code,state:p.state});
}
