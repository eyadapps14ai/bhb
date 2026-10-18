'use client';
import {useState} from 'react';
import {ScrollText,Search,ChevronRight,UserPlus,ArrowRight,X} from 'lucide-react';
import {contractValue} from '@/lib/access';
import {type Office,type Payment,type Attachment} from '@/lib/records';
import type {SalesStaff} from './admin-panels';
import {GroupedTable,type Column} from './board';
import {LeasePage} from './lease-page';
import {MAnalysis,aed0} from './modern-kit';
const fmt0=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:0}).format(n),n0=(n:number)=>new Intl.NumberFormat('en-AE',{maximumFractionDigits:0}).format(Math.round(n));
const showDate=(s:string)=>s?new Date(s+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
export type Contract={key:string;office:Office;officeId:string;leaseId:string|null;status:'Current'|'Ended'|'Cancelled';cancelled:string;months:number;value:number;payments:Payment[];invoices:any[];received:number;pending:number;invoiced:number;balance:number;documents:Attachment[]};

// One contract per current lease (an office with a tenant and start date) and per cancelled lease (its saved snapshot).
// Payments belong to a cancelled lease when it archived them, otherwise to the office's current lease; only rent counts
// as cash against the lease (PRO services and other income on the office do not). Invoices follow their payment
// (skipped when that payment is not rent), or else the office lease whose dates cover the issue date.
// The day a document was uploaded, in Dubai (a file uploaded at 01:00 in Dubai belongs to that day, not the UTC one).
export const docDay=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date(iso));
export function buildContracts(offices:Office[],leases:any[],payments:Payment[],invoices:any[],today:string,documents:Attachment[]=[]):Contract[]{
 const archived=new Set(leases.flatMap(l=>l.paymentIds||[])),isRent=(p:Payment)=>p.direction==='Income'&&(p.incomeType||'Rent')==='Rent';
 const base=[...offices.filter(o=>o.company&&o.start&&!o.leaseClosed).map(o=>({key:o.id,office:o,officeId:o.id,leaseId:null,cancelled:'',pays:payments.filter(p=>p.officeId===o.id&&!archived.has(p.id))})),
  ...leases.filter(l=>l.office).map(l=>({key:l.id,office:l.office as Office,officeId:l.officeId||l.office.id,leaseId:l.id as string,cancelled:l.date||'',pays:payments.filter(p=>(l.paymentIds||[]).includes(p.id))}))];
 const owner=(inv:any)=>base.find(c=>inv.paymentId&&c.pays.some(p=>p.id===inv.paymentId))||base.find(c=>c.officeId===inv.officeId&&c.leaseId&&inv.issueDate>=c.office.start&&inv.issueDate<=(c.cancelled||c.office.end||'9999'))||base.find(c=>c.officeId===inv.officeId&&!c.leaseId);
 // Documents (Admin #863): one attached to a payment goes to the lease of that payment; any other one to the lease the
 // office had when it was uploaded (after the lease before it was cancelled, up to this one's cancellation).
 const docsOf=(c:typeof base[number])=>{const mine=new Set(c.pays.map(p=>p.id)),owned=new Set(base.flatMap(x=>x.pays.map(p=>p.id))),from=base.filter(x=>x.officeId===c.officeId&&x.leaseId&&x.cancelled&&(!c.leaseId||x.cancelled<c.cancelled)).map(x=>x.cancelled).sort().pop()||'',to=c.leaseId?c.cancelled||'9999':'9999';
  return documents.filter(d=>d.officeId===c.officeId&&(d.paymentId&&owned.has(d.paymentId)?mine.has(d.paymentId):docDay(d.created)>from&&docDay(d.created)<=to)).sort((a,b)=>b.created.localeCompare(a.created))};
 const byContract=new Map<string,any[]>();for(const inv of invoices){const paid=inv.paymentId&&payments.find(p=>p.id===inv.paymentId);if(paid&&!isRent(paid))continue;const c=owner(inv);if(c)byContract.set(c.key,[...(byContract.get(c.key)||[]),inv])}
 return base.map(c=>{const income=c.pays.filter(isRent),{months,value}=contractValue(c.office),received=income.filter(p=>p.status==='Cleared').reduce((a,p)=>a+p.amount,0),pending=income.filter(p=>p.status==='Pending').reduce((a,p)=>a+p.amount,0),inv=byContract.get(c.key)||[];
  return {key:c.key,office:c.office,officeId:c.officeId,leaseId:c.leaseId,cancelled:c.cancelled,status:c.leaseId?'Cancelled' as const:c.office.end&&c.office.end<today?'Ended' as const:'Current' as const,months,value,payments:c.pays.sort((a,b)=>(a.due||'').localeCompare(b.due||'')),invoices:inv.sort((a,b)=>b.issueDate.localeCompare(a.issueDate)),received,pending,invoiced:inv.reduce((a,i)=>a+(i.totals?.net||0)-(i.credited?.net||0),0),balance:Math.max(0,Math.round((value-received)*100)/100),documents:docsOf(c)}})
  .sort((a,b)=>b.office.start.localeCompare(a.office.start));
}

