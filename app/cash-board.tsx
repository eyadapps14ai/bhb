'use client';
import {paymentTotal,type Office,type Payment} from '@/lib/records';
import {GroupedTable,type Column} from './board';
// Analytical layout for Cash flow: the payment register as one grouped table (filter chips, group-by
// chips, subtotals). It reads the same records as the classic layout.
const aed=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:2}).format(n);
const showDate=(s:string)=>s?new Date(s+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
const monthOf=(s:string)=>s?new Date(s.slice(0,7)+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}):'No date';
const signed=(p:Payment)=>p.direction==='Income'?paymentTotal(p):-paymentTotal(p);
const isIn=(p:Payment)=>p.direction==='Income'&&p.status==='Cleared',isOut=(p:Payment)=>p.direction==='Expense'&&p.status==='Paid',isPending=(p:Payment)=>p.direction==='Income'&&p.status==='Pending',isUnpaid=(p:Payment)=>p.direction==='Expense'&&p.status==='Unpaid';
const isOverdue=(p:Payment,asof:string)=>(isPending(p)||isUnpaid(p))&&p.due<asof;
const kind=(p:Payment)=>p.direction==='Income'?(p.incomeType||'Rent'):p.category;
function Status({p,asof}:{p:Payment;asof:string}){const s=isOverdue(p,asof)?'Overdue':p.status;return <span className={'pill '+(['Cleared','Paid'].includes(s)?'good':['Overdue','Bounced'].includes(s)?'danger':['Pending','Unpaid'].includes(s)?'warn':'neutral')}>{s}</span>}
export default function CashBoard({payments,offices,asof,onEdit,onOffice}:{payments:Payment[];offices:Office[];month?:string;asof:string;onEdit?:(p:Payment)=>void;onOffice:(id:string)=>void}){
 const code=(id:string|null)=>id?offices.find(o=>o.id===id)?.code||'—':'Unassigned';
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
  <GroupedTable title="Payment register" rows={rows} rowKey={p=>p.id} columns={columns} search={p=>[p.party,p.reference,p.bankName,code(p.officeId),p.description,p.notes,kind(p),p.method].join(' ')} initialGroups={['party']} empty="Add income or an expense to see it here."
   filters={[{id:'all',label:'All',test:()=>true},{id:'income',label:'Income',test:p=>p.direction==='Income'},{id:'expense',label:'Expenses',test:p=>p.direction==='Expense'},{id:'open',label:'Pending / unpaid',test:p=>isPending(p)||isUnpaid(p)},{id:'overdue',label:'Overdue',test:p=>isOverdue(p,asof)},{id:'bounced',label:'Bounced',test:p=>p.status==='Bounced'},{id:'done',label:'Cleared / paid',test:p=>isIn(p)||isOut(p)}]}
   groupings={[{id:'party',label:'Tenant / payee',key:p=>p.party},{id:'office',label:'Office',key:p=>code(p.officeId)},{id:'month',label:'Due month',key:p=>monthOf(p.due)},{id:'type',label:'Type',key:kind},{id:'method',label:'Method',key:p=>p.method},{id:'status',label:'Status',key:p=>isOverdue(p,asof)?'Overdue':p.status}]}/>
 </div>;
}
