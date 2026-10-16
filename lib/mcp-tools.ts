import {z} from 'zod';
import type {Database} from '@/db';
import {can,type Access} from './access';
import {cashMetrics,paymentTotal,today,type Office,type Payment} from './records';
import {DENIED} from './server-records';
// Read-only tools for Claude (MCP, app/api/mcp). Each runs as the key's owner and applies the same rules
// as /api/state: offices only in the person's branches, payments only with Cash flow, Accounts or Lease
// contracts access, enquiries only with the Enquiries page.
export type ToolContext={db:Database;owner:string;user:Access};
type Row={id:string;data:string};
const parse=<T,>(r:Row)=>({...JSON.parse(r.data),id:r.id}) as T;
const need=(ok:boolean)=>{if(!ok)throw new Error(DENIED)};
const money=(u:Access)=>can(u,'cash')||can(u,'workbook')||can(u,'contracts');
const addDays=(d:string,n:number)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const yearly=(o:Office)=>o.period==='Monthly'?o.rent*12:o.rent;
const total=(list:Payment[])=>Math.round(list.reduce((a,p)=>a+paymentTotal(p),0)*100)/100;
const statusOf=(p:Payment,asof:string)=>['Pending','Unpaid'].includes(p.status)&&p.due<asof?'Overdue':p.status;
const expiring=(o:Office,until:string)=>o.status==='Active'&&(!!(o.end&&o.end<=until)||!!(o.licenseExpiry&&o.licenseExpiry<=until));
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use a date like 2026-10-16');
const branch=z.enum(['BHB','111','all']).optional();
function branchesFor(user:Access,b?:string){if(!b||b==='all')return user.branches;need(user.branches.includes(b));return [b];}
async function offices(c:ToolContext,branches:string[]){const r=await c.db.prepare('SELECT id,data FROM offices WHERE owner=? ORDER BY code').bind(c.owner).all<Row>();return r.results.map(x=>parse<Office>(x)).filter(o=>branches.includes(o.branch||'BHB'));}
async function payments(c:ToolContext,branches:string[],officeIds:Set<string>){const r=await c.db.prepare('SELECT id,data FROM payments WHERE owner=?').bind(c.owner).all<Row>();return r.results.map(x=>parse<Payment>(x)).filter(p=>p.officeId?officeIds.has(p.officeId):branches.includes(p.branch||'BHB'));}
const officeOut=(o:Office)=>({id:o.id,code:o.code,branch:o.branch||'BHB',type:o.kind,status:o.status,tenant:o.company||null,contact:o.contact||null,email:o.email||null,phone:o.phone||null,location:o.location||null,desks:o.desks??null,lease_start:o.start||null,lease_end:o.end||null,licence_number:o.licenseNumber||null,licence_expiry:o.licenseExpiry||null,rent:o.rent,rent_period:o.period,rent_per_year:yearly(o),deposit:o.deposit,vat_percent:o.vat,services:o.services||null,notes:o.notes||null});
const paymentOut=(p:Payment,code:string|null,asof:string)=>({id:p.id,reference:p.reference,direction:p.direction,type:p.direction==='Income'?(p.incomeType||'Rent'):p.category,party:p.party,office:code,method:p.method,bank:p.bankName||null,due:p.due,cash_date:p.actual||null,amount:p.amount,vat:p.vatAmount||0,deposit:p.securityDeposit||0,total:paymentTotal(p),status:statusOf(p,asof),notes:p.notes||null});

