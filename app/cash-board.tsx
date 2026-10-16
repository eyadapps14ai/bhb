'use client';
import {useState} from 'react';
import {Banknote,Hourglass,AlertTriangle,Undo2,Receipt,ArrowUpRight,FileText,ChevronRight} from 'lucide-react';
import {paymentTotal,type Office,type Payment} from '@/lib/records';
import {StatusCards,PanelHead,GroupedTable,Progress,type BoardCard,type Column} from './board';
// Board layout for Cash flow: payment status cards, collection progress per tenant, and the
// payment register as a grouped table. It reads the same records as the classic layout.
const aed=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:2}).format(n);
const whole=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:0}).format(n);
const showDate=(s:string)=>s?new Date(s+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
const monthOf=(s:string)=>s?new Date(s.slice(0,7)+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}):'No date';
const days=(from:string,to:string)=>Math.round((Date.parse(to)-Date.parse(from))/864e5);
const plural=(n:number,word:string)=>n+' '+word+(n===1?'':'s');
const sum=(list:Payment[])=>list.reduce((a,p)=>a+paymentTotal(p),0);
const signed=(p:Payment)=>p.direction==='Income'?paymentTotal(p):-paymentTotal(p);
const isIn=(p:Payment)=>p.direction==='Income'&&p.status==='Cleared',isOut=(p:Payment)=>p.direction==='Expense'&&p.status==='Paid',isPending=(p:Payment)=>p.direction==='Income'&&p.status==='Pending',isUnpaid=(p:Payment)=>p.direction==='Expense'&&p.status==='Unpaid';
const isOverdue=(p:Payment,asof:string)=>(isPending(p)||isUnpaid(p))&&p.due<asof;
const kind=(p:Payment)=>p.direction==='Income'?(p.incomeType||'Rent'):p.category;
function Status({p,asof}:{p:Payment;asof:string}){const s=isOverdue(p,asof)?'Overdue':p.status;return <span className={'pill '+(['Cleared','Paid'].includes(s)?'good':['Overdue','Bounced'].includes(s)?'danger':['Pending','Unpaid'].includes(s)?'warn':'neutral')}>{s}</span>}
function timing(p:Payment,asof:string):[string,string]{
 if(p.status==='Cleared'||p.status==='Paid')return [(p.status==='Paid'?'Paid ':'Cleared ')+showDate(p.actual),'good'];
 if(p.status==='Bounced')return ['Bounced · due '+showDate(p.due),'danger'];
 if(p.status==='Cancelled')return ['Cancelled','neutral'];
 const d=days(asof,p.due);return d<0?[plural(-d,'day')+' overdue','danger']:d===0?['Due today','warn']:['Due in '+plural(d,'day'),'warn'];
}
export default function CashBoard({payments,offices,month,asof,onEdit,onOffice}:{payments:Payment[];offices:Office[];month:string;asof:string;onEdit?:(p:Payment)=>void;onOffice:(id:string)=>void}){
 const [open,setOpen]=useState<string|null>(null);
 const code=(id:string|null)=>id?offices.find(o=>o.id===id)?.code||'—':'Unassigned';
 const inMonth=(d:string)=>!!d&&d.slice(0,7)===month,fortnight=(p:Payment)=>p.due>=asof&&days(asof,p.due)<=14;
 const lists:Record<string,Payment[]>={received:payments.filter(p=>isIn(p)&&inMonth(p.actual)),pending:payments.filter(isPending),overdue:payments.filter(p=>isPending(p)&&p.due<asof),bounced:payments.filter(p=>p.direction==='Income'&&p.status==='Bounced'),unpaid:payments.filter(isUnpaid),paid:payments.filter(p=>isOut(p)&&inMonth(p.actual))};
 const card=(id:string,label:string,icon:React.ElementType,tone?:BoardCard['tone'],note?:string):BoardCard=>({id,label,icon,tone,note,value:whole(sum(lists[id])),chip:plural(lists[id].length,'payment'),empty:!lists[id].length});
 const dueSoon=lists.pending.filter(fortnight).length,unpaidLate=lists.unpaid.filter(p=>p.due<asof).length;
 const cards=[card('received','Received this month',Banknote,'good'),card('pending','Pending income',Hourglass,undefined,dueSoon?dueSoon+' due in 14 days':undefined),card('overdue','Overdue income',AlertTriangle,'danger'),card('bounced','Bounced checks',Undo2,'danger'),card('unpaid','Unpaid expenses',Receipt,undefined,unpaidLate?unpaidLate+' overdue':undefined),card('paid','Paid out this month',ArrowUpRight)];
 const panel=(id:string,close:()=>void)=>{const c=cards.find(x=>x.id===id)!,list=[...lists[id]].sort((a,b)=>a.due.localeCompare(b.due)),byParty=new Map<string,Payment[]>();for(const p of list)byParty.set(p.party,[...(byParty.get(p.party)||[]),p]);
  return <><PanelHead icon={c.icon} title={c.label} note={plural(list.length,'payment')+' · '+c.value} onClose={close}/>{list.length?[...byParty].map(([party,ps])=><div key={party} className="board-group"><div className="board-group-bar"><strong>{party}</strong><span>{aed(sum(ps))}</span></div>{ps.map(p=>{const [when,tone]=timing(p,asof);return <div key={p.id} className="board-item"><span className="board-item-icon"><FileText size={17}/></span><div className="board-item-main"><strong>{p.reference}</strong><small>{code(p.officeId)} · {kind(p)} · {p.method}{p.bankName&&' · '+p.bankName} · {aed(paymentTotal(p))}</small></div><span className={'pill '+tone}>{when}</span>{onEdit&&<button type="button" className="secondary" onClick={()=>onEdit(p)}>Open</button>}</div>})}</div>):<p className="board-none">No payments here.</p>}</>};
 // Collection per tenant: everything scheduled on the office (not cancelled) against what has cleared.
 const tenants=offices.map(o=>{const ps=payments.filter(p=>p.officeId===o.id&&p.direction==='Income'&&p.status!=='Cancelled'),total=sum(ps),collected=sum(ps.filter(isIn));return {o,count:ps.length,total,collected,remaining:total-collected,late:ps.filter(p=>isOverdue(p,asof)||p.status==='Bounced').length}}).filter(t=>t.count).sort((a,b)=>b.remaining-a.remaining);
 const columns:Column<Payment>[]=[
  {id:'payment',label:'Payment',cell:p=><><strong>{p.party}</strong><small>{p.reference}{p.bankName&&' · '+p.bankName} · {kind(p)} · {p.method}</small></>},
  {id:'office',label:'Office',cell:p=>p.officeId?<button type="button" className="text-button" onClick={()=>onOffice(p.officeId!)}>{code(p.officeId)}</button>:'Unassigned'},
  {id:'due',label:'Due',cell:p=><>{showDate(p.due)}{p.actual&&<small>Cash {showDate(p.actual)}</small>}</>},
  {id:'amount',label:'Amount',numeric:true,cell:p=>aed(p.amount),total:l=>aed(l.reduce((a,p)=>a+(p.direction==='Income'?p.amount:-p.amount),0))},
  {id:'extra',label:'VAT + deposit',numeric:true,cell:p=>p.direction==='Income'?aed((p.vatAmount||0)+(p.securityDeposit||0)):'—',total:l=>aed(l.reduce((a,p)=>a+(p.direction==='Income'?(p.vatAmount||0)+(p.securityDeposit||0):0),0))},
  {id:'total',label:'Total (AED)',numeric:true,highlight:true,cell:p=><span className={p.direction==='Expense'?'neg':'pos'}>{aed(signed(p))}</span>,total:l=>{const n=l.reduce((a,p)=>a+signed(p),0);return <span className={n<0?'neg':'pos'}>{aed(n)}</span>}},
  {id:'status',label:'Status',cell:p=><Status p={p} asof={asof}/>},
  {id:'edit',label:'',cell:p=>onEdit?<button type="button" className="text-button" onClick={()=>onEdit(p)}>Edit</button>:null},
 ];
 const rows=[...payments].sort((a,b)=>a.due.localeCompare(b.due));
 return <div className="cash-board">
  <StatusCards cards={cards} open={open} onOpen={setOpen} renderPanel={panel}/>
  <section className="surface board-table" aria-labelledby="collection-title"><div className="surface-head"><div><h2 id="collection-title">Collection by tenant</h2><small>{plural(tenants.length,'office')} with scheduled income · as of {showDate(asof)}</small></div></div>
   {tenants.length?<div className="table-scroll"><table className="gt-table"><thead><tr><th scope="col">Tenant</th><th scope="col">Office</th><th scope="col">Collected</th><th scope="col" className="num">Scheduled</th><th scope="col" className="num hl">Remaining</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
    <tbody>{tenants.map(t=><tr key={t.o.id}><td><strong>{t.o.company||t.o.contact||'No tenant name'}</strong><small>{t.o.start&&t.o.end?'Lease '+showDate(t.o.start)+' – '+showDate(t.o.end):plural(t.count,'payment')}{t.late>0&&<b className="late"> · {t.late} late</b>}</small></td><td>{t.o.code}</td><td><Progress value={t.total?t.collected/t.total:0}/></td><td className="num">{aed(t.total)}</td><td className="num hl">{aed(t.remaining)}</td><td><button type="button" className="icon-close" aria-label={'Open '+t.o.code} onClick={()=>onOffice(t.o.id)}><ChevronRight size={18}/></button></td></tr>)}</tbody></table></div>
   :<div className="empty compact"><h3>No scheduled income yet</h3><p>Add checks or income to an office and its collection shows here.</p></div>}</section>
  <GroupedTable title="Payment register" rows={rows} rowKey={p=>p.id} columns={columns} search={p=>[p.party,p.reference,p.bankName,code(p.officeId),p.description,p.notes,kind(p),p.method].join(' ')} initialGroups={['party']} empty="Add income or an expense to see it here."
   filters={[{id:'all',label:'All',test:()=>true},{id:'income',label:'Income',test:p=>p.direction==='Income'},{id:'expense',label:'Expenses',test:p=>p.direction==='Expense'},{id:'open',label:'Pending / unpaid',test:p=>isPending(p)||isUnpaid(p)},{id:'overdue',label:'Overdue',test:p=>isOverdue(p,asof)},{id:'bounced',label:'Bounced',test:p=>p.status==='Bounced'},{id:'done',label:'Cleared / paid',test:p=>isIn(p)||isOut(p)}]}
   groupings={[{id:'party',label:'Tenant / payee',key:p=>p.party},{id:'office',label:'Office',key:p=>code(p.officeId)},{id:'month',label:'Due month',key:p=>monthOf(p.due)},{id:'type',label:'Type',key:kind},{id:'method',label:'Method',key:p=>p.method},{id:'status',label:'Status',key:p=>isOverdue(p,asof)?'Overdue':p.status}]}/>
 </div>;
}
