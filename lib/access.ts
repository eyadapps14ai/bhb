// Roles and permissions, shared by the server (enforcement) and the screens (what to show).
export const BRANCHES=['BHB','111'] as const;
export const pages=[['offices','Office portfolio'],['contracts','Lease contracts'],['customers','Customers'],['enquiries','Enquiries'],['cash','Cash and expenses'],['documents','Documents'],['workbook','Accounts'],['employees','Employees'],['whatsapp','WhatsApp'],['sales','Sales commission'],['users','Users & roles']] as const;
export const components=[['summary','Summary cards and branch table'],['export','Excel export and import'],['invoices','Create invoices'],['delete','Delete records'],['allCommissions','See every salesperson’s commission']] as const;
export type Page=typeof pages[number][0];
export type Component=typeof components[number][0];
export type Level='none'|'view'|'edit';
export type Role={id:string;name:string;pages:Record<Page,Level>;components:Record<Component,boolean>};
export type Access={userId:string;name:string;email:string;roleId:string;roleName:string;branches:string[];pages:Record<Page,Level>;components:Record<Component,boolean>;employeeId?:string;bootstrap?:boolean};
const every=<T,>(value:T)=><K extends string>(keys:readonly (readonly [K,string])[])=>Object.fromEntries(keys.map(([k])=>[k,value])) as Record<K,T>;
export const SUPER_ADMIN='super-admin';
export const defaultRoles:Role[]=[
 {id:SUPER_ADMIN,name:'Super admin',pages:every<Level>('edit')(pages),components:every(true)(components)},
 {id:'office-manager',name:'Office manager',pages:{offices:'edit',contracts:'edit',customers:'edit',enquiries:'edit',cash:'edit',documents:'edit',workbook:'edit',employees:'edit',whatsapp:'edit',sales:'view',users:'none'},components:{summary:true,export:true,invoices:true,delete:false,allCommissions:true}},
 {id:'sales',name:'Sales',pages:{offices:'view',contracts:'none',customers:'none',enquiries:'edit',cash:'none',documents:'none',workbook:'none',employees:'none',whatsapp:'edit',sales:'none',users:'none'},components:{summary:false,export:false,invoices:false,delete:false,allCommissions:false}},
];
// Stored roles may predate a new page or component; anything unknown falls back to the default (or nothing).
export function normaliseRole(role:Partial<Role>&{id:string}):Role{const base=defaultRoles.find(r=>r.id===role.id)||defaultRoles[2];if(role.id===SUPER_ADMIN)return {...defaultRoles[0]};const levels=['none','view','edit'];return {id:role.id,name:role.name||base.name,pages:Object.fromEntries(pages.map(([k])=>[k,levels.includes(role.pages?.[k] as string)?role.pages![k]:base.pages[k]])) as Record<Page,Level>,components:Object.fromEntries(components.map(([k])=>[k,typeof role.components?.[k]==='boolean'?role.components[k]:base.components[k]])) as Record<Component,boolean>};}
export const can=(a:Pick<Access,'pages'>,page:Page,level:Exclude<Level,'none'>='view')=>level==='view'?a.pages[page]!=='none':a.pages[page]==='edit';
export const has=(a:Pick<Access,'components'>,c:Component)=>!!a.components[c];
// Jobs on the Employees page. Sales employees carry their own commission rates and can be named as the seller on a lease.
export const JOBS=['Management','Office manager','Sales','Reception','Accounts','PRO services','Operations','Other'] as const;
// Commission: rate % of the whole contract value (rent excl. VAT and deposit over the lease), earned in the month the lease starts.
export const DEFAULT_RATES={commissionNew:5,commissionRenewal:2.5};
// Lease length in calendar months, counting the end day (1 Jan to 30 Jun = 6, 1 to 28 Feb = 1). A part month is
// days over that month's length; one day either way counts as a whole month, so "10 Oct to 10 Apr" is 6 months.
const plusMonths=(d:Date,n:number)=>{const x=new Date(d),day=x.getUTCDate();x.setUTCDate(1);x.setUTCMonth(x.getUTCMonth()+n);x.setUTCDate(Math.min(day,new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0)).getUTCDate()));return x};
export function leaseMonths(start:string,end:string){if(!start||!end||end<start)return 0;const s=new Date(start+'T00:00:00Z'),after=new Date(Date.parse(end+'T00:00:00Z')+864e5);let months=(after.getUTCFullYear()-s.getUTCFullYear())*12+after.getUTCMonth()-s.getUTCMonth();while(months>0&&plusMonths(s,months)>after)months--;const from=plusMonths(s,months),span=(plusMonths(s,months+1).getTime()-from.getTime())/864e5;let rest=(after.getTime()-from.getTime())/864e5;if(rest<=1)rest=0;else if(span-rest<=1){months++;rest=0}return Math.round((months+rest/span)*100)/100}
export function contractValue(o:{start:string;end:string;rent:number;period:string}){const months=leaseMonths(o.start,o.end);if(!months)return {months:0,value:0};const monthly=o.period==='Monthly'?o.rent:o.rent/12;return {months,value:Math.round(monthly*months*100)/100};}