const inputs={
 dashboard_summary:z.object({month:z.string().regex(/^\d{4}-\d{2}$/,'Use a month like 2026-10').optional(),as_of:date.optional(),branch}),
 list_offices:z.object({status:z.enum(['Available','Active','Reserved','Inactive']).optional(),type:z.enum(['Physical','Virtual']).optional(),branch,expiring_within_days:z.number().int().min(0).max(366).optional(),search:z.string().max(100).optional(),limit:z.number().int().min(1).max(200).default(50)}),
 get_office:z.object({code:z.string().max(80).optional(),id:z.string().max(80).optional()}).refine(a=>a.code||a.id,'Give the office code (for example A-101) or its id.'),
 list_payments:z.object({direction:z.enum(['Income','Expense']).optional(),status:z.enum(['Pending','Cleared','Bounced','Cancelled','Unpaid','Paid','Overdue']).optional(),office:z.string().max(80).optional(),due_from:date.optional(),due_to:date.optional(),search:z.string().max(100).optional(),branch,limit:z.number().int().min(1).max(500).default(100)}),
 list_enquiries:z.object({status:z.enum(['New','Contacted','Closed']).optional(),search:z.string().max(100).optional(),limit:z.number().int().min(1).max(200).default(50)}),
};
export type ToolName=keyof typeof inputs;
const readOnly={readOnlyHint:true,openWorldHint:false};
const branchProp={type:'string',enum:['BHB','111','all'],description:'Branch to include; default all branches you can see.'};
// Descriptions are what Claude reads to choose a tool; amounts are AED.
export const tools=[
 {name:'dashboard_summary',title:'Dashboard summary',description:'Cash and office figures for a month, as on the Cash flow and Office portfolio pages: cash in and out, net, rent/PRO/other income, VAT collected, deposits, pending and overdue checks, bounced checks, unpaid expenses, money due in the next 30 days, and office counts with leases or licences expiring within 30 days. Amounts in AED.',inputSchema:{type:'object',properties:{month:{type:'string',description:'Month as YYYY-MM; default the current month in Dubai.'},as_of:{type:'string',description:'Date as YYYY-MM-DD for overdue and due-soon figures; default today in Dubai.'},branch:branchProp},additionalProperties:false},annotations:readOnly},
 {name:'list_offices',title:'List offices',description:'Offices with tenant, contact, lease dates, licence, rent (and rent per year), deposit and status. Filter by status, type, branch, leases or licences expiring within N days, or a search on code, tenant, contact, licence or location.',inputSchema:{type:'object',properties:{status:{type:'string',enum:['Available','Active','Reserved','Inactive']},type:{type:'string',enum:['Physical','Virtual']},branch:branchProp,expiring_within_days:{type:'integer',minimum:0,maximum:366,description:'Only active offices whose lease or licence ends within this many days.'},search:{type:'string'},limit:{type:'integer',minimum:1,maximum:200,default:50}},additionalProperties:false},annotations:readOnly},
 {name:'get_office',title:'Get one office',description:'One office by its code (for example A-101) or id: tenant, lease, licence, rent, its payments (if your role can see payments) and its document names.',inputSchema:{type:'object',properties:{code:{type:'string'},id:{type:'string'}},additionalProperties:false},annotations:readOnly},
 {name:'list_payments',title:'List payments',description:'Checks, transfers and cash: income (rent, PRO service, other) and expenses (payroll, rent, utilities, supplies). Filter by direction, status (Overdue = pending income or unpaid expense past its due date), office code, due date range, branch or a search on payer, reference, bank or notes. Returns totals too. Amounts in AED.',inputSchema:{type:'object',properties:{direction:{type:'string',enum:['Income','Expense']},status:{type:'string',enum:['Pending','Cleared','Bounced','Cancelled','Unpaid','Paid','Overdue']},office:{type:'string',description:'Office code, for example A-101.'},due_from:{type:'string',description:'YYYY-MM-DD'},due_to:{type:'string',description:'YYYY-MM-DD'},search:{type:'string'},branch:branchProp,limit:{type:'integer',minimum:1,maximum:500,default:100}},additionalProperties:false},annotations:readOnly},
 {name:'list_enquiries',title:'List website enquiries',description:'Enquiries sent from the BHB website, newest first: name, email, phone, service, message, status (New, Contacted, Closed) and date.',inputSchema:{type:'object',properties:{status:{type:'string',enum:['New','Contacted','Closed']},search:{type:'string'},limit:{type:'integer',minimum:1,maximum:200,default:50}},additionalProperties:false},annotations:readOnly},
] as const;

