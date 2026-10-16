'use client';
import {DoorOpen,Hourglass,Inbox,FileText,Receipt} from 'lucide-react';
import {MHero,MAttention,MShares,MRows,MThree,MAnalysis,n0,aed0,plural,pct,shortDate,monthKey,type Chip} from './modern-kit';
import {paymentTotal,type Office,type Payment,type Attachment} from '@/lib/records';
import type {Enquiry} from '@/lib/enquiries';
import {invoiceNumber} from '@/lib/invoices';
// Modern theme Overview and Analysis for Office portfolio, Enquiries, Documents and Accounts, built from the shared kit.
const GOLD='#b5852f',BLUE='#2e5f7f',ORANGE='#c98a3c',TRACK='#e6dfd1';
const yearly=(o:Office)=>o.period==='Monthly'?o.rent*12:o.rent;
const addDays=(iso:string,n:number)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const prevMonth=(mo:string)=>{const d=new Date(mo+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7)};
const monthName=(mo:string)=>new Date(mo+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'});
const isPending=(p:Payment)=>p.direction==='Income'&&p.status==='Pending';
type DrillOff=(title:string,off:(o:Office,docs:Attachment[])=>boolean,note?:string)=>void;
type DrillPay=(title:string,pay:(p:Payment)=>boolean,note?:string,amount?:(p:Payment)=>number)=>void;
const delta=(now:number,before:number,label:string,money=false)=>{const d=now-before;return d?{text:(d>0?'+':'−')+(money?'AED ':'')+n0(Math.abs(d))+' vs '+label,up:d>0}:null};

// ---------- Office portfolio ----------
export type BranchLine={name:string;offices:number;active:number;cashIn:number;current:boolean;pick:()=>void};
export function OfficesOverview({offices,payments,documents,leases,asof,month,branches,isExpiring,isMissing,drillOff,drillPay}:{offices:Office[];payments:Payment[];documents:Attachment[];leases:any[];asof:string;month:string;branches:BranchLine[];isExpiring:(o:Office)=>boolean;isMissing:(o:Office,docs:Attachment[])=>boolean;drillOff:DrillOff;drillPay:DrillPay}){
 const physical=offices.filter(o=>o.kind==='Physical'),let_=physical.filter(o=>o.status==='Active'),virtual=offices.filter(o=>o.kind==='Virtual'),active=offices.filter(o=>o.status==='Active');
 const checks=payments.filter(p=>p.method==='Check'&&isPending(p)),soon=addDays(asof,30);
 const expiring=offices.filter(isExpiring),missing=offices.filter(o=>isMissing(o,documents)),awaiting=leases.filter(l=>!l.vacated);
 const ending=active.filter(o=>o.end&&o.end>=asof&&o.end<=soon),licences=active.filter(o=>o.licenseExpiry&&o.licenseExpiry>=asof&&o.licenseExpiry<=soon),dueIn=payments.filter(p=>isPending(p)&&p.due>=asof&&p.due<=soon);
 const chips:Chip[]=[];
 if(expiring.length)chips.push({label:plural(expiring.length,'lease or licence date')+' due',onClick:()=>drillOff('Lease or licence dates due',isExpiring,'Active offices whose lease or trade licence ends within 30 days of '+shortDate(asof)+', or has already ended.')});
 if(missing.length)chips.push({label:plural(missing.length,'office')+' missing copies',onClick:()=>drillOff('Missing licence details or copies',isMissing,'Active offices without a trade licence number, or without an uploaded licence or lease copy.')});
 const statuses=['Active','Available','Reserved','Inactive'] as const;
 return <>
  <MHero label="Occupancy · physical offices" value={pct(let_.length,physical.length)+'%'} bar={[[let_.length,GOLD],[physical.length-let_.length,TRACK]]} onClick={()=>drillOff('Let physical offices',o=>o.kind==='Physical'&&o.status==='Active')}
   text={physical.length?<>{let_.length} of {plural(physical.length,'physical office')} are let. {physical.filter(o=>o.status==='Available').length} available, {physical.filter(o=>o.status==='Reserved').length} reserved.</>:'Add your first physical office to see occupancy.'}
   stats={[{label:'Annual rent roll',value:aed0(active.reduce((a,o)=>a+yearly(o),0)),sub:plural(active.length,'active lease')+' · excl. VAT',onClick:()=>drillOff('Active leases',o=>o.status==='Active')},
    {label:<><DoorOpen size={14}/>Virtual offices</>,value:n0(virtual.length),sub:virtual.filter(o=>o.status==='Active').length+' active',onClick:()=>drillOff('Virtual offices',o=>o.kind==='Virtual')},
    {label:<><Hourglass size={14}/>Pending checks</>,value:aed0(checks.reduce((a,p)=>a+paymentTotal(p),0)),sub:checks.length?plural(checks.length,'check')+' not yet cleared':'Nothing waiting to clear',onClick:()=>drillPay('Pending checks',p=>p.method==='Check'&&isPending(p),'Incoming checks that have not cleared yet.')}]}/>
  {(chips.length>0||awaiting.length>0)&&<MAttention title={plural(expiring.length+missing.length,'office needs','offices need')+' you'} sub={awaiting.length?plural(awaiting.length,'cancelled lease')+' awaiting vacancy':undefined} chips={chips}/>}
  <MThree>
   <MShares title="Offices by status" sub={plural(offices.length,'office')+' in this branch'} empty="No offices yet." total={['All offices',n0(offices.length)]}
    rows={statuses.map(s=>{const n=offices.filter(o=>o.status===s).length;return {label:s,value:n,text:plural(n,'office'),onClick:()=>drillOff(s+' offices',o=>o.status===s)}})}/>
   <MRows title="Branches" sub={'Cash in · '+monthName(month)} rows={branches.map(b=>({label:b.name+(b.current?' · viewing':''),sub:plural(b.offices,'office')+' · '+b.active+' active',value:aed0(b.cashIn),onClick:b.pick}))}/>
   <MRows title="Next 30 days" sub={'From '+shortDate(asof)} rows={[
    {label:'Leases ending',sub:ending.length?ending.slice(0,2).map(o=>o.code).join(', ')+(ending.length>2?' and more':''):undefined,value:ending.length?n0(ending.length):<em>None</em>,onClick:ending.length?()=>drillOff('Leases ending in 30 days',o=>o.status==='Active'&&!!o.end&&o.end>=asof&&o.end<=soon):undefined},
    {label:'Licences expiring',value:licences.length?n0(licences.length):<em>None</em>,onClick:licences.length?()=>drillOff('Licences expiring in 30 days',o=>o.status==='Active'&&!!o.licenseExpiry&&o.licenseExpiry>=asof&&o.licenseExpiry<=soon):undefined},
    {label:'Income due',value:dueIn.length?'+ '+aed0(dueIn.reduce((a,p)=>a+paymentTotal(p),0)):<em>Nothing scheduled</em>,tone:'up',onClick:dueIn.length?()=>drillPay('Income due in 30 days',p=>isPending(p)&&p.due>=asof&&p.due<=soon):undefined}]}
    dark={ending.length?{label:'Rent up for renewal',value:aed0(ending.reduce((a,o)=>a+yearly(o),0)),sub:'a year, on '+plural(ending.length,'lease')+' ending soon'}:{label:'Rent up for renewal',value:'AED 0',sub:'No lease ends in the next 30 days'}}/>
  </MThree>
 </>;
}
export function OfficeAnalysis({offices,onOpen}:{offices:Office[];onOpen:(id:string)=>void}){
 return <MAnalysis title="Analyze offices" subtitle="Annual rent, excl. VAT · every office in this branch" rows={offices} unit="Annual rent (AED)" filename="offices" measure={yearly} format={aed0}
  describe={o=>({label:o.code,sub:(o.company||'No tenant')+' · '+o.status})} onOpen={o=>onOpen(o.id)} search={o=>[o.code,o.company,o.contact,o.location].join(' ')}
  filters={[{id:'all',label:'All',test:()=>true},{id:'active',label:'Active',test:o=>o.status==='Active'},{id:'physical',label:'Physical',test:o=>o.kind==='Physical'},{id:'virtual',label:'Virtual',test:o=>o.kind==='Virtual'}]}
  groupings={[{id:'status',label:'Status',key:o=>o.status,order:o=>String(['Active','Available','Reserved','Inactive'].indexOf(o.status)),sort:'asc'},{id:'type',label:'Type',key:o=>o.kind},{id:'location',label:'Location',key:o=>o.location||'Location not set'},{id:'end',label:'Lease end',key:o=>o.end?monthKey(o.end):'No lease',order:o=>o.end||'9999',sort:'asc'},{id:'tenant',label:'Tenant',key:o=>o.company||'No tenant'}]}
  summary={l=>[['Offices',n0(l.length)],['Active',n0(l.filter(o=>o.status==='Active').length)],['Annual rent',aed0(l.reduce((a,o)=>a+yearly(o),0))]]}/>;
}

// ---------- Enquiries ----------
const pageName=(p:string)=>!p?'Not given':p==='/'?'Home page':p;
const days=(iso:string,asof:string)=>Math.max(0,Math.round((Date.parse(asof)-Date.parse(iso.slice(0,10)))/864e5));
export function EnquiriesOverview({enquiries,asof}:{enquiries:Enquiry[];asof:string}){
 const fresh=enquiries.filter(e=>e.status==='New'),contacted=enquiries.filter(e=>e.status==='Contacted'),closed=enquiries.filter(e=>e.status==='Closed');
 const mo=asof.slice(0,7),pm=prevMonth(mo),thisMonth=enquiries.filter(e=>e.created.slice(0,7)===mo).length,lastMonth=enquiries.filter(e=>e.created.slice(0,7)===pm).length;
 const waiting=fresh.filter(e=>days(e.created,asof)>2),oldest=[...fresh].sort((a,b)=>a.created.localeCompare(b.created))[0];
 const count=(key:(e:Enquiry)=>string)=>{const m=new Map<string,number>();for(const e of enquiries){const k=pageName(key(e));m.set(k,(m.get(k)||0)+1)}return [...m].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([label,value])=>({label,value,text:plural(value,'enquiry','enquiries')}))};
 const inbox=()=>document.querySelector('.inbox')?.scrollIntoView({behavior:'smooth',block:'start'});
 const d=delta(thisMonth,lastMonth,monthName(pm).slice(0,3));
 return <>
  <MHero label="Waiting for a reply" value={n0(fresh.length)} bar={[[fresh.length,GOLD],[contacted.length,BLUE],[closed.length,TRACK]]} onClick={inbox}
   text={enquiries.length?<>{fresh.length} new, {contacted.length} contacted and {closed.length} closed. Open the inbox below to reply.</>:'Enquiries sent from the website appear here.'}
   stats={[{label:<><Inbox size={14}/>This month</>,value:n0(thisMonth),sub:d?d.text:'No change vs '+monthName(pm).slice(0,3),tone:d?(d.up?'up':'down'):undefined},
    {label:'Answered',value:pct(contacted.length+closed.length,enquiries.length)+'%',sub:'Contacted or closed'},
    {label:'Oldest waiting',value:oldest?plural(days(oldest.created,asof),'day'):'None',sub:oldest?oldest.name+' · '+oldest.service:'Every enquiry has a reply'}]}/>
  {waiting.length>0&&<MAttention title={plural(waiting.length,'enquiry','enquiries')+' waiting more than 2 days'} sub="reply or mark them contacted" chips={[{label:'Open the inbox',onClick:inbox}]}/>}
  <MThree>
   <MShares title="By service" sub="What people ask for" rows={count(e=>e.service)} empty="No enquiries yet."/>
   <MShares title="From page" sub="Where on the website they wrote" rows={count(e=>e.page)} empty="No enquiries yet."/>
   <MRows title="Latest" sub="Newest first" empty="No enquiries yet." rows={[...enquiries].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,4).map(e=>({label:e.name,sub:e.service+' · '+shortDate(e.created.slice(0,10)),value:<span className={'pill '+(e.status==='New'?'warn':e.status==='Contacted'?'good':'neutral')}>{e.status}</span>,onClick:inbox}))}/>
  </MThree>
 </>;
}
export function EnquiryAnalysis({enquiries}:{enquiries:Enquiry[]}){
 return <MAnalysis title="Analyze enquiries" subtitle="Every enquiry from the website" rows={enquiries} unit="Enquiries" filename="enquiries" measure={()=>1} format={n=>n0(n)}
  describe={e=>({label:e.name,sub:e.service})} search={e=>[e.name,e.email,e.phone,e.service,e.message,e.page].join(' ')}
  filters={[{id:'all',label:'All',test:()=>true},{id:'new',label:'New',test:e=>e.status==='New'},{id:'contacted',label:'Contacted',test:e=>e.status==='Contacted'},{id:'closed',label:'Closed',test:e=>e.status==='Closed'}]}
  groupings={[{id:'status',label:'Status',key:e=>e.status,order:e=>String(['New','Contacted','Closed'].indexOf(e.status)),sort:'asc',line:e=>e.service||'Not given'},{id:'service',label:'Service',key:e=>e.service||'Not given',line:e=>e.status},{id:'month',label:'Month',key:e=>monthKey(e.created),order:e=>e.created.slice(0,7),sort:'desc',line:e=>e.service||'Not given'},{id:'page',label:'Page',key:e=>pageName(e.page),line:e=>e.service||'Not given'}]}
  summary={l=>[['Enquiries',n0(l.length)],['New',n0(l.filter(e=>e.status==='New').length)],['Answered',pct(l.filter(e=>e.status!=='New').length,l.length)+'%']]}/>;
}

