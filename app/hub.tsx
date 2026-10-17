'use client';
import {useState} from 'react';
import {Plus,ChevronLeft,ChevronRight,X,Building2,Briefcase,DoorOpen,Clock3,Ban,Monitor,Wallet,ScrollText,Handshake,BadgePercent} from 'lucide-react';
import {cashMetrics,type Office,type Payment} from '@/lib/records';
import {contractValue} from '@/lib/access';
import type {Deal,SalesStaff} from './admin-panels';
// Dashboard (the only dashboard; it took over the Hub and My dashboard): the month at a glance (cash flow, leases
// closed, deals closed, occupancy) and each salesperson's results, then the person's own part (middle: to-dos,
// renewals, requests, contracts), then every office on one floor grid (vacant white, occupied grey, reserved amber,
// inactive hatched). Clicking an office opens its quick actions. Each part shows only what the person's role allows.
type State='occupied'|'reserved'|'vacant'|'inactive';
const STATES:[State,string][]=[['occupied','Occupied'],['reserved','Reserved'],['vacant','Vacant'],['inactive','Inactive']];
const ICON:Record<State,React.ElementType>={occupied:Briefcase,reserved:Clock3,vacant:DoorOpen,inactive:Ban};
const stateOf=(o:Office):State=>o.status==='Active'?'occupied':o.status==='Reserved'?'reserved':o.status==='Inactive'?'inactive':'vacant';
// Same rule as the New lease dialog: an office can take a new lease when it has no current tenant and dates.
const canTakeLease=(o:Office)=>!o.leaseClosed&&(!o.company||!o.start);
const n0=(v:number)=>new Intl.NumberFormat('en-AE',{maximumFractionDigits:0}).format(Math.round(v));
const aed=(v:number)=>'AED '+n0(v);
const pct=(part:number,whole:number)=>whole?Math.round(part/whole*100):0;
const SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],LONG=['January','February','March','April','May','June','July','August','September','October','November','December'];
const day=(iso:string)=>iso?+iso.slice(8,10)+' '+SHORT[+iso.slice(5,7)-1]+' '+iso.slice(0,4):'';
const addDays=(d:string,n:number)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const yearly=(o:Office)=>o.period==='Monthly'?o.rent*12:o.rent;
const shiftMonth=(m:string,n:number)=>{const d=new Date(m+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7)};
type Filter='all'|State|'ending';