// Lease contracts: each lease with its invoices and the cash received against it. Overview is a summary and the
// contract list; Analytical is the grouped table (Classic) or the Analysis with share bars (Modern).
type Focus=''|'noSeller'|'uninvoiced'|'ending';
const focusLabel:Record<Exclude<Focus,''>,string>={noSeller:'Leases without a seller',uninvoiced:'Leases not invoiced yet',ending:'Ending in the next 60 days'};
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
export function ContractsPanel({documents=[],onUpload,offices,leases,payments,invoices,salesStaff,today,canInvoice,canPay,onInvoice,onPayment,onOpenOffice,onEditLease,onReceive,onReplace,openKey,onOpenKey,layout='classic',modern=false}:{documents?:Attachment[];onUpload?:(o:Office)=>void;layout?:string;modern?:boolean;openKey?:string;onOpenKey?:(k:string)=>void;onReceive?:(p:Payment,date:string)=>Promise<void>;onReplace?:(p:Payment)=>void;offices:Office[];leases:any[];payments:Payment[];invoices:any[];salesStaff:SalesStaff[];today:string;canInvoice:boolean;canPay:boolean;onInvoice:(o:Office,p?:Payment)=>void;onPayment:(o:Office)=>void;onOpenOffice:(id:string)=>void;onEditLease?:(o:Office)=>void}){
 // Which lease is open on its own page; the main page can open one (after saving a new lease) through openKey.
 const [filter,setFilter]=useState<'Current'|'Ended'|'Cancelled'|'All'>('Current'),[query,setQuery]=useState(''),[openLocal,setOpenLocal]=useState(''),[focus,setFocus]=useState<Focus>('');
 const open=openKey??openLocal,setOpen=onOpenKey??setOpenLocal;
 const all=buildContracts(offices,leases,payments,invoices,today,documents),seller=(id:string)=>salesStaff.find(s=>s.id===id)?.name||'';
 const soon=new Date(Date.parse(today+'T00:00:00Z')+60*864e5).toISOString().slice(0,10);
 const focusTest:Record<Exclude<Focus,''>,(x:Contract)=>boolean>={noSeller:x=>x.status==='Current'&&!x.office.salesEmployeeId,uninvoiced:x=>x.status==='Current'&&!x.invoices.length,ending:x=>x.status==='Current'&&!!x.office.end&&x.office.end<=soon};
 const shown=all.filter(c=>(focus?focusTest[focus](c):filter==='All'||c.status===filter)&&[c.office.code,c.office.company,c.office.leaseReference,seller(c.office.salesEmployeeId)].join(' ').toLowerCase().includes(query.toLowerCase()));
 const sum=(k:'value'|'received'|'balance'|'invoiced'|'pending',l=shown)=>l.reduce((a,c)=>a+c[k],0),c=all.find(x=>x.key===open);
 const meter=(x:Contract)=>x.value?Math.min(100,x.received/x.value*100):0;
 const elapsed=(x:Contract)=>{const t=(s:string)=>Date.parse(s+'T00:00:00Z');return x.office.start&&x.office.end?Math.min(100,Math.max(0,(t(today)-t(x.office.start))/Math.max(1,t(x.office.end)-t(x.office.start))*100)):0};
 const monthOf=(s:string)=>s?new Date(s.slice(0,7)+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}):'No date';
 const pillClass=(x:Contract)=>'pill '+(x.status==='Current'?'good':x.status==='Cancelled'?'danger':'neutral');
 const current=all.filter(x=>x.status==='Current'),counts={noSeller:current.filter(focusTest.noSeller).length,uninvoiced:current.filter(focusTest.uninvoiced).length,ending:current.filter(focusTest.ending).length};
 const pick=(f:Focus)=>{setFocus(f);setQuery('');document.querySelector('.lc-section')?.scrollIntoView({behavior:'smooth',block:'start'})};
 const columns:Column<Contract>[]=[
  {id:'office',label:'Office / tenant',cell:x=><><button type="button" className="text-button" onClick={()=>setOpen(x.key)}>{x.office.code}</button><small>{x.office.company||'—'}</small></>},
  {id:'seller',label:'Sold by',cell:x=>seller(x.office.salesEmployeeId)||'—'},
  {id:'status',label:'Status',cell:x=><span className={pillClass(x)}>{x.status}</span>},
  {id:'term',label:'Term',cell:x=><>{showDate(x.office.start)} – {showDate(x.office.end)}<small>{x.months} mo</small></>},
  {id:'value',label:'Contract value (AED)',numeric:true,cell:x=>n0(x.value),total:l=>n0(l.reduce((a,x)=>a+x.value,0))},
  {id:'invoiced',label:'Invoiced',numeric:true,cell:x=>n0(x.invoiced),total:l=>n0(l.reduce((a,x)=>a+x.invoiced,0))},
  {id:'received',label:'Received',numeric:true,cell:x=>n0(x.received),total:l=>n0(l.reduce((a,x)=>a+x.received,0))},
  {id:'balance',label:'Balance',numeric:true,highlight:true,cell:x=>n0(x.balance),total:l=>n0(l.reduce((a,x)=>a+x.balance,0))},
 ];
 const grid=<GroupedTable title="Lease contracts" rows={all} rowKey={x=>x.key} columns={columns} search={x=>[x.office.code,x.office.company,x.office.leaseReference,seller(x.office.salesEmployeeId)].join(' ')} initialGroups={['status']} empty="Add the tenant and lease dates on an office to start a contract."
  filters={[{id:'all',label:'All',test:()=>true},{id:'current',label:'Current',test:x=>x.status==='Current'},{id:'ended',label:'Ended',test:x=>x.status==='Ended'},{id:'cancelled',label:'Cancelled',test:x=>x.status==='Cancelled'},{id:'balance',label:'Still to collect',test:x=>x.balance>0},{id:'uninvoiced',label:'Not invoiced',test:x=>!x.invoices.length},{id:'noseller',label:'No seller',test:x=>!x.office.salesEmployeeId}]}
  groupings={[{id:'status',label:'Status',key:x=>x.status},{id:'seller',label:'Sold by',key:x=>seller(x.office.salesEmployeeId)||'No seller'},{id:'type',label:'Deal type',key:x=>x.office.salesEmployeeId?x.office.dealType||'New':'—'},{id:'start',label:'Start month',key:x=>monthOf(x.office.start)},{id:'tenant',label:'Tenant',key:x=>x.office.company||'—'}]}/>;
 const analysis=<MAnalysis title="Analyze lease contracts" subtitle="Contract value: rent over each lease, excl. VAT" rows={all} unit="Contract value (AED)" filename="lease-contracts" measure={x=>x.value} format={aed0}
  describe={x=>({label:x.office.code,sub:(x.office.company||'No tenant')+' · '+showDate(x.office.start)+' – '+showDate(x.office.end)})} onOpen={x=>setOpen(x.key)} search={x=>[x.office.code,x.office.company,x.office.leaseReference,seller(x.office.salesEmployeeId)].join(' ')}
  filters={[{id:'all',label:'All',test:()=>true},{id:'current',label:'Current',test:x=>x.status==='Current'},{id:'ended',label:'Ended',test:x=>x.status==='Ended'},{id:'cancelled',label:'Cancelled',test:x=>x.status==='Cancelled'},{id:'balance',label:'Still to collect',test:x=>x.balance>0},{id:'noseller',label:'No seller',test:x=>!x.office.salesEmployeeId}]}
  groupings={[{id:'status',label:'Status',key:x=>x.status,order:x=>String(['Current','Ended','Cancelled'].indexOf(x.status)),sort:'asc'},{id:'seller',label:'Sold by',key:x=>seller(x.office.salesEmployeeId)||'No seller'},{id:'type',label:'Deal type',key:x=>x.office.salesEmployeeId?x.office.dealType||'New':'No seller'},{id:'start',label:'Start month',key:x=>monthOf(x.office.start),order:x=>x.office.start,sort:'desc'},{id:'end',label:'End month',key:x=>monthOf(x.office.end),order:x=>x.office.end||'9999',sort:'asc'},{id:'tenant',label:'Tenant',key:x=>x.office.company||'No tenant'}]}
  summary={l=>[['Contract value',aed0(sum('value',l))],['Cash received',aed0(sum('received',l))],['Still to collect',aed0(sum('balance',l))]]}/>;
 const label=focus?focusLabel[focus]:filter==='All'?'All lease contracts':filter+' lease contracts';
 const bySeller=new Map<string,number>();for(const x of shown)bySeller.set(seller(x.office.salesEmployeeId)||'No seller',(bySeller.get(seller(x.office.salesEmployeeId)||'No seller')||0)+x.value);
 // The figures box (contract value, invoiced, received, to collect) was removed at the owner's request; the list leads.
 const summary=<>
   {counts.noSeller>0&&<div className="attention"><UserPlus size={20}/><div><b>{counts.noSeller} current lease{counts.noSeller===1?' has':'s have'} no salesperson</b><span>Set Sold by on each lease so commission counts.</span></div><div className="actions attention-actions"><button className="secondary" onClick={()=>pick('noSeller')}>Show them</button></div></div>}</>;
 const list=<section className="surface lc-section"><div className="surface-head lc-head-bar"><h2>{label} <span className="count">{shown.length}</span></h2><div className="lc-tools">{focus?<button type="button" className="chip lc-focus" aria-pressed="true" onClick={()=>setFocus('')}>{focusLabel[focus]}<X size={14}/></button>:<div className="seg" role="group" aria-label="Contract status">{(['Current','Ended','Cancelled','All'] as const).map(s=><button key={s} type="button" aria-pressed={filter===s} onClick={()=>setFilter(s)}>{s}<span className="seg-count">{all.filter(x=>s==='All'||x.status===s).length}</span></button>)}</div>}<div className="search"><Search size={17}/><input aria-label="Search contracts" placeholder="Office, tenant or salesperson…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div></div>
  {shown.length?<div className="lc-list"><div className="lc-row lc-labels" aria-hidden="true"><span>Lease</span><span>Sold by</span><span>Term</span><span>Collected</span><span/></div>
   {shown.map(x=>{const name=seller(x.office.salesEmployeeId),m=meter(x);return <div key={x.key} className="lc-row" onClick={()=>setOpen(x.key)}>
    <span className="lc-office"><span className="lc-icon"><ScrollText size={18}/></span><span className="lc-name"><button type="button" onClick={e=>{e.stopPropagation();setOpen(x.key)}}>{x.office.code}</button><small>{x.office.company||'No tenant'}</small></span>{(filter==='All'&&!focus)&&<span className={pillClass(x)}>{x.status}</span>}</span>
    <span className="lc-seller">{name?<><span className="lc-avatar" aria-hidden="true">{initials(name)}</span><span><b>{name}</b><small>{x.office.dealType||'New'} lease</small></span></>:x.status!=='Cancelled'&&onEditLease?<button type="button" className="lc-set" onClick={e=>{e.stopPropagation();onEditLease(x.office)}}><UserPlus size={15}/>Set seller</button>:<span className="lc-none">No seller</span>}</span>
    <span className="lc-term"><span>{showDate(x.office.start)} <ArrowRight size={13}/> {showDate(x.office.end)}</span><span className="lc-bar time" role="img" aria-label={Math.round(elapsed(x))+'% of the lease term'}><span style={{width:elapsed(x)+'%'}}/></span><small>{x.months} months · {fmt0(x.office.rent)} a {x.office.period==='Monthly'?'month':'year'}</small></span>
    <span className="lc-money"><span><b>{fmt0(x.received)}</b> <small>of {fmt0(x.value)}</small></span><span className={'lc-bar'+(m>=100?' done':'')} role="img" aria-label={Math.round(m)+'% received'}><span style={{width:m+'%'}}/></span><small>{x.balance>0?fmt0(x.balance)+' to collect':'Fully collected'}{x.invoiced>0?' · invoiced '+fmt0(x.invoiced):' · not invoiced'}</small></span>
    <ChevronRight size={18} className="lc-chev"/></div>})}</div>
  :<div className="empty compact"><ScrollText size={34}/><h3>No contracts here</h3><p>{query||focus?'Try another search or filter.':'Use New lease to start a contract.'}</p></div>}</section>;
 if(c)return <LeasePage c={c} seller={seller(c.office.salesEmployeeId)} today={today} canInvoice={canInvoice} canPay={canPay} onBack={()=>setOpen('')} onInvoice={onInvoice} onPayment={onPayment} onEditLease={onEditLease} onOpenOffice={onOpenOffice} onReceive={onReceive} onReplace={onReplace} onUpload={onUpload}/>;
 return <>
  {layout==='board'?modern?analysis:grid:<>{summary}{list}</>}

 </>;
}