export function isTool(name:unknown):name is ToolName{return typeof name==='string'&&Object.hasOwn(inputs,name);}
export async function callTool(c:ToolContext,name:ToolName,args:unknown):Promise<object>{
 const {user}=c,asofToday=today();
 if(name==='dashboard_summary'){const a=inputs.dashboard_summary.parse(args),asof=a.as_of||asofToday,month=a.month||asof.slice(0,7),br=branchesFor(user,a.branch);need(can(user,'offices')||money(user));
  const os=await offices(c,br),out:Record<string,unknown>={month,as_of:asof,branches:br,currency:'AED'};
  if(can(user,'offices')){const soon=addDays(asof,30),count=(s:string)=>os.filter(o=>o.status===s).length;out.offices={total:os.length,active:count('Active'),available:count('Available'),reserved:count('Reserved'),inactive:count('Inactive'),physical:os.filter(o=>o.kind==='Physical').length,virtual:os.filter(o=>o.kind==='Virtual').length,rent_per_year_active:os.filter(o=>o.status==='Active').reduce((a,o)=>a+yearly(o),0),expiring_within_30_days:os.filter(o=>expiring(o,soon)).map(o=>({code:o.code,tenant:o.company||null,lease_end:o.end||null,licence_expiry:o.licenseExpiry||null}))};}
  if(money(user)){const ps=await payments(c,br,new Set(os.map(o=>o.id))),m=cashMetrics(ps,month,asof),bounced=ps.filter(p=>p.direction==='Income'&&p.status==='Bounced');out.cash={cash_in:m.cashIn,cash_out:m.cashOut,net:m.net,rent_income:m.rentIncome,pro_income:m.proIncome,other_income:m.otherIncome,vat_collected:m.vatCollected,deposits_received:m.depositsReceived,pending_income:m.pending,pending_checks:m.checks,overdue_checks:m.overdue,bounced_checks:bounced.length,bounced_amount:total(bounced),unpaid_expenses:m.unpaid,overdue_expenses:m.expensesOverdue,income_due_next_30_days:m.nextIn,expenses_due_next_30_days:m.nextOut,planned_net_this_month:m.planned};}
  return out;}
 if(name==='list_offices'){const a=inputs.list_offices.parse(args);need(can(user,'offices'));const q=a.search?.toLowerCase(),until=a.expiring_within_days===undefined?null:addDays(asofToday,a.expiring_within_days);
  const list=(await offices(c,branchesFor(user,a.branch))).filter(o=>(!a.status||o.status===a.status)&&(!a.type||o.kind===a.type)&&(!until||expiring(o,until))&&(!q||[o.code,o.company,o.contact,o.licenseNumber,o.location].join(' ').toLowerCase().includes(q)));
  return {count:list.length,shown:Math.min(list.length,a.limit),offices:list.slice(0,a.limit).map(officeOut)};}
 if(name==='get_office'){const a=inputs.get_office.parse(args);need(can(user,'offices'));const os=await offices(c,user.branches),o=os.find(x=>a.id?x.id===a.id:x.code.toLowerCase()===a.code!.trim().toLowerCase());if(!o)throw new Error('No office with that '+(a.id?'id':'code')+' in your branches.');
  const out:Record<string,unknown>={office:officeOut(o)};
  if(money(user)){const ps=(await payments(c,user.branches,new Set([o.id]))).filter(p=>p.officeId===o.id).sort((x,y)=>x.due.localeCompare(y.due));out.payments=ps.map(p=>paymentOut(p,o.code,asofToday));out.payment_totals={scheduled_income:total(ps.filter(p=>p.direction==='Income'&&p.status!=='Cancelled')),cleared_income:total(ps.filter(p=>p.direction==='Income'&&p.status==='Cleared')),pending_income:total(ps.filter(p=>p.direction==='Income'&&p.status==='Pending')),bounced:total(ps.filter(p=>p.status==='Bounced'))};}
  const docs=await c.db.prepare('SELECT name,category,created FROM documents WHERE owner=? AND office_id=? ORDER BY created DESC').bind(c.owner,o.id).all<{name:string;category:string;created:string}>();out.documents=docs.results;
  return out;}
 if(name==='list_payments'){const a=inputs.list_payments.parse(args);need(money(user));const br=branchesFor(user,a.branch),os=await offices(c,br),codes=new Map(os.map(o=>[o.id,o.code])),q=a.search?.toLowerCase(),office=a.office?.trim().toLowerCase();
  const list=(await payments(c,br,new Set(codes.keys()))).filter(p=>(!a.direction||p.direction===a.direction)&&(!a.status||(a.status==='Overdue'?statusOf(p,asofToday)==='Overdue':p.status===a.status))&&(!office||(p.officeId?codes.get(p.officeId)?.toLowerCase()===office:false))&&(!a.due_from||p.due>=a.due_from)&&(!a.due_to||p.due<=a.due_to)&&(!q||[p.party,p.reference,p.bankName,p.description,p.notes].join(' ').toLowerCase().includes(q))).sort((x,y)=>x.due.localeCompare(y.due));
  const income=list.filter(p=>p.direction==='Income'),expense=list.filter(p=>p.direction==='Expense');
  return {count:list.length,shown:Math.min(list.length,a.limit),totals:{income:total(income),expenses:total(expense),net:Math.round((total(income)-total(expense))*100)/100},payments:list.slice(0,a.limit).map(p=>paymentOut(p,p.officeId?codes.get(p.officeId)??null:null,asofToday))};}
 if(name!=='list_enquiries')throw new Error('Unknown tool.');
 const a=inputs.list_enquiries.parse(args);need(can(user,'enquiries'));const q=a.search?.toLowerCase();
 const rows=await c.db.prepare('SELECT id,created,status,data FROM enquiries ORDER BY created DESC LIMIT 1000').all<{id:string;created:string;status:string;data:string}>();
 const list=rows.results.map(r=>({...JSON.parse(r.data),id:r.id,created:r.created,status:r.status})).filter(e=>(!a.status||e.status===a.status)&&(!q||[e.name,e.email,e.phone,e.service,e.message].join(' ').toLowerCase().includes(q)));
 return {count:list.length,shown:Math.min(list.length,a.limit),enquiries:list.slice(0,a.limit).map(e=>({id:e.id,created:e.created,status:e.status,name:e.name,email:e.email,phone:e.phone||null,service:e.service,message:e.message,page:e.page||null}))};
}