export default function Hub({offices,payments,deals,staff,teamOf=null,showMonth=true,showFloor=true,middle,month,onMonth,asof,branch,showMoney,canCash,canContracts,canSales,showCommission,canLeaseEdit,canPay,isExpiring,onOpenOffice,onStartLease,onEditLease,onAddPayment,onGo}:{
 offices:Office[];payments:Payment[];deals:Deal[];staff:SalesStaff[];teamOf?:string|null;showMonth?:boolean;showFloor?:boolean;middle?:React.ReactNode;month:string;onMonth?:(month:string)=>void;asof:string;branch:string;
 showMoney:boolean;canCash:boolean;canContracts:boolean;canSales:boolean;showCommission:boolean;canLeaseEdit:boolean;canPay:boolean;
 isExpiring:(o:Office)=>boolean;onOpenOffice:(id:string)=>void;onStartLease:(o:Office)=>void;
 onEditLease:(o:Office)=>void;onAddPayment:(o?:Office)=>void;onGo:(view:string)=>void}){
 const[filter,setFilter]=useState<Filter>('all'),[picked,setPicked]=useState(''),[allSellers,setAllSellers]=useState(false);
 const physical=offices.filter(o=>o.kind!=='Virtual'),virtual=offices.filter(o=>o.kind==='Virtual');
 const count=(list:Office[],s:State)=>list.filter(o=>stateOf(o)===s).length;
 const occupied=count(physical,'occupied'),vacant=count(physical,'vacant');
 const soon=addDays(asof,60),ending=offices.filter(o=>o.status==='Active'&&o.end&&o.end>=asof&&o.end<=soon).sort((a,b)=>a.end.localeCompare(b.end));
 const desks=physical.reduce((a,o)=>a+(o.desks||0),0),desksTaken=physical.filter(o=>stateOf(o)==='occupied').reduce((a,o)=>a+(o.desks||0),0);
 const m=canCash?cashMetrics(payments,month,asof):null;
 const shown=(o:Office)=>filter==='all'||(filter==='ending'?isExpiring(o):stateOf(o)===filter);
 const groups=[...new Map(physical.sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true})).map(o=>[o.location?.trim()||'No location set',[] as Office[]])).keys()]
  .sort((a,b)=>a==='No location set'?1:b==='No location set'?-1:a.localeCompare(b,undefined,{numeric:true}))
  .map(name=>[name,physical.filter(o=>(o.location?.trim()||'No location set')===name)] as [string,Office[]]);
 if(virtual.length)groups.push(['Virtual offices',[...virtual].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}))]);
 const sel=offices.find(o=>o.id===picked);
 const pickPanel=sel&&<aside className="hub-pick" aria-label={'Office '+sel.code}>
   <header><div><h2>{sel.code}</h2><small>{[sel.kind,sel.location,STATES.find(([s])=>s===stateOf(sel))![1]].filter(Boolean).join(' · ')}</small></div><button type="button" className="icon-close" aria-label="Close" onClick={()=>setPicked('')}><X size={18}/></button></header>
   {stateOf(sel)==='occupied'?<dl><dt>Tenant</dt><dd>{sel.company||'Not set'}</dd><dt>Lease</dt><dd>{sel.start?day(sel.start)+' to '+day(sel.end):'No dates'}</dd>{showMoney&&<><dt>Rent</dt><dd>{aed(yearly(sel))} a year</dd></>}{sel.licenseExpiry&&<><dt>Licence expires</dt><dd>{day(sel.licenseExpiry)}</dd></>}</dl>
   :<p className="notes">{stateOf(sel)==='reserved'?'Reserved, not let yet.':stateOf(sel)==='inactive'?'Not in use.':'Vacant and ready to let.'}{sel.desks?' '+sel.desks+' desks.':''}{sel.area?' '+sel.area+' sq ft.':''}</p>}
   <div className="hub-actions">
    {canLeaseEdit&&canTakeLease(sel)&&stateOf(sel)!=='inactive'&&<button type="button" className="primary" onClick={()=>onStartLease(sel)}><Plus size={16}/>Start lease</button>}
    {canPay&&stateOf(sel)==='occupied'&&<button type="button" className="primary" onClick={()=>onAddPayment(sel)}><Plus size={16}/>Add payment</button>}
    {canLeaseEdit&&stateOf(sel)==='occupied'&&<button type="button" className="secondary" onClick={()=>onEditLease(sel)}>Edit lease</button>}
    <button type="button" className="secondary" onClick={()=>onOpenOffice(sel.id)}>Open office<ChevronRight size={16}/></button>
   </div>
  </aside>;
 const tip=(o:Office)=>[o.code,STATES.find(([s])=>s===stateOf(o))![1],o.company,o.end&&'Lease ends '+day(o.end),showMoney&&o.rent?aed(yearly(o))+' a year':'',o.area?o.area+' sq ft':'',o.desks?o.desks+' desks':''].filter(Boolean).join(' · ');
 // This month: leases that start in the month (current ones, as on Lease contracts), the deals of salespeople among them,
 // and each salesperson's results. Commission only for those allowed to see every salesperson's commission.
 const label=LONG[+month.slice(5,7)-1]+' '+month.slice(0,4),thisMonth=asof.slice(0,7)===month;
 const closed=offices.filter(o=>o.company&&o.start&&!o.leaseClosed&&o.start.slice(0,7)===month),closedValue=closed.reduce((a,o)=>a+contractValue(o).value,0);
 const won=deals.filter(d=>d.status==='Current'&&d.start.slice(0,7)===month),renewals=won.filter(d=>d.dealType==='Renewal').length;
 // Without "see every commission" (teamOf set) only the person's own line shows, as on the Sales commission page.
 const sellers=staff.filter(t=>(teamOf===null||t.id===teamOf)&&(t.active||won.some(d=>d.sellerId===t.id))).map(t=>{const mine=won.filter(d=>d.sellerId===t.id);return {id:t.id,name:t.name,deals:mine.length,renewals:mine.filter(d=>d.dealType==='Renewal').length,value:mine.reduce((a,d)=>a+d.value,0),commission:mine.reduce((a,d)=>a+d.commission,0)}}).sort((a,b)=>b.value-a.value||b.deals-a.deals||a.name.localeCompare(b.name));
 // The six best first; people without a deal this month are counted in one line unless the list is opened.
 const withDeals=sellers.filter(x=>x.deals),idle=sellers.length-withDeals.length,list=allSellers?sellers:(withDeals.length?withDeals:sellers).slice(0,6),more=allSellers?0:sellers.length-list.length;
 const top=Math.max(1,...sellers.map(x=>x.value)),initials=(n:string)=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
 type Kpi={id:string;label:string;value:string;sub:string;icon:React.ElementType;tone?:string;go?:()=>void};
 const kpis:Kpi[]=[...(m&&showMoney?[{id:'cash',label:'Cash flow',value:(m.net<0?'−':'')+aed(Math.abs(m.net)),sub:'In '+aed(m.cashIn)+' · out '+aed(m.cashOut),icon:Wallet,tone:m.net<0?'is-neg':'is-pos',go:()=>onGo('cash')}]:[]),
  {id:'leases',label:'Leases closed',value:showMoney?aed(closedValue):n0(closed.length),sub:showMoney?closed.length+' '+(closed.length===1?'lease':'leases')+', contract value':'Leases starting this month',icon:ScrollText,go:canContracts?()=>onGo('contracts'):undefined},
  {id:'deals',label:'Deals closed',value:n0(won.length),sub:won.length?(won.length-renewals)+' new · '+renewals+' '+(renewals===1?'renewal':'renewals'):'No deals yet',icon:Handshake,go:canSales?()=>onGo('sales'):canContracts?()=>onGo('contracts'):undefined},
  {id:'let',label:'Offices let',value:pct(occupied,physical.length)+'%',sub:vacant+' vacant · '+occupied+' occupied',icon:Building2,go:()=>{setFilter(vacant?'vacant':'all');document.getElementById('hub-floor-title')?.scrollIntoView({behavior:'smooth',block:'start'})}}];
 return <div className="hub">
  {showMonth&&<section className="surface dash-month" aria-labelledby="dash-month-title"><div className="hub-floor-head"><div><h2 id="dash-month-title">{thisMonth?'This month':'Month'} · {label}</h2><span className="hub-occ-line">{branch}{thisMonth||onMonth?'':' · change the month in Cash flow'}</span></div>
    {onMonth&&<div className="dash-month-nav" role="group" aria-label="Month shown"><button type="button" className="icon-close" aria-label="Previous month" onClick={()=>onMonth(shiftMonth(month,-1))}><ChevronLeft size={18}/></button><input type="month" aria-label="Month" value={month} onChange={e=>e.target.value&&onMonth(e.target.value)}/><button type="button" className="icon-close" aria-label="Next month" onClick={()=>onMonth(shiftMonth(month,1))}><ChevronRight size={18}/></button>{!thisMonth&&<button type="button" className="text-button" onClick={()=>onMonth(asof.slice(0,7))}>This month</button>}</div>}</div>
   <div className="dash-kpis">{kpis.map(k=>{const Icon=k.icon,body=<><span className="dash-kpi-top"><span>{k.label}</span><Icon size={18} aria-hidden="true"/></span><b className={k.tone}>{k.value}</b><small>{k.sub}</small></>;return k.go?<button key={k.id} type="button" className="dash-kpi" onClick={k.go}>{body}</button>:<div key={k.id} className="dash-kpi">{body}</div>})}</div>
   {canSales&&<div className="dash-sales"><h3><BadgePercent size={16} aria-hidden="true"/>{teamOf===null?'Sales team':'Your sales'} · {label}</h3>{sellers.length?<><ol className="dash-sellers">{list.map((x,i)=><li key={x.id}><span className="dash-rank">{i+1}</span><span className="dash-avatar" aria-hidden="true">{initials(x.name)}</span><span className="dash-who"><b>{x.name}</b><small>{x.deals?x.deals+' '+(x.deals===1?'deal':'deals')+(x.renewals?' · '+x.renewals+' renewal'+(x.renewals===1?'':'s'):''):'No deals yet'}</small></span><span className="dash-bar" aria-hidden="true"><i style={{width:Math.round(x.value/top*100)+'%'}}/></span><span className="dash-amt"><b>{aed(x.value)}</b>{showCommission&&<small>Commission {aed(x.commission)}</small>}</span></li>)}</ol>{(more>0||allSellers)&&<p className="dash-more">{more>0&&<span>{withDeals.length&&idle&&withDeals.length<=6?idle+' more with no deal yet this month.':more+' more.'}</span>}<button type="button" className="text-button" onClick={()=>setAllSellers(!allSellers)}>{allSellers?'Show fewer':'Show all '+sellers.length}</button></p>}</>:<p className="notes">{teamOf===null?'No Sales employees yet. Add them in Employees with Job: Sales.':teamOf?'No deals for you this month yet.':'Your login is not linked to a Sales employee, so your own results cannot show here.'}</p>}</div>}
  </section>}
  {middle}
  {showFloor&&<section className="surface hub-floor" aria-labelledby="hub-floor-title">
   <div className="hub-floor-head"><div><h2 id="hub-floor-title">Offices · {branch}</h2><span className="hub-occ-line"><b>{pct(occupied,physical.length)}%</b> of {physical.length} physical offices let{desks>0&&<> · {n0(desksTaken)} of {n0(desks)} desks</>}</span></div>
    <div className="chip-set" role="group" aria-label="Show offices">{([['all','All'],...STATES.slice(0,3),['ending','Ending soon']] as [Filter,string][]).map(([f,l])=><button key={f} type="button" className="chip" aria-pressed={filter===f} onClick={()=>setFilter(f)}>{l}</button>)}</div>
   </div>
   {physical.length>0&&<div className="hub-bar" role="img" aria-label={STATES.map(([s,l])=>l+' '+count(physical,s)).join(', ')}>{STATES.filter(([s])=>count(physical,s)>0).map(([s,l])=>{const c=count(physical,s);return <button key={s} type="button" className={'hub-seg is-'+s} style={{flexGrow:c}} title={l+': '+c+' ('+pct(c,physical.length)+'%)'} aria-label={'Show '+l.toLowerCase()+' offices'} onClick={()=>setFilter(filter===s?'all':s)}/>})}</div>}
   {groups.length?groups.map(([name,list])=>{const vis=list.filter(shown);return vis.length?<div key={name} className="hub-group"><h3>{name}<small>{count(list,'occupied')} of {list.length} let</small></h3>
    <div className="hub-grid">{vis.map(o=>{const s=stateOf(o),warn=isExpiring(o);return <button key={o.id} type="button" className={'hub-room is-'+s+(warn?' is-warn':'')+(o.kind==='Virtual'?' is-virtual':'')+(picked===o.id?' is-picked':'')} title={tip(o)} aria-label={tip(o)} aria-pressed={picked===o.id} onClick={()=>setPicked(picked===o.id?'':o.id)}>
     <span className="hub-room-top"><b>{o.code}</b>{(()=>{const I=o.kind==='Virtual'?Monitor:ICON[s];return <I size={16} strokeWidth={1.8} aria-hidden="true"/>})()}</span><span>{s==='occupied'?o.company||'Occupied':STATES.find(([x])=>x===s)![1]}</span>{warn&&<small>{o.end&&o.end<=addDays(asof,30)?'Ends '+day(o.end):'Licence expiring'}</small>}
    </button>})}</div>{sel&&list.includes(sel)&&pickPanel}</div>:null}):<div className="empty compact"><Building2 size={34}/><h3>No offices yet</h3><p>Add the first office with New lease, then New office.</p></div>}
   {groups.length>0&&groups.every(([,list])=>!list.some(shown))&&<p className="notes">No offices match this filter.</p>}
   <ul className="hub-legend hub-legend-grid" aria-label="Colour key">{STATES.map(([s,l])=>{const I=ICON[s];return <li key={s}><span className={'hub-swatch is-'+s}/><I size={14} aria-hidden="true"/>{l}</li>})}<li><Monitor size={14} aria-hidden="true"/>Virtual</li><li><span className="hub-swatch is-occupied is-warn"/>Lease or licence ends within 30 days</li></ul>
  </section>}


 </div>;
}
