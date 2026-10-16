'use client';
import {useState} from 'react';
import {Plus,ChevronRight,X,Building2,FilePlus2,HandCoins,Briefcase,DoorOpen,Clock3,Ban,Monitor} from 'lucide-react';
import {cashMetrics,type Office,type Payment} from '@/lib/records';
import type {Enquiry} from '@/lib/enquiries';
// Hub: the first page. A grid of tiles (one per action and page, a badge on the ones that need attention), then every
// office on one floor grid (vacant white, occupied grey, reserved amber, inactive hatched). Clicking an office opens its quick actions; a
// vacant office starts the New lease form directly. Each part shows only what the person's role allows.
type State='occupied'|'reserved'|'vacant'|'inactive';
const STATES:[State,string][]=[['occupied','Occupied'],['reserved','Reserved'],['vacant','Vacant'],['inactive','Inactive']];
const ICON:Record<State,React.ElementType>={occupied:Briefcase,reserved:Clock3,vacant:DoorOpen,inactive:Ban};
const stateOf=(o:Office):State=>o.status==='Active'?'occupied':o.status==='Reserved'?'reserved':o.status==='Inactive'?'inactive':'vacant';
// Same rule as the New lease dialog: an office can take a new lease when it has no current tenant and dates.
const canTakeLease=(o:Office)=>!o.leaseClosed&&(!o.company||!o.start);
const n0=(v:number)=>new Intl.NumberFormat('en-AE',{maximumFractionDigits:0}).format(Math.round(v));
const aed=(v:number)=>'AED '+n0(v);
const pct=(part:number,whole:number)=>whole?Math.round(part/whole*100):0;
const SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const day=(iso:string)=>iso?+iso.slice(8,10)+' '+SHORT[+iso.slice(5,7)-1]+' '+iso.slice(0,4):'';
const addDays=(d:string,n:number)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const yearly=(o:Office)=>o.period==='Monthly'?o.rent*12:o.rent;
type Filter='all'|State|'ending';

export type HubPage=[string,string,React.ElementType];
export default function Hub({offices,payments,enquiries,month,asof,branch,showMoney,canCash,canEnquiries,canLeaseEdit,canPay,isExpiring,onOpenOffice,onStartLease,onNewLease,onEditLease,onAddPayment,onGo,pages=[]}:{pages?:HubPage[];
 offices:Office[];payments:Payment[];enquiries:Enquiry[];month:string;asof:string;branch:string;
 showMoney:boolean;canCash:boolean;canEnquiries:boolean;canContracts:boolean;canLeaseEdit:boolean;canPay:boolean;
 isExpiring:(o:Office)=>boolean;onOpenOffice:(id:string)=>void;onStartLease:(o:Office)=>void;onNewLease:()=>void;
 onEditLease:(o:Office)=>void;onAddPayment:(o?:Office)=>void;onGo:(view:string)=>void}){
 const[filter,setFilter]=useState<Filter>('all'),[picked,setPicked]=useState('');
 const physical=offices.filter(o=>o.kind!=='Virtual'),virtual=offices.filter(o=>o.kind==='Virtual');
 const count=(list:Office[],s:State)=>list.filter(o=>stateOf(o)===s).length;
 const occupied=count(physical,'occupied'),vacant=count(physical,'vacant');
 const soon=addDays(asof,60),ending=offices.filter(o=>o.status==='Active'&&o.end&&o.end>=asof&&o.end<=soon).sort((a,b)=>a.end.localeCompare(b.end));
 const desks=physical.reduce((a,o)=>a+(o.desks||0),0),desksTaken=physical.filter(o=>stateOf(o)==='occupied').reduce((a,o)=>a+(o.desks||0),0);
 const m=canCash?cashMetrics(payments,month,asof):null;
 const fresh=enquiries.filter(e=>e.status==='New');
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
 // One tile per action and page; the figure under the label and the badge come from this branch's records.
 type App={id:string;label:string;icon:React.ElementType;sub?:string;badge?:string;onClick:()=>void};
 const sub:Record<string,string|undefined>={offices:occupied+' of '+physical.length+' let',contracts:ending.length?ending.length+' ending in 60 days':'None ending soon',enquiries:enquiries.length+' in the inbox',cash:m&&showMoney?aed(m.cashIn)+' in this month':undefined};
 const badge:Record<string,string|undefined>={enquiries:fresh.length?fresh.length+' new':undefined,cash:m?.overdue?m.overdue+' overdue':undefined,contracts:ending.length?ending.length+' soon':undefined};
 const apps:App[]=[...(canLeaseEdit?[{id:'new-lease',label:'New lease',icon:FilePlus2,sub:vacant?vacant+' vacant '+(vacant===1?'office':'offices'):'No vacant office',onClick:onNewLease}]:[]),
  ...(canPay?[{id:'add-payment',label:'Add payment',icon:HandCoins,sub:m&&showMoney?aed(m.pending)+' pending':undefined,onClick:()=>onAddPayment()}]:[]),
  ...pages.map(([id,label,icon])=>({id,label,icon,sub:sub[id],badge:badge[id],onClick:()=>onGo(id)}))];
 return <div className="hub">


  <section className="surface hub-floor" aria-labelledby="hub-floor-title">
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
  </section>
  <nav className="hub-apps hub-dock" aria-label="Hub">{apps.map(a=>{const Icon=a.icon;return <button key={a.id} type="button" className={'hub-app'+(a.badge?' is-hot':'')} onClick={a.onClick}>
   <span className="hub-app-top"><Icon size={30} strokeWidth={1.6} aria-hidden="true"/>{a.badge&&<span className="hub-badge">{a.badge}</span>}</span>
   <span className="hub-app-label">{a.label}{a.sub&&<small>{a.sub}</small>}</span></button>})}</nav>

 </div>;
}
