// Roles and permissions, shared by the server (enforcement) and the screens (what to show).
export const BRANCHES=['BHB','111'] as const;
export const pages=[['offices','Office portfolio'],['enquiries','Enquiries'],['cash','Cash flow'],['documents','Documents'],['workbook','Accounts'],['employees','Employees'],['whatsapp','WhatsApp'],['sales','Sales commission'],['users','Users & roles']] as const;
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
 {id:'office-manager',name:'Office manager',pages:{offices:'edit',enquiries:'edit',cash:'edit',documents:'edit',workbook:'edit',employees:'edit',whatsapp:'edit',sales:'view',users:'none'},components:{summary:true,export:true,invoices:true,delete:false,allCommissions:true}},
 {id:'sales',name:'Sales',pages:{offices:'view',enquiries:'edit',cash:'none',documents:'none',workbook:'none',employees:'none',whatsapp:'edit',sales:'view',users:'none'},components:{summary:false,export:false,invoices:false,delete:false,allCommissions:false}},
];
// Stored roles may predate a new page or component; anything unknown falls back to the default (or nothing).
export function normaliseRole(role:Partial<Role>&{id:string}):Role{const base=defaultRoles.find(r=>r.id===role.id)||defaultRoles[2];if(role.id===SUPER_ADMIN)return {...defaultRoles[0]};const levels=['none','view','edit'];return {id:role.id,name:role.name||base.name,pages:Object.fromEntries(pages.map(([k])=>[k,levels.includes(role.pages?.[k] as string)?role.pages![k]:base.pages[k]])) as Record<Page,Level>,components:Object.fromEntries(components.map(([k])=>[k,typeof role.components?.[k]==='boolean'?role.components[k]:base.components[k]])) as Record<Component,boolean>};}
export const can=(a:Pick<Access,'pages'>,page:Page,level:Exclude<Level,'none'>='view')=>level==='view'?a.pages[page]!=='none':a.pages[page]==='edit';
export const has=(a:Pick<Access,'components'>,c:Component)=>!!a.components[c];
// Jobs on the Employees page. Sales employees carry their own commission rates and can be named as the seller on a lease.
export const JOBS=['Management','Office manager','Sales','Reception','Accounts','PRO services','Operations','Other'] as const;
// Commission: rate % of the whole contract value (rent excl. VAT and deposit over the lease), earned in the month the lease starts.
export const DEFAULT_RATES={commissionNew:5,commissionRenewal:2.5};
export function contractValue(o:{start:string;end:string;rent:number;period:string}){if(!o.start||!o.end||o.end<o.start)return {months:0,value:0};const days=(Date.parse(o.end+'T00:00:00Z')-Date.parse(o.start+'T00:00:00Z'))/864e5,months=Math.round(days/30.4375*10)/10,monthly=o.period==='Monthly'?o.rent:o.rent/12;return {months,value:Math.round(monthly*months*100)/100};}
