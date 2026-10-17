'use client';
import {useState} from 'react';
import {Inbox,Check,X,ChevronRight} from 'lucide-react';
import {toast} from 'sonner';
// Employee requests on the Dashboard: what staff are waiting for (leave, advances, documents, supplies), the longest
// waiting first, with Approve and Reject for people who may answer, and a link to the full list in Employees > Requests.
type Request={id:string;employee:string;branch:string;type:string;subject:string;message?:string;status:string;decision?:string;created:string};
// Dates in Dubai time: a request sent at 01:00 in Dubai is still 'today' there although UTC is the day before.
const dubai=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const ago=(today:string,iso:string)=>{const n=Math.max(0,Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(dubai(iso)+'T00:00:00Z'))/864e5));return n===0?'today':n===1?'yesterday':n+' days ago'};
export default function RequestsCard({requests,today,canAnswer,api,reload,onOpen}:{requests:Request[];today:string;canAnswer:boolean;api:(path:string,body:unknown)=>Promise<unknown>;reload:()=>Promise<void>;onOpen:()=>void}){
 const [busy,setBusy]=useState(''),[all,setAll]=useState(false);
 const waiting=requests.filter(r=>r.status!=='Closed'&&!r.decision).sort((a,b)=>a.created.localeCompare(b.created));
 const answered=requests.filter(r=>r.status!=='Closed'&&r.decision).length,shown=all?waiting:waiting.slice(0,5);
 const answer=async(r:Request,decision:'Approved'|'Rejected')=>{setBusy(r.id);try{await api('/api/employee-requests',{action:'review',id:r.id,decision,notes:''});await reload();toast.success(decision+': '+r.employee+', '+r.subject)}catch(e){toast.error((e as Error).message)}finally{setBusy('')}};
 return <section className="surface my-card dash-requests" aria-labelledby="dash-requests-title">
  <div className="my-head"><h2 id="dash-requests-title"><Inbox size={18}/>Employee requests {waiting.length>0&&<span className="nav-badge">{waiting.length}</span>}</h2><button type="button" className="text-button" onClick={onOpen}>All requests<ChevronRight size={16}/></button></div>
  {waiting.length?<ul className="my-list dash-req-list">{shown.map(r=><li key={r.id}>
    <span><b>{r.employee} · {r.subject}</b><small>{r.type} · {r.branch} · {ago(today,r.created)}</small>{r.message&&<small className="dash-req-msg">{r.message}</small>}</span>
    {canAnswer?<span className="dash-req-actions"><button type="button" className="secondary" disabled={!!busy} aria-label={'Approve '+r.employee+': '+r.subject} onClick={()=>answer(r,'Approved')}><Check size={15}/>Approve</button><button type="button" className="secondary" disabled={!!busy} aria-label={'Reject '+r.employee+': '+r.subject} onClick={()=>answer(r,'Rejected')}><X size={15}/>Reject</button></span>:<span className="pill warn">Waiting</span>}
   </li>)}</ul>:<p className="notes">No requests waiting for an answer.{answered?' '+answered+' answered and still open.':''}</p>}
  {waiting.length>5&&<button type="button" className="text-button" onClick={()=>setAll(!all)}>{all?'Show fewer':'Show all '+waiting.length}</button>}
 </section>;
}
