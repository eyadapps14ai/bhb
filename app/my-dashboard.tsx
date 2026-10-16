'use client';
import {useState} from 'react';
import {CheckCircle2,Circle,ListTodo,Send,Trash2,CalendarClock,TrendingUp,ScrollText,FileText} from 'lucide-react';
import {toast} from 'sonner';
import {can,type Access} from '@/lib/access';
import type {Office} from '@/lib/records';
import {salesDeals,DealTable,type SalesStaff,type Person} from './admin-panels';
import {MHero} from './modern-kit';
// My dashboard: what one person needs every day. Their to-dos (sent by a manager, with a badge in the menu until done),
// the leases they sold (their sales, not their commission) and the renewals coming up, and their own requests.
// Managers also send to-dos.
export type Task={id:string;assignee:string;assigneeName:string;title:string;details:string;due:string;status:'Open'|'Done';createdBy:string;createdByName:string;created:string;doneAt:string};
const fmt=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:0}).format(n);
const day=(iso:string)=>iso?new Date(iso.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'';
const addDays=(iso:string,n:number)=>new Date(Date.parse(iso+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const daysTo=(from:string,to:string)=>Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/864e5);
const TYPES=['Leave','Salary / advance','Documents','Supplies','Other'];

export function MyDashboard({me,offices,leases,salesStaff,tasks,requests,people=[],today,modern,api,reload,onOpenOffice}:{me:Access;offices:Office[];leases:any[];salesStaff:SalesStaff[];tasks:Task[];requests:any[];people?:Person[];today:string;modern:boolean;api:(path:string,body:any)=>Promise<any>;reload:()=>Promise<void>;onOpenOffice?:(id:string)=>void}){
 const [busy,setBusy]=useState(false),[todo,setTodo]=useState({assignee:'',title:'',details:'',due:''}),[req,setReq]=useState({type:'Other',subject:'',message:''}),[showDone,setShowDone]=useState(false);
 const mine=me.employeeId||'',seller=salesStaff.find(s=>s.id===mine),manager=can(me,'users','edit'),month=today.slice(0,7),year=today.slice(0,4);
 const deals=seller?salesDeals(offices,leases,[seller]).filter(d=>d.sellerId===mine).sort((a,b)=>b.start.localeCompare(a.start)):[];
 const sum=(l:typeof deals,k:'value'|'commission')=>l.reduce((a,d)=>a+d[k],0);
 const renewals=offices.filter(o=>o.salesEmployeeId===mine&&mine&&o.company&&!o.leaseClosed&&o.end&&o.end>=today&&o.end<=addDays(today,90)).sort((a,b)=>a.end.localeCompare(b.end));
 const myTasks=tasks.filter(t=>t.assignee===me.userId).sort((a,b)=>(a.status===b.status?0:a.status==='Open'?-1:1)||(a.due||'9999').localeCompare(b.due||'9999')),open=myTasks.filter(t=>t.status==='Open');
 const sent=manager?tasks.filter(t=>t.assignee!==me.userId).sort((a,b)=>b.created.localeCompare(a.created)):[];
 const run=async(path:string,body:any,done:string)=>{setBusy(true);try{await api(path,body);await reload();toast.success(done);return true}catch(e){toast.error((e as Error).message);return false}finally{setBusy(false)}};
 const thisMonth=deals.filter(d=>d.start.slice(0,7)===month),thisYear=deals.filter(d=>d.start.slice(0,4)===year);
 const figures:[string,string,string][]=[['Sales · '+new Date(month+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'}),fmt(sum(thisMonth,'value')),thisMonth.length+' lease'+(thisMonth.length===1?'':'s')+' starting this month'],
  ['Sales '+year,fmt(sum(thisYear,'value')),thisYear.length+' lease'+(thisYear.length===1?'':'s')],
  ['Renewals in 90 days',String(renewals.length),renewals[0]?'Next: '+renewals[0].code+' on '+day(renewals[0].end):'None coming up'],
  ['Open to-dos',String(open.length),open.length?open.filter(t=>t.due&&t.due<today).length+' overdue':'Nothing waiting']];
 // Not linked to an employee (an owner or manager): the figures are about to-dos instead of sales.
 if(!mine)figures.splice(0,4,['To-dos you sent · open',String(sent.filter(t=>t.status==='Open').length),sent.filter(t=>t.status==='Done').length+' done'],['Sent this month',String(sent.filter(t=>t.created.slice(0,7)===month).length),'To-dos you sent'],['Done this week',String(sent.filter(t=>t.status==='Done'&&t.doneAt&&t.doneAt.slice(0,10)>=addDays(today,-7)).length),'Marked done by the person'],['Open to-dos for you',String(open.length),open.length?open.filter(t=>t.due&&t.due<today).length+' overdue':'Nothing waiting']);
 const taskRow=(t:Task,forMe:boolean)=><li key={t.id} className={'my-task'+(t.status==='Done'?' done':'')+(t.status==='Open'&&t.due&&t.due<today?' late':'')}>
   {forMe?<button type="button" className="my-check" disabled={busy} aria-label={t.status==='Open'?'Mark "'+t.title+'" done':'Reopen "'+t.title+'"'} onClick={()=>run('/api/tasks',{action:'setStatus',id:t.id,status:t.status==='Open'?'Done':'Open'},t.status==='Open'?'Done. Nice work.':'Reopened')}>{t.status==='Done'?<CheckCircle2 size={20}/>:<Circle size={20}/>}</button>:<span className="my-check static">{t.status==='Done'?<CheckCircle2 size={20}/>:<Circle size={20}/>}</span>}
   <span className="my-task-text"><b>{t.title}</b>{t.details&&<small>{t.details}</small>}<small>{forMe?'From '+t.createdByName:'For '+(t.assigneeName||'—')}{t.due?' · due '+day(t.due):''}{t.status==='Done'&&t.doneAt?' · done '+day(t.doneAt):''}</small></span>
   {!forMe&&manager&&<button type="button" className="icon-button secondary" disabled={busy} aria-label={'Delete "'+t.title+'"'} onClick={()=>run('/api/tasks',{action:'delete',id:t.id},'To-do deleted')}><Trash2 size={16}/></button>}
  </li>;
 return <div className="my-dash">
  {modern?<MHero label={figures[0][0]} value={figures[0][1]} text={<>{figures[0][2]}.{!mine&&!manager?' Your login is not linked to an employee record yet, so no leases count for you.':''}</>} stats={figures.slice(1).map(([label,value,sub])=>({label,value,sub}))}/>
   :<div className="tiles">{figures.map(([label,value,sub],i)=><div key={label} className="tile static"><span className="tile-top"><span className="tile-label">{label}</span><span className="tile-icon">{[<TrendingUp key="a" size={16}/>,<ScrollText key="b" size={16}/>,<CalendarClock key="c" size={16}/>,<ListTodo key="d" size={16}/>][i]}</span></span><strong className="tile-value">{value}</strong><span className="tile-sub">{sub}</span></div>)}</div>}
  <div className={"my-grid"+(mine?"":" solo")}>
   <section className="surface my-card" aria-labelledby="my-todos"><div className="my-head"><h2 id="my-todos"><ListTodo size={18}/>My to-dos {open.length>0&&<span className="nav-badge">{open.length}</span>}</h2>{myTasks.some(t=>t.status==='Done')&&<button type="button" className="text-button" onClick={()=>setShowDone(!showDone)}>{showDone?'Hide done':'Show done'}</button>}</div>
    {myTasks.filter(t=>showDone||t.status==='Open').length?<ul className="my-tasks">{myTasks.filter(t=>showDone||t.status==='Open').map(t=>taskRow(t,true))}</ul>:<p className="notes">No to-dos for you right now.</p>}</section>
   {mine&&<section className="surface my-card" aria-labelledby="my-renewals"><div className="my-head"><h2 id="my-renewals"><CalendarClock size={18}/>Renewals coming up</h2><small>Next 90 days</small></div>
    {renewals.length?<ul className="my-list">{renewals.map(o=><li key={o.id}><span><b>{o.code}</b><small>{o.company}</small></span><span className={'pill '+(daysTo(today,o.end)<=30?'danger':'warn')}>{daysTo(today,o.end)} days</span>{onOpenOffice&&<button type="button" className="text-button" onClick={()=>onOpenOffice(o.id)}>Open</button>}</li>)}</ul>:<p className="notes">{mine?'None of your leases ends in the next 90 days.':'Link your login to your employee record to see your leases.'}</p>}</section>}
   {mine&&<section className="surface my-card" aria-labelledby="my-requests"><div className="my-head"><h2 id="my-requests"><FileText size={18}/>My requests</h2><small>{requests.filter(r=>r.status!=='Closed').length} open</small></div>
    {requests.length?<ul className="my-list">{[...requests].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,5).map(r=><li key={r.id}><span><b>{r.subject}</b><small>{r.type} · {day(r.created)}</small></span><span className={'pill '+(r.decision==='Approved'?'good':r.decision==='Rejected'?'danger':'neutral')}>{r.decision||(r.status==='Closed'?'Closed':'Waiting')}</span></li>)}</ul>:<p className="notes">You have not sent a request yet.</p>}
    {mine&&<form className="my-form" onSubmit={async e=>{e.preventDefault();if(await run('/api/employee-requests',{employeeId:mine,employee:me.name,email:me.email,branch:me.branches[0]||'BHB',...req},'Request sent'))setReq({type:'Other',subject:'',message:''})}}>
     <div className="my-form-row"><select aria-label="Request type" value={req.type} onChange={e=>setReq({...req,type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select><input aria-label="Request subject" required placeholder="Subject" value={req.subject} onChange={e=>setReq({...req,subject:e.target.value})}/></div>
     <textarea aria-label="Request details" required placeholder="Details" value={req.message} onChange={e=>setReq({...req,message:e.target.value})}/><button className="secondary" disabled={busy}><Send size={16}/>Send request</button></form>}</section>}
  </div>
  {manager&&<section className="surface my-card my-send" aria-labelledby="my-send"><div className="my-head"><h2 id="my-send"><Send size={18}/>Send a to-do</h2><small>It shows on that person's My dashboard with a badge until they mark it done.</small></div>
   <form className="my-form" onSubmit={async e=>{e.preventDefault();if(await run('/api/tasks',{action:'create',...todo},'To-do sent'))setTodo({assignee:todo.assignee,title:'',details:'',due:''})}}>
    <div className="my-form-row"><select aria-label="To-do for" required value={todo.assignee} onChange={e=>setTodo({...todo,assignee:e.target.value})}><option value="">Who is it for?</option>{people.filter(p=>p.active&&p.id!==me.userId).map(p=><option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}</select><input aria-label="To-do title" required placeholder="What needs doing" value={todo.title} onChange={e=>setTodo({...todo,title:e.target.value})}/><input aria-label="Due date" type="date" value={todo.due} onChange={e=>setTodo({...todo,due:e.target.value})}/></div>
    <textarea aria-label="To-do details" placeholder="Details (optional)" value={todo.details} onChange={e=>setTodo({...todo,details:e.target.value})}/><button className="primary" disabled={busy}><Send size={16}/>Send to-do</button></form>
   {sent.length>0&&<><h3 className="section-label">Sent <span className="count">{sent.filter(t=>t.status==='Open').length} open</span></h3><ul className="my-tasks">{sent.slice(0,20).map(t=>taskRow(t,false))}</ul></>}</section>}
  {(mine||!manager)&&<section className="surface my-card" aria-labelledby="my-contracts"><div className="my-head"><h2 id="my-contracts"><ScrollText size={18}/>My contracts <span className="count">{deals.length}</span></h2><small>Contract value: rent over each lease, excl. VAT</small></div>
   {deals.length?<DealTable deals={deals} hideCommission/>:<p className="notes">{mine?'No leases with you as Sold by yet.':'Your login is not linked to an employee record yet. Ask an admin to link it in Users & roles.'}</p>}</section>}
 </div>;
}
