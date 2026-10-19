import {context,failure} from '@/lib/server-records';
import {can,has,DEFAULT_RATES} from '@/lib/access';
import {loadRoles} from '@/lib/auth';
import {readNumbering} from '@/lib/records';
type Row={id:string;data:string;officeId?:string;seq?:number;email?:string};
// Each person only receives their branches and the sections their role can open.
export async function GET(req:Request){try{const{db,owner,user}=await context(req);const [offices,payments,docs,leases,requests,employees,invoices,issuers,users,tasks,customers,creditNotes,settings]=await db.batch([db.prepare('SELECT id,data FROM offices WHERE owner=? ORDER BY code').bind(owner),db.prepare('SELECT id,data FROM payments WHERE owner=?').bind(owner),db.prepare('SELECT id,office_id AS "officeId",payment_id AS "paymentId",name,category,mime,size,created FROM documents WHERE owner=? ORDER BY created DESC').bind(owner),db.prepare('SELECT id,office_id AS "officeId",data FROM leases WHERE owner=?').bind(owner),db.prepare('SELECT id,data FROM employee_requests WHERE owner=?').bind(owner),db.prepare('SELECT id,data FROM employees WHERE owner=?').bind(owner),db.prepare('SELECT id,seq,office_id AS "officeId",data FROM invoices WHERE owner=? ORDER BY seq DESC').bind(owner),db.prepare('SELECT data FROM invoice_issuers WHERE owner=?').bind(owner),db.prepare('SELECT id,email,data FROM users ORDER BY created'),db.prepare('SELECT id,assignee,data FROM tasks WHERE owner=?').bind(owner),db.prepare('SELECT id,data FROM customers WHERE owner=?').bind(owner),db.prepare('SELECT id,invoice_id AS "invoiceId",data FROM credit_notes WHERE owner=?').bind(owner),db.prepare("SELECT data FROM app_settings WHERE id=? AND owner=?").bind(owner+':officeNumbering',owner)]);
const rows=(r:{results:unknown[]})=>r.results as Row[],inBranch=(b?:string)=>user.branches.includes(b||'BHB'),parse=(r:Row)=>({...JSON.parse(r.data),id:r.id});
const officeList=rows(offices).map(parse).filter(o=>inBranch(o.branch)),ids=new Set(officeList.map(o=>o.id));
// Each invoice carries its tax credit notes and what they took off in total (net, VAT, total).
type Note={id:string;number:number;branch:string;issueDate:string;reason:string;credit:{net:number;vat:number;total:number};full:boolean};
const notesByInvoice=new Map<string,Note[]>();for(const r of rows(creditNotes) as {id:string;invoiceId:string;data:string}[]){const c=JSON.parse(r.data);notesByInvoice.set(r.invoiceId,[...(notesByInvoice.get(r.invoiceId)||[]),{id:r.id,number:c.number,branch:c.branch,issueDate:c.issueDate,reason:c.reason,credit:c.credit,full:c.full}])}
const withCredits=<T extends {id:string}>(i:T)=>{const notes=notesByInvoice.get(i.id);if(!notes)return i;const add=(k:'net'|'vat'|'total')=>Math.round(notes.reduce((a,n)=>a+(n.credit?.[k]||0),0)*100)/100;return {...i,creditNotes:notes.sort((a,b)=>a.issueDate.localeCompare(b.issueDate)),credited:{net:add('net'),vat:add('vat'),total:add('total')}}};
const money=can(user,'cash')||can(user,'workbook')||can(user,'contracts'),
 // Lease contracts alone (e.g. Sales) shows the leases' own income payments and invoices, not expenses, the rest of the
 // cash book or invoices to customers without an office (PRO services and the like).
 cashBook=can(user,'cash')||can(user,'workbook'),people=rows(users).map(r=>({...JSON.parse(r.data),id:r.id,email:r.email}));
// Sales employees: names for the Sold by field and the commission page (inactive kept for past deals);
// rates only for those allowed to see every commission, or for the salesperson's own record.
// Every salesperson's rates and cash only for people who can open the Sales page and may see every commission.
const seeAll=can(user,'sales')&&(has(user,'allCommissions')||can(user,'users'));
const staff=rows(employees).map(parse),salesStaff=staff.filter(e=>e.job==='Sales').map(e=>({id:e.id,name:e.name,branch:e.branch,active:e.status!=='Inactive',...(seeAll||(can(user,'sales')&&user.employeeId&&e.id===user.employeeId)?{commissionNew:e.commissionNew??DEFAULT_RATES.commissionNew,commissionRenewal:e.commissionRenewal??DEFAULT_RATES.commissionRenewal}:{})}));
// Cash-basis commission: cleared rent received against the leases this person may see commission for
// (every seller with "see every commission", otherwise only their own), with just the fields the maths needs.
const leaseList=rows(leases).filter(r=>ids.has(r.officeId!)).map(parse),archived=new Set(leaseList.flatMap(l=>l.paymentIds||[])),allPayments=rows(payments).map(parse),counts=(seller?:string)=>!!seller&&(seeAll||seller===user.employeeId);
const cashIds=new Set([...officeList.filter(o=>counts(o.salesEmployeeId)).flatMap(o=>allPayments.filter(p=>p.officeId===o.id&&!archived.has(p.id)).map(p=>p.id)),...leaseList.filter(l=>counts(l.office?.salesEmployeeId)).flatMap(l=>l.paymentIds||[])]);
const salesCash=can(user,'sales')?allPayments.filter(p=>cashIds.has(p.id)&&p.direction==='Income'&&p.status==='Cleared'&&p.actual&&(p.incomeType||'Rent')==='Rent').map(({id,officeId,amount,actual})=>({id,officeId,amount,actual})):[];
// My dashboard: to-dos for this person (every to-do for those who manage Users & roles) and their own requests.
const manager=can(user,'users','edit'),taskList=(tasks.results as {id:string;assignee:string;data:string}[]).filter(t=>manager||t.assignee===user.userId).map(t=>({...JSON.parse(t.data),id:t.id,assignee:t.assignee}));
const myRequests=user.employeeId?rows(requests).map(parse).filter(r=>r.employeeId===user.employeeId):[];
const officeNumbering=readNumbering((settings.results as {data:string}[])[0]?.data);
return Response.json({me:user,salesStaff,salesCash,tasks:taskList,myRequests,officeNumbering,
offices:officeList,
payments:money?rows(payments).map(parse).filter(p=>p.officeId?ids.has(p.officeId):inBranch(p.branch)).filter(p=>cashBook||(!!p.officeId&&p.direction==='Income')):[],
documents:can(user,'documents')||can(user,'offices')?(docs.results as {officeId:string}[]).filter(d=>ids.has(d.officeId)):[],
leases:can(user,'offices')||can(user,'sales')?rows(leases).filter(r=>ids.has(r.officeId!)).map(parse):[],
// Invoices for an office in this person's branches, or for a customer without an office in those branches.
invoices:money?rows(invoices).filter(r=>r.officeId?ids.has(r.officeId):inBranch(JSON.parse(r.data).branch)).filter(r=>cashBook||!!r.officeId).map(r=>withCredits({...JSON.parse(r.data),id:r.id,seq:r.seq})):[],
customers:can(user,'customers')?rows(customers).map(parse).filter(c=>inBranch(c.branch)):[],
issuers:money?rows(issuers).map(r=>JSON.parse(r.data)).filter(i=>inBranch(i.branch)):[],
employees:can(user,'employees')?staff.filter(e=>inBranch(e.branch)):[],
requests:can(user,'employees')?rows(requests).map(parse).filter(r=>inBranch(r.branch)):[],
...(can(user,'users')?{people:people.map(({id,name,email,roleId,branches,active,employeeId})=>({id,name,email,roleId,branches:branches||[],active,employeeId:employeeId||''})),staffList:staff.map(({id,name,job,branch})=>({id,name,job:job||'Other',branch})),roles:await loadRoles(db)}:{})});}catch(e){return failure(e);}}
