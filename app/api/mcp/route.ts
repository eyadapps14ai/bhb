import {ZodError} from 'zod';
import {openDb,SHARED_OWNER} from '@/lib/server-records';
import {accessForKey} from '@/lib/claude-keys';
import {accessForToken,SCOPE} from '@/lib/oauth';
import {tools,isTool,callTool} from '@/lib/mcp-tools';
import type {Access} from '@/lib/access';
// MCP endpoint (Streamable HTTP, stateless JSON replies). Claude calls it with an OAuth access token from
// /api/oauth, or a personal key (bhb_...) for Claude Code, and every call runs as that person.
const PROTOCOLS=['2025-06-18','2025-03-26','2024-11-05'];
const json=(body:unknown,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...extra}});
const rpc=(id:unknown,result:unknown)=>json({jsonrpc:'2.0',id,result});
const rpcError=(id:unknown,code:number,message:string,status=200)=>json({jsonrpc:'2.0',id:id??null,error:{code,message}},status);
// A 401 with resource_metadata is what starts Claude's sign-in.
const unauthorized=(origin:string,invalid:boolean)=>json({jsonrpc:'2.0',id:null,error:{code:-32001,message:'Sign in to the BHB dashboard to use this connector.'}},401,{'WWW-Authenticate':`Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="${SCOPE}"${invalid?', error="invalid_token"':''}`});
const calls=new Map<string,{start:number;count:number}>();
const limited=(id:string)=>{const now=Date.now(),c=calls.get(id);if(!c||now-c.start>60000){calls.set(id,{start:now,count:1});return false}return ++c.count>120};
async function who(req:Request):Promise<Access|null|undefined>{const m=/^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization')||'');if(!m)return undefined;const db=await openDb();return m[1].startsWith('bhb_')?accessForKey(db,m[1]):accessForToken(db,m[1]);}
const instructions='BHB Business Centre dashboard (Dubai): offices, tenants, leases, checks and payments, expenses and website enquiries for the BHB and 111 branches. Amounts are in AED and dates in Dubai time. Answers are limited to the signed-in person\'s role and branches; the tools only read.';
export async function GET(req:Request){const origin=new URL(req.url).origin;let user;try{user=await who(req)}catch{return rpcError(null,-32603,'Record storage is unavailable. Please try again.',503)}if(!user)return unauthorized(origin,user===null);return new Response(null,{status:405,headers:{Allow:'POST'}});}
export async function DELETE(){return new Response(null,{status:405,headers:{Allow:'POST'}});}
export async function POST(req:Request){
 const origin=new URL(req.url).origin,sent=req.headers.get('origin');
 if(sent&&sent!==origin)return rpcError(null,-32600,'Requests from other websites are not accepted.',403);
 let user:Access|null|undefined;try{user=await who(req)}catch{return rpcError(null,-32603,'Record storage is unavailable. Please try again.',503)}
 if(!user||user.bootstrap)return unauthorized(origin,user===null);
 if(limited(user.userId))return rpcError(null,-32000,'Too many requests. Try again in a minute.',429);
 let msg:{jsonrpc?:string;id?:unknown;method?:unknown;params?:Record<string,unknown>};try{msg=await req.json()}catch{return rpcError(null,-32700,'Parse error',400)}
 if(!msg||typeof msg!=='object'||Array.isArray(msg)||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')return rpcError(null,-32600,'Invalid request',400);
 if(msg.id===undefined)return new Response(null,{status:202});
 const params=msg.params||{};
 if(msg.method==='initialize'){const asked=String(params.protocolVersion||'');return rpc(msg.id,{protocolVersion:PROTOCOLS.includes(asked)?asked:PROTOCOLS[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'bhb-dashboard',title:'BHB Business Centre dashboard',version:'1.0.0'},instructions});}
 if(msg.method==='ping')return rpc(msg.id,{});
 if(msg.method==='tools/list')return rpc(msg.id,{tools});
 if(msg.method==='tools/call'){const name=params.name;if(!isTool(name))return rpcError(msg.id,-32602,'Unknown tool: '+String(name));
  try{const out=await callTool({db:await openDb(),owner:SHARED_OWNER,user},name,params.arguments??{});return rpc(msg.id,{content:[{type:'text',text:JSON.stringify(out)}],structuredContent:out});}
  catch(e){const text=e instanceof ZodError?e.issues.map(i=>(i.path.length?i.path.join('.')+': ':'')+i.message).join('\n'):e&&typeof e==='object'&&'severity' in e?'Unable to read records. Please try again.':e instanceof Error?e.message:'Unable to read records.';if(!(e instanceof ZodError))console.error('MCP tool failed',name,e instanceof Error?e.message:e);return rpc(msg.id,{content:[{type:'text',text}],isError:true});}}
 return rpcError(msg.id,-32601,'Method not found: '+msg.method);
}