// ---------- Documents ----------
export function DocumentsOverview({documents,offices,isMissing,drillOff,onDocuments}:{documents:Attachment[];offices:Office[];isMissing:(o:Office,docs:Attachment[])=>boolean;drillOff:DrillOff;onDocuments:()=>void}){
 const active=offices.filter(o=>o.status==='Active'),missing=offices.filter(o=>isMissing(o,documents)),code=(id:string)=>offices.find(o=>o.id===id)?.code||'No office';
 const has=(o:Office,c:string)=>documents.some(d=>d.officeId===o.id&&d.category===c);
 const noLicence=active.filter(o=>!has(o,'Trade licence')),noLease=active.filter(o=>!has(o,'Lease agreement')),noNumber=active.filter(o=>!o.licenseNumber);
 const types=[...new Set(documents.map(d=>d.category))].map(c=>({label:c,value:documents.filter(d=>d.category===c).length})).sort((a,b)=>b.value-a.value);
 return <>
  <MHero label="Office documents" value={n0(documents.length)} bar={[[active.length-missing.length,GOLD],[missing.length,TRACK]]} onClick={onDocuments}
   text={active.length?<>{active.length-missing.length} of {plural(active.length,'active office')} have a licence number and both licence and lease copies.</>:'Upload a licence, lease agreement or check copy for an office.'}
   stats={[...['Trade licence','Lease agreement'].map(c=>{const l=documents.filter(d=>d.category===c);return {label:<><FileText size={14}/>{c==='Trade licence'?'Licence copies':'Lease copies'}</>,value:n0(l.length),sub:l.length?plural(new Set(l.map(d=>d.officeId)).size,'office'):'None uploaded yet'}}),
    {label:'Offices covered',value:n0(new Set(documents.map(d=>d.officeId)).size),sub:'of '+plural(offices.length,'office')}]}/>
  {missing.length>0&&<MAttention title={plural(missing.length,'active office')+' missing copies'} sub="upload them from the office" chips={[{label:'See which offices',onClick:()=>drillOff('Missing licence details or copies',isMissing,'Active offices without a trade licence number, or without an uploaded licence or lease copy.')}]}/>}
  <MThree>
   <MShares title="By type" sub={plural(documents.length,'document')} rows={types.map(t=>({...t,text:n0(t.value)}))} empty="No documents yet."/>
   <MRows title="Recently uploaded" sub="Newest first" empty="No documents yet." rows={[...documents].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,4).map(d=>({label:d.name,sub:d.category+' · '+code(d.officeId)+' · '+shortDate(d.created.slice(0,10)),value:Math.round(d.size/1024)+' KB',onClick:()=>window.open('/api/documents?id='+encodeURIComponent(d.id),'_blank','noopener')}))}/>
   <MRows title="Missing on active offices" sub={plural(active.length,'active office')} rows={[
    {label:'Licence copy',value:noLicence.length?n0(noLicence.length):<em>None missing</em>,onClick:noLicence.length?()=>drillOff('No licence copy',o=>o.status==='Active'&&!has(o,'Trade licence')):undefined},
    {label:'Lease copy',value:noLease.length?n0(noLease.length):<em>None missing</em>,onClick:noLease.length?()=>drillOff('No lease copy',o=>o.status==='Active'&&!has(o,'Lease agreement')):undefined},
    {label:'Licence number',value:noNumber.length?n0(noNumber.length):<em>None missing</em>,onClick:noNumber.length?()=>drillOff('No licence number',o=>o.status==='Active'&&!o.licenseNumber):undefined}]}
    dark={{label:'Complete offices',value:(active.length-missing.length)+' of '+active.length,sub:pct(active.length-missing.length,active.length)+'% have every copy'}}/>
  </MThree>
 </>;
}
export function DocumentAnalysis({documents,offices}:{documents:Attachment[];offices:Office[]}){
 const code=(id:string)=>offices.find(o=>o.id===id)?.code||'No office';
 return <MAnalysis title="Analyze documents" subtitle="Every uploaded file in this branch" rows={documents} unit="Documents" filename="documents" measure={()=>1} format={n=>n0(n)}
  describe={d=>({label:d.name,sub:d.category})} search={d=>[d.name,d.category,code(d.officeId)].join(' ')}
  groupings={[{id:'type',label:'Type',key:d=>d.category,line:d=>code(d.officeId)},{id:'office',label:'Office',key:d=>code(d.officeId),line:d=>d.category},{id:'month',label:'Month uploaded',key:d=>monthKey(d.created),order:d=>d.created.slice(0,7),sort:'desc',line:d=>d.category}]}
  summary={l=>[['Documents',n0(l.length)],['Offices',n0(new Set(l.map(d=>d.officeId)).size)],['Total size',(l.reduce((a,d)=>a+d.size,0)/1048576).toFixed(1)+' MB']]}/>;
}

