'use client';
import {useState} from 'react';
import {Plus,Receipt,CalendarCheck,Pencil,Search,X} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {paymentTotal,type Office,type Payment} from '@/lib/records';
// Cash flow > Expenses: what was paid this month and what is still to pay, by category, with one clear "Add expense".
// The Add expense form is short: category (or a new one), amount, paid to, paid or not yet, how. Editing an expense
// later uses the full payment form.
const fmt=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:2}).format(n);
const fmt0=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:0}).format(n);
const LONG=['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthName=(m:string)=>LONG[+m.slice(5,7)-1]+' '+m.slice(0,4);
const day=(s:string)=>s?new Date(s.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
const addDays=(d:string,n:number)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const METHODS:[string,string][]=[['Cash','Cash'],['Transfer','Bank transfer'],['Check','Cheque']];
const sum=(l:Payment[])=>l.reduce((a,p)=>a+paymentTotal(p),0);
type Show='month'|'unpaid'|'all';

export function ExpensesPanel({payments,offices,month,setMonth,asof,canEdit,onAdd,onEdit,onPaid}:{payments:Payment[];offices:Office[];month:string;setMonth:(m:string)=>void;asof:string;canEdit:boolean;onAdd:()=>void;onEdit:(p:Payment)=>void;onPaid:(p:Payment,date:string)=>Promise<void>}){
 const [show,setShow]=useState<Show>('month'),[cat,setCat]=useState(''),[q,setQ]=useState(''),[paying,setPaying]=useState(''),[payDate,setPayDate]=useState(asof),[busy,setBusy]=useState(false);
 const out=payments.filter(p=>p.direction==='Expense'&&p.status!=='Cancelled'),catOf=(p:Payment)=>p.category||'Other',when=(p:Payment)=>(p.status==='Paid'?p.actual:p.due)||'';
 const paid=out.filter(p=>p.status==='Paid'&&(p.actual||'').slice(0,7)===month),unpaid=out.filter(p=>p.status==='Unpaid');
 const overdue=unpaid.filter(p=>p.due<asof),soon=unpaid.filter(p=>p.due>=asof&&p.due<addDays(asof,30)),total=sum(paid);
 const byCat=[...new Set(paid.map(catOf))].map(c=>{const l=paid.filter(p=>catOf(p)===c);return {c,v:sum(l),n:l.length}}).sort((a,b)=>b.v-a.v),top=Math.max(1,...byCat.map(x=>x.v));
 const code=(id:string|null)=>id?offices.find(o=>o.id===id)?.code||'':'';
 const list=out.filter(p=>show==='all'||(show==='unpaid'?p.status==='Unpaid':when(p).slice(0,7)===month)).filter(p=>!cat||catOf(p)===cat)
  .filter(p=>!q.trim()||[p.party,p.description,p.reference,catOf(p),p.notes].join(' ').toLowerCase().includes(q.trim().toLowerCase())).sort((a,b)=>when(b).localeCompare(when(a)));
 const figs:[string,string,string,Show,string?][]=[['Paid in '+LONG[+month.slice(5,7)-1],fmt0(total),paid.length+' '+(paid.length===1?'payment':'payments'),'month'],['Not paid yet',fmt0(sum(unpaid)),unpaid.length+' open','unpaid'],['Overdue',fmt0(sum(overdue)),overdue.length?overdue.length+' past the due date':'Nothing overdue','unpaid',overdue.length?'is-neg':undefined],['Due in 30 days',fmt0(sum(soon)),soon.length+' to pay','unpaid']];
 return <div className="expenses">
  <section className="surface exp-hero" aria-labelledby="exp-title"><div className="exp-hero-head"><div><h2 id="exp-title">Expenses · {monthName(month)}</h2><p>Money paid out: salaries, rent, bills, supplies and anything else.</p></div>
   <div className="exp-hero-actions"><label className="exp-month"><span>Month</span><input type="month" aria-label="Expenses month" value={month} onChange={e=>e.target.value&&setMonth(e.target.value)}/></label>{canEdit&&<button type="button" className="primary exp-add" onClick={onAdd}><Plus size={18}/>Add expense</button>}</div></div>
   <div className="dash-kpis exp-figs">{figs.map(([k,v,sub,s,tone])=><button type="button" key={k} className="dash-kpi" onClick={()=>{setShow(s);setCat('')}}><span className="dash-kpi-top"><span>{k}</span></span><b className={tone}>{v}</b><small>{sub}</small></button>)}</div></section>
  <section className="surface exp-cats" aria-labelledby="exp-cats-title"><div className="surface-head"><h2 id="exp-cats-title">By category · {monthName(month)}</h2>{cat&&<button type="button" className="text-button" onClick={()=>setCat('')}>Show every category</button>}</div>
   {byCat.length?<ul>{byCat.map(x=><li key={x.c}><button type="button" aria-pressed={cat===x.c} title={'Show '+x.c+' expenses'} onClick={()=>{setCat(cat===x.c?'':x.c);setShow('month')}}><span className="exp-cat-name"><b>{x.c}</b><small>{x.n} paid · {Math.round(x.v/(total||1)*100)}%</small></span><span className="dash-bar" aria-hidden="true"><i style={{width:Math.round(x.v/top*100)+'%'}}/></span><b className="exp-cat-amt">{fmt0(x.v)}</b></button></li>)}</ul>
   :<p className="notes exp-none">No expenses paid in {monthName(month)} yet.</p>}</section>
  <section className="surface" aria-labelledby="exp-list-title"><div className="surface-head exp-list-head"><h2 id="exp-list-title">{show==='unpaid'?'Not paid yet':show==='all'?'All expenses':'Expenses in '+monthName(month)}{cat?' · '+cat:''} <span className="count">{list.length}</span></h2>
   <div className="exp-filters"><div className="chip-set" role="group" aria-label="Show expenses">{([['month',LONG[+month.slice(5,7)-1]],['unpaid','Not paid yet'],['all','All']] as [Show,string][]).map(([s,l])=><button key={s} type="button" className="chip" aria-pressed={show===s} onClick={()=>setShow(s)}>{l}</button>)}{cat&&<button type="button" className="chip" aria-pressed="true" onClick={()=>setCat('')}>{cat}<X size={13} aria-label="Remove category filter"/></button>}</div>
    <label className="exp-search"><Search size={15} aria-hidden="true"/><input type="search" aria-label="Search expenses" placeholder="Search" value={q} onChange={e=>setQ(e.target.value)}/></label></div></div>
   {list.length?<div className="exp-list">{list.map(p=>{const late=p.status==='Unpaid'&&p.due<asof;return <div key={p.id} className="exp-row">
    <div className="exp-main"><strong>{p.party}</strong><small>{[catOf(p),p.description,METHODS.find(([m])=>m===p.method)?.[1],code(p.officeId),p.branch].filter(Boolean).join(' · ')}</small></div>
    <div className="exp-side"><b className="exp-amt">{fmt(paymentTotal(p))}</b><span className="exp-tags"><span className={'badge '+(p.status==='Paid'?'good':late?'danger':'warn')}>{p.status==='Paid'?'Paid '+day(p.actual):(late?'Overdue · due ':'Due ')+day(p.due)}</span></span></div>
    {canEdit&&<div className="exp-act">{p.status==='Unpaid'&&(paying===p.id?<span className="lp-receive"><input type="date" aria-label={'Date paid for '+p.party} value={payDate} max={asof} onChange={e=>setPayDate(e.target.value)}/><button type="button" className="primary" disabled={busy||!payDate} onClick={async()=>{setBusy(true);try{await onPaid(p,payDate);setPaying('')}finally{setBusy(false)}}}>{busy?'Saving…':'Save'}</button><button type="button" className="text-button" onClick={()=>setPaying('')}>Cancel</button></span>
     :<button type="button" className="secondary" onClick={()=>{setPayDate(asof);setPaying(p.id)}}><CalendarCheck size={15}/>Mark paid</button>)}<button type="button" className="text-button" onClick={()=>onEdit(p)}><Pencil size={14}/>Edit</button></div>}
   </div>})}</div>
   :<div className="empty compact"><Receipt size={34}/><h3>No expenses here</h3><p>{show==='unpaid'?'Everything is paid.':'Nothing recorded for this view yet.'}</p>{canEdit&&<button type="button" className="primary" onClick={onAdd}><Plus size={16}/>Add expense</button>}</div>}</section>
 </div>;
}

type Draft={category:string;newCat:string;adding:boolean;amount:string;party:string;description:string;paid:boolean;date:string;method:string;branch:string;ref:string};
export type ExpenseBody={direction:'Expense';branch:string;officeId:null;reference:string;party:string;method:string;category:string;description:string;entryDate:string;due:string;actual:string;status:'Paid'|'Unpaid';amount:number;vatAmount:0;securityDeposit:0;incomeType:'Rent';bankName:string;notes:string};
export function ExpenseDialog({open,onClose,categories,branches,homeBranch,today,onSave}:{open:boolean;onClose:()=>void;categories:string[];branches:string[]|null;homeBranch:string;today:string;onSave:(body:ExpenseBody)=>Promise<void>}){
 const blank=():Draft=>({category:'',newCat:'',adding:false,amount:'',party:'',description:'',paid:true,date:today,method:'Cash',branch:homeBranch,ref:''});
 const [f,setF]=useState<Draft>(blank),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const set=(x:Partial<Draft>)=>setF({...f,...x}),close=()=>{setF(blank());setError('');onClose()};
 return <Dialog open={open} onOpenChange={v=>!v&&!busy&&close()}><DialogContent className="form-dialog exp-dialog"><DialogTitle>Add expense</DialogTitle><DialogDescription>What was paid, to whom and how much.</DialogDescription>
  <form onSubmit={async e=>{e.preventDefault();setError('');const typed=f.newCat.trim(),category=f.adding?categories.find(c=>c.toLowerCase()===typed.toLowerCase())||typed:f.category;
   if(!category){setError('Choose a category, or add a new one.');return}
   setBusy(true);try{await onSave({direction:'Expense',branch:f.branch,officeId:null,reference:f.ref.trim()||'EXP-'+crypto.randomUUID().slice(0,8).toUpperCase(),party:f.party.trim(),method:f.method,category,description:f.description.trim(),entryDate:today,due:f.date,actual:f.paid?f.date:'',status:f.paid?'Paid':'Unpaid',amount:Number(f.amount),vatAmount:0,securityDeposit:0,incomeType:'Rent',bankName:'',notes:''});close()}catch(err){setError((err as Error).message)}finally{setBusy(false)}}}>
   <fieldset className="exp-pick"><legend>Category</legend><div className="chip-set">{categories.map(c=><button key={c} type="button" className="chip" aria-pressed={!f.adding&&f.category===c} onClick={()=>set({category:c,adding:false})}>{c}</button>)}<button type="button" className="chip exp-new-cat" aria-pressed={f.adding} onClick={()=>set({adding:true,category:''})}><Plus size={14}/>New category</button></div>
    {f.adding&&<label className="field"><span>New category name</span><input autoFocus required maxLength={60} placeholder="For example Cleaning, Marketing, Internet" value={f.newCat} onChange={e=>set({newCat:e.target.value})}/><small>It is added to the list for next time.</small></label>}</fieldset>
   <div className="form-grid">
    <label className="field"><span>Amount (AED)</span><input type="number" inputMode="decimal" min="0.01" step="0.01" required value={f.amount} onChange={e=>set({amount:e.target.value})}/></label>
    <label className="field"><span>Paid to</span><input required maxLength={200} placeholder="Person or company" value={f.party} onChange={e=>set({party:e.target.value})}/></label>
    <label className="field full"><span>What for (optional)</span><input maxLength={500} placeholder="For example October salary, electricity bill" value={f.description} onChange={e=>set({description:e.target.value})}/></label>
    <div className="field"><span>Paid already?</span><div className="seg" role="group" aria-label="Paid already?"><button type="button" aria-pressed={f.paid} onClick={()=>set({paid:true,date:f.date>today?today:f.date})}>Paid</button><button type="button" aria-pressed={!f.paid} onClick={()=>set({paid:false})}>Not yet</button></div></div>
    <label className="field"><span>{f.paid?'Date paid':'Due date'}</span><input type="date" required max={f.paid?today:undefined} value={f.date} onChange={e=>set({date:e.target.value})}/></label>
    <div className="field"><span>Paid by</span><div className="seg" role="group" aria-label="Paid by">{METHODS.map(([m,l])=><button key={m} type="button" aria-pressed={f.method===m} onClick={()=>set({method:m})}>{l}</button>)}</div></div>
    {f.method!=='Cash'&&<label className="field"><span>{f.method==='Check'?'Cheque number (optional)':'Transfer reference (optional)'}</span><input maxLength={120} value={f.ref} onChange={e=>set({ref:e.target.value})}/></label>}
    {branches&&<label className="field"><span>Branch</span><select aria-label="Expense branch" value={f.branch} onChange={e=>set({branch:e.target.value})}>{branches.map(b=><option key={b}>{b}</option>)}</select></label>}
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="form-footer"><button type="button" className="secondary" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save expense'}</button></div>
  </form></DialogContent></Dialog>;
}
