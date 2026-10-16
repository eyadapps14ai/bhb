import {context,failure} from '@/lib/server-records';
import {can,has,DEFAULT_RATES} from '@/lib/access';
import {loadRoles} from '@/lib/auth';
type Row={id:string;data:string;officeId?:string;seq?:number;email?:string};
// Each person only receives their branches and the sections their role can open.
export async function GET(req:Request){try{const{db,owner,user}=await context(req);const [offices,payments,docs,leases,requests,employees,invoices,issuers,users,tasks,customers]=await db.batch([db.prepare('SELECT id,data FROM offices WHERE owner=? ORDER BY code').bind(owner),db.prepare('SELECT id,data FROM payments WHERE owner=?').bind(owner),db.prepare('SELECT id,office_id AS "officeId",payment_id AS "paymentId",name,category,mime,size,created FROM documents WHERE owner=? ORDER BY created DESC').bind(owner),db.prepare('SELECT id,office_id AS "officeId",data FROM leases WHERE owner=?').bind(owner),db.prepare('SELECT id,data FROM employee_requests WHERE owner=?').bind(owner),db.prepare('SELECT id,data FROM employees WHERE owner=?').bind(owner),db.prepare('SELECT id,seq,office_id AS "officeId",data FROM invoices WHERE owner=? ORDER BY seq DESC').bind(owner),db.prepare('SELECT data FROM invoice_issuers WHERE owner=?').bind(owner),db.prepare('SELECT id,email,data FROM users ORDER BY created'),db.prepare('SELECT id,assignee,data FROM tasks WHERE owner=?').bind(owner),db.prepare('SELECT id,data FROM customers WHERE owner=?').bind(owner)]);
const rows=(r:{results:unknown[]})=>r.results as Row[],inBranch=(b?:string)=>user.branches.includes(b||'BHB'),parse=(r:Row)=>({...JSON.parse(r.data),id:r.id});
const officeList=rows(offices).map(parse).filter(o=>inBranch(o.branch)),ids=new Set(officeList.map(o=>o.id));
const money=can(user,'cash')||can(user,'workbook')||can(user,'contracts'),people=rows(users).map(r=>({...JSON.parse(r.data),id:r.id,email:r.email}));
// Sales employees: names for the Sold by field and the commission page (inactive kept for past deals);
// rates only for those allowed to see every commission, or for the salesperson's own record.
const seeAll=has(user,'allCommissions')||can(user,'users');
const staff=rows(employees).map(parse),salesStaff=staff.filter(e=>e.job==='Sales').map(e=>({id:e.id,name:e.name,branch:e.branch,active:e.status!=='Inactive',...(seeAll||(user.employeeId&&e.id===user.employeeId)?{commissionNew:e.commissionNew??DEFAULT_RATES.commissionNew,commissionRenewal:e.commissionRenewal??DEFAULT_RATES.commissionRenewal}:{})}));
// Cash-basis commission: cleared rent received against the leases this person may see commission for
// (every seller with "see every commission", otherwise only their own), with just the fields the maths needs.
const leaseList=rows(leases).filter(r=>ids.has(r.officeId!)).map(parse),archived=new Set(leaseList.flatMap(l=>l.paymentIds||[])),allPayments=rows(payments).map(parse),counts=(seller?:string)=>!!seller&&(seeAll||seller===user.employeeId);
const cashIds=new Set([...officeList.filter(o=>counts(o.salesEmployeeId)).flatMap(o=>allPayments.filter(p=>p.officeId===o.id&&!archived.has(p.id)).map(p=>p.id)),...leaseList.filter(l=>counts(l.office?.salesEmployeeId)).flatMap(l=>l.paymentIds||[])]);
const salesCash=can(user,'sales')?allPayments.filter(p=>cashIds.has(p.id)&&p.direction==='Income'&&p.status==='Cleared'&&p.actual&&(p.incomeType||'Rent')==='Rent').map(({id,officeId,amount,actual})=>({id,officeId,amount,actual})):[];
// My dashboard: to-dos for this person (every to-do for those who manage Users & roles) and their own requests.
const manager=can(user,'users','edit'),taskList=(tasks.results as {id:string;assignee:string;data:string}[]).filter(t=>manager||t.assignee===user.userId).map(t=>({...JSON.parse(t.data),id:t.id,assignee:t.assignee}));
const myRequests=user.employeeId?rows(requests).map(parse).filter(r=>r.employeeId===user.employeeId):[];
return Response.json({me:user,salesStaff,salesCash,tasks:taskList,myRequests,
offices:officeList,
payments:money?rows(payments).map(parse).filter(p=>p.officeId?ids.has(p.officeId):inBranch(p.branch)):[],
documents:can(user,'documents')||can(user,'offices')?(docs.results as {officeId:string}[]).filter(d=>ids.has(d.officeId)):[],
leases:can(user,'offices')||can(user,'sales')?rows(leases).filter(r=>ids.has(r.officeId!)).map(parse):[],
// Invoices for an office in this person's branches, or for a customer without an office in those branches.
invoices:money?rows(invoices).filter(r=>r.officeId?ids.has(r.officeId):inBranch(JSON.parse(r.data).branch)).map(r=>({...JSON.parse(r.data),id:r.id,seq:r.seq})):[],
customers:can(user,'customers')?rows(customers).map(parse).filter(c=>inBranch(c.branch)):[],
issuers:money?rows(issuers).map(r=>JSON.parse(r.data)).filter(i=>inBranch(i.branch)):[],
employees:can(user,'employees')?staff.filter(e=>inBranch(e.branch)):[],
requests:can(user,'employees')?rows(requests).map(parse).filter(r=>inBranch(r.branch)):[],
...(can(user,'users')?{people:people.map(({id,name,email,roleId,branches,active,employeeId})=>({id,name,email,roleId,branches:branches||[],active,employeeId:employeeId||''})),staffList:staff.map(({id,name,job,branch})=>({id,name,job:job||'Other',branch})),roles:await loadRoles(db)}:{})});}catch(e){return failure(e);}}
