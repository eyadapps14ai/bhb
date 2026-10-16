import {paymentTotal,type Office,type Payment,type Attachment} from '@/lib/records';
import type {Enquiry} from '@/lib/enquiries';
import {invoiceNumber} from '@/lib/invoices';
import {DEFAULT_RATES} from '@/lib/access';
import {downloadXlsx,type Cell} from '@/lib/xlsx-export';
import {buildContracts} from './contracts-panel';
import {salesDeals,type SalesStaff} from './admin-panels';
// "Export Excel" on each page: the page's records with every useful field, one row each.
type Ctx={branch:string;today:string;offices:Office[];payments:Payment[];documents:Attachment[];leases:any[];invoices:any[];enquiries:Enquiry[];employees:any[];salesStaff:SalesStaff[];allOffices:Office[];allLeases:any[];origin:string;onlySeller?:string};
const r2=(n:number)=>Math.round(n*100)/100;
export const exportable=['contracts','enquiries','cash','documents','workbook','employees','sales'];
export function exportPage(view:string,c:Ctx){
 const code=(id:string|null)=>c.offices.find(o=>o.id===id)?.code||'',ref=(id:string|null)=>id?c.payments.find(p=>p.id===id)?.reference||'':'';
 let title='',rows:Cell[][]=[];
 if(view==='contracts'){title='Lease contracts';const seller=(id:string)=>c.salesStaff.find(s=>s.id===id)?.name||'';
  rows=[['Office','Tenant','Status','Sold by','Deal type','Lease reference','Start','End','Months','Rent (AED)','Rent period','Contract value (AED)','Invoiced before VAT (AED)','Received rent (AED)','Pending checks (AED)','Still to collect (AED)','Payments','Invoices'],
   ...buildContracts(c.offices,c.leases,c.payments,c.invoices,c.today).map(x=>[x.office.code,x.office.company,x.status,seller(x.office.salesEmployeeId),x.office.salesEmployeeId?x.office.dealType||'New':'',x.office.leaseReference,x.office.start,x.office.end,x.months,x.office.rent,x.office.period,x.value,r2(x.invoiced),x.received,x.pending,x.balance,x.payments.length,x.invoices.length])];}
 else if(view==='enquiries'){title='Website enquiries';rows=[['Received','Name','Email','Phone','Service','Page','Status','Message'],...[...c.enquiries].sort((a,b)=>b.created.localeCompare(a.created)).map(e=>[e.created.slice(0,16).replace('T',' '),e.name,e.email,e.phone,e.service,e.page,e.status,e.message])];}
 else if(view==='cash'){title='Payments';rows=[['Reference','Direction','Income type / category','Office','Payer / payee','Method','Bank','Due date','Cash date','Status','Amount (AED)','VAT (AED)','Deposit (AED)','Total (AED)','Description','Notes'],
   ...[...c.payments].sort((a,b)=>(b.due||'').localeCompare(a.due||'')).map(p=>[p.reference,p.direction,p.direction==='Income'?p.incomeType||'Rent':p.category,code(p.officeId),p.party,p.method,p.bankName,p.due,p.actual,['Pending','Unpaid'].includes(p.status)&&p.due<c.today?'Overdue':p.status,p.amount,p.vatAmount||0,p.securityDeposit||0,paymentTotal(p),p.description,p.notes])];}
 else if(view==='documents'){title='Documents';rows=[['Document','Type','Office','Payment','Uploaded','Size (KB)','Link'],...c.documents.map(d=>[d.name,d.category,code(d.officeId),ref(d.paymentId),d.created.slice(0,10),Math.round(d.size/1024),c.origin+'/api/documents?id='+encodeURIComponent(d.id)])];}
 else if(view==='workbook'){title='Tax invoices';rows=[['Invoice','Issue date','Supply date','Office','Buyer','Buyer TRN','Description','Before VAT (AED)','VAT (AED)','Total (AED)','Payment','Document'],
   ...[...c.invoices].sort((a,b)=>b.issueDate.localeCompare(a.issueDate)||b.seq-a.seq).map(i=>[invoiceNumber(i),i.issueDate,i.supplyDate,code(i.officeId),i.buyerName,i.buyerTrn||'',i.description,i.totals?.net||0,i.totals?.vat||0,i.totals?.total||0,ref(i.paymentId),c.origin+'/invoice/'+i.id])];}
 else if(view==='employees'){title='Employees';const list=c.employees.filter(e=>e.branch===c.branch),year=c.today.slice(0,4);
  const deals=salesDeals(c.allOffices,c.allLeases,list.filter(e=>e.job==='Sales').map(e=>({id:e.id,name:e.name,branch:e.branch,active:e.status!=='Inactive',commissionNew:e.commissionNew??DEFAULT_RATES.commissionNew,commissionRenewal:e.commissionRenewal??DEFAULT_RATES.commissionRenewal})));
  rows=[['Name','Job','Job title','Email','Phone','Branch','Status','Commission new (%)','Commission renewal (%)','Leases sold','Contracts sold (AED)','Commission '+year+' (AED)'],
   ...[...list].sort((a,b)=>a.name.localeCompare(b.name)).map(e=>{const mine=deals.filter(d=>d.sellerId===e.id),sales=e.job==='Sales';return [e.name,e.job||'Other',e.position||'',e.email,e.phone,e.branch,e.status||'Active',sales?e.commissionNew??DEFAULT_RATES.commissionNew:'',sales?e.commissionRenewal??DEFAULT_RATES.commissionRenewal:'',sales?mine.length:'',sales?r2(mine.reduce((a,d)=>a+d.value,0)):'',sales?r2(mine.filter(d=>d.start.slice(0,4)===year).reduce((a,d)=>a+d.commission,0)):'']})];}
 else if(view==='sales'){title='Sales commission';const name=(id:string)=>c.salesStaff.find(s=>s.id===id)?.name||'Former staff';
  rows=[['Office','Tenant','Sold by','Type','Lease start','Lease end','Months','Contract value (AED)','Rate (%)','Commission (AED)','Lease status'],...salesDeals(c.allOffices,c.allLeases,c.salesStaff).filter(d=>!c.onlySeller||d.sellerId===c.onlySeller).sort((a,b)=>b.start.localeCompare(a.start)).map(d=>[d.code,d.company,name(d.sellerId),d.dealType,d.start,d.end,d.months,d.value,d.rate,d.commission,d.status])];}
 else return false;
 downloadXlsx(title+' · '+c.branch,rows,c.branch+'-'+title.toLowerCase().replace(/\s+/g,'-')+'-'+c.today);return true;
}
