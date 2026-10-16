'use client';
import {paymentTotal,type Office,type Payment} from '@/lib/records';
import {GroupedTable,type Column} from './board';
// Analytical layout for the office portfolio: the office list as one grouped table with yearly rent,
// deposits and income still to collect.
const whole=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:0}).format(n);
const showDate=(s:string)=>s?new Date(s+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
const monthOf=(s:string)=>s?new Date(s.slice(0,7)+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}):'No lease end';
const days=(from:string,to:string)=>Math.round((Date.parse(to)-Date.parse(from))/864e5);
const plural=(n:number,word:string)=>n+' '+word+(n===1?'':'s');
const yearly=(o:Office)=>o.period==='Monthly'?o.rent*12:o.rent;
const tone=(s:string)=>s==='Active'?'good':s==='Reserved'?'warn':s==='Inactive'?'neutral':'neutral';
function leaseNote(o:Office,asof:string):[string,string]{
 if(!o.end)return [o.status==='Available'?'Available':'No lease dates','neutral'];
 const d=days(asof,o.end);return d<0?['Lease ended '+showDate(o.end),'danger']:d<=30?['Lease ends in '+plural(d,'day'),'danger']:d<=90?['Lease ends in '+plural(d,'day'),'warn']:['Lease to '+showDate(o.end),'good'];
}
export default function OfficeBoard({offices,payments,asof,isExpiring,isMissing,onOpen}:{offices:Office[];payments:Payment[];asof:string;isExpiring:(o:Office)=>boolean;isMissing:(o:Office)=>boolean;onOpen:(id:string)=>void}){
 const pending=(o:Office)=>payments.filter(p=>p.officeId===o.id&&p.direction==='Income'&&['Pending','Bounced'].includes(p.status)).reduce((a,p)=>a+paymentTotal(p),0);
 const columns:Column<Office>[]=[
  {id:'office',label:'Office',cell:o=><><strong>{o.code}</strong><small>{o.company||o.contact||'No tenant'} · {o.kind}</small></>},
  {id:'status',label:'Status',cell:o=><span className={'pill '+(isExpiring(o)?'danger':tone(o.status))}>{isExpiring(o)?'Expiring':o.status}</span>},
  {id:'lease',label:'Lease',cell:o=>{const [n,t]=leaseNote(o,asof);return o.start||o.end?<>{showDate(o.start)} – {showDate(o.end)}<small className={t==='danger'?'late':undefined}>{n}</small></>:'—'}},
  {id:'licence',label:'Licence',cell:o=>o.licenseNumber?<>{o.licenseNumber}<small className={o.licenseExpiry&&o.licenseExpiry<asof?'late':undefined}>{o.licenseExpiry?'Expires '+showDate(o.licenseExpiry):'No expiry date'}</small></>:<span className={o.status==='Active'?'late':undefined}>Missing</span>},
  {id:'rent',label:'Rent / year',numeric:true,highlight:true,cell:o=>whole(yearly(o)),total:l=>whole(l.reduce((a,o)=>a+yearly(o),0))},
  {id:'deposit',label:'Deposit',numeric:true,cell:o=>whole(o.deposit),total:l=>whole(l.reduce((a,o)=>a+o.deposit,0))},
  {id:'pending',label:'To collect',numeric:true,cell:o=>{const n=pending(o);return n?whole(n):'—'},total:l=>whole(l.reduce((a,o)=>a+pending(o),0))},
  {id:'open',label:'',cell:o=><button type="button" className="text-button" onClick={()=>onOpen(o.id)}>Open</button>},
 ];
 const rows=[...offices].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
 return <div className="office-board">
  <GroupedTable title="Offices" rows={rows} rowKey={o=>o.id} columns={columns} search={o=>[o.code,o.company,o.contact,o.licenseNumber,o.location,o.leaseReference,o.services].join(' ')} initialGroups={['status']} empty="Add your first office to see it here."
   filters={[{id:'all',label:'All',test:()=>true},{id:'physical',label:'Physical',test:o=>o.kind==='Physical'},{id:'virtual',label:'Virtual',test:o=>o.kind==='Virtual'},{id:'expiring',label:'Expiring',test:isExpiring},{id:'missing',label:'Missing documents',test:isMissing},{id:'collect',label:'To collect',test:o=>pending(o)>0}]}
   groupings={[{id:'status',label:'Status',key:o=>o.status},{id:'kind',label:'Type',key:o=>o.kind+' offices'},{id:'end',label:'Lease ends',key:o=>monthOf(o.end)},{id:'period',label:'Rent period',key:o=>o.period}]}/>
 </div>;
}