// ---------- Accounts (invoices) ----------
export function AccountsOverview({invoices,payments,offices,month,drillPay}:{invoices:any[];payments:Payment[];offices:Office[];month:string;drillPay:DrillPay}){
 const pm=prevMonth(month),year=month.slice(0,4),of=(mo:string)=>invoices.filter(i=>i.issueDate?.slice(0,7)===mo),sum=(l:any[],k:'net'|'vat'|'total')=>l.reduce((a,i)=>a+(i.totals?.[k]||0),0);
 const now=of(month),before=of(pm),ytd=invoices.filter(i=>i.issueDate?.slice(0,4)===year&&i.issueDate.slice(0,7)<=month);
 const linked=new Set(invoices.map(i=>i.paymentId).filter(Boolean)),uninvoiced=(p:Payment)=>p.direction==='Income'&&p.status==='Cleared'&&(p.incomeType||'Rent')==='Rent'&&!!p.officeId&&!linked.has(p.id)&&p.actual?.slice(0,7)===month;
 const open=payments.filter(uninvoiced),d=delta(sum(now,'total'),sum(before,'total'),monthName(pm).slice(0,3),true);
 const buyers=new Map<string,number>();for(const i of ytd)buyers.set(i.buyerName||'No buyer',(buyers.get(i.buyerName||'No buyer')||0)+(i.totals?.total||0));
 const months=[month,pm,prevMonth(pm)];
 return <>
  <MHero label={'Invoiced · '+monthName(month)} chip={d} unit="AED" value={n0(sum(now,'total'))} bar={[[sum(now,'net'),BLUE],[sum(now,'vat'),ORANGE]]}
   text={now.length?<>AED {n0(sum(now,'net'))} before VAT and AED {n0(sum(now,'vat'))} VAT across {plural(now.length,'invoice')}.</>:'No invoices issued this month yet.'}
   stats={[{label:<><Receipt size={14}/>Invoices this month</>,value:n0(now.length),sub:before.length+' in '+monthName(pm)},
    {label:'VAT invoiced '+year,value:aed0(sum(ytd,'vat')),sub:'January to '+monthName(month)},
    {label:'Rent not invoiced',value:aed0(open.reduce((a,p)=>a+p.amount,0)),sub:open.length?plural(open.length,'cleared payment')+' this month':'Every cleared rent has an invoice',tone:open.length?'down':undefined,onClick:open.length?()=>drillPay('Cleared rent without an invoice · '+monthName(month),uninvoiced,'Cleared rent payments this month with no invoice linked. Open a payment and choose Invoice.',p=>p.amount):undefined}]}/>
  {open.length>0&&<MAttention title={plural(open.length,'cleared rent payment')+' without an invoice'} sub={'AED '+n0(open.reduce((a,p)=>a+p.amount,0))+' before VAT'} chips={[{label:'See the payments',onClick:()=>drillPay('Cleared rent without an invoice · '+monthName(month),uninvoiced,'Cleared rent payments this month with no invoice linked. Open a payment and choose Invoice.',p=>p.amount)}]}/>}
  <MThree>
   <MShares title="Top buyers" sub={year+' so far · incl. VAT'} rows={[...buyers].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([label,value])=>({label,value,text:aed0(value)}))} empty="No invoices this year yet."/>
   <MRows title="Latest invoices" sub="Newest first" empty="No invoices yet." rows={[...invoices].sort((a,b)=>b.issueDate.localeCompare(a.issueDate)||b.seq-a.seq).slice(0,4).map(i=>({label:invoiceNumber(i),sub:(i.buyerName||'No buyer')+' · '+shortDate(i.issueDate)+' · '+(offices.find(o=>o.id===i.officeId)?.code||''),value:aed0(i.totals?.total||0),onClick:()=>window.open('/invoice/'+i.id,'_blank','noopener')}))}/>
   <MRows title="Last three months" sub="Invoice totals, incl. VAT" rows={months.map(mo=>({label:monthName(mo),sub:plural(of(mo).length,'invoice'),value:aed0(sum(of(mo),'total'))}))} dark={{label:'Year to date',value:aed0(sum(ytd,'total')),sub:'VAT '+aed0(sum(ytd,'vat'))}}/>
  </MThree>
 </>;
}
export function InvoiceAnalysis({invoices,offices}:{invoices:any[];offices:Office[]}){
 const code=(id:string)=>offices.find(o=>o.id===id)?.code||'No office';
 return <MAnalysis title="Analyze invoices" subtitle="Invoice totals incl. VAT · this branch" rows={invoices} unit="Total (AED)" filename="invoices" measure={i=>i.totals?.total||0} format={aed0}
  describe={i=>({label:invoiceNumber(i),sub:(i.buyerName||'No buyer')+' · '+shortDate(i.issueDate)})} onOpen={i=>window.open('/invoice/'+i.id,'_blank','noopener')} search={i=>[invoiceNumber(i),i.buyerName,i.description,code(i.officeId)].join(' ')}
  groupings={[{id:'month',label:'Month',key:i=>monthKey(i.issueDate),order:i=>i.issueDate.slice(0,7),sort:'desc'},{id:'buyer',label:'Buyer',key:i=>i.buyerName||'No buyer'},{id:'office',label:'Office',key:i=>code(i.officeId)}]}
  summary={l=>[['Before VAT',aed0(l.reduce((a,i)=>a+(i.totals?.net||0),0))],['VAT',aed0(l.reduce((a,i)=>a+(i.totals?.vat||0),0))],['Total',aed0(l.reduce((a,i)=>a+(i.totals?.total||0),0))]]}/>;
}
