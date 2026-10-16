'use client';
import {Fragment,useContext,useRef,useState} from 'react';
import {ExportAllowed} from './board';
import {ChevronLeft,ChevronRight,ChevronDown,CalendarDays,ArrowUpRight,ArrowDownRight,Hourglass,TriangleAlert,Download} from 'lucide-react';
import {BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,ReferenceArea} from 'recharts';
import {cashMetrics,paymentTotal,type Payment} from '@/lib/records';
// Modern theme Cash flow: a month card, an Overview (net hero, what needs attention, where income came from,
// held funds, the next 30 days, monthly chart) and an Analysis that groups every amount four ways.
const IN='#2e5f7f',OUT='#c98a3c';
const n0=(n:number)=>new Intl.NumberFormat('en-AE',{maximumFractionDigits:0}).format(Math.round(n));
const aed0=(n:number)=>'AED '+n0(n);
const signedAmt=(n:number)=>(n<0?'− ':'+ ')+n0(Math.abs(n));
const date=(iso:string)=>new Date(iso+'T00:00:00Z');
const SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthName=(mo:string,style:'long'|'short'='long')=>style==='short'?SHORT[+mo.slice(5,7)-1]:date(mo+'-01').toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'});
const monthYear=(mo:string)=>date(mo+'-01').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
const dayMonth=(iso:string)=>+iso.slice(8,10)+' '+SHORT[+iso.slice(5,7)-1];
const fullDate=(iso:string)=>dayMonth(iso)+' '+iso.slice(0,4);
const shift=(mo:string,by:number)=>{const d=date(mo+'-01');d.setUTCMonth(d.getUTCMonth()+by);return d.toISOString().slice(0,7)};
const daysIn=(mo:string)=>new Date(Date.UTC(+mo.slice(0,4),+mo.slice(5,7),0)).getUTCDate();
const isIn=(p:Payment)=>p.direction==='Income'&&p.status==='Cleared',isOut=(p:Payment)=>p.direction==='Expense'&&p.status==='Paid';
const isPending=(p:Payment)=>p.direction==='Income'&&p.status==='Pending',isUnpaid=(p:Payment)=>p.direction==='Expense'&&p.status==='Unpaid';
const plural=(n:number,w:string)=>n+' '+w+(n===1?'':'s');
type Drill=(title:string,pay:(p:Payment)=>boolean,note?:string,amount?:(p:Payment)=>number)=>void;

export function MonthCard({month,setMonth,asof,setAsof}:{month:string;setMonth:(m:string)=>void;asof:string;setAsof:(d:string)=>void}){
 const monthInput=useRef<HTMLInputElement>(null),dateInput=useRef<HTMLInputElement>(null),current=asof.slice(0,7);
 const pick=(el:HTMLInputElement|null)=>{if(!el)return;try{el.showPicker()}catch{el.focus();el.click()}};
 const total=daysIn(month),day=Number(asof.slice(8,10)),state=month===current?'current':month<current?'past':'future';
 const pct=state==='current'?day/total*100:state==='past'?100:0,prev=shift(month,-1),next=shift(month,1);
 return <section className="m-card m-month">
  <div><span className={'m-pill '+state}><i/>{state==='current'?'Current month':state==='past'?'Past month':'Future month'}</span><h2>{monthYear(month)}</h2>
   <div className="m-progress-row"><span className="m-progress" role="img" aria-label={Math.round(pct)+'% of the month'}><span style={{width:pct+'%'}}/></span><span>{state==='current'?<><b>1 to {dayMonth(asof)}</b> · day {day} of {total} · {plural(total-day,'day')} left</>:state==='past'?<><b>Full month</b> · {total} days</>:<><b>Starts 1 {monthName(month,'short')}</b></>}</span></div></div>
  <div className="m-month-side"><div className="m-seg"><button type="button" onClick={()=>setMonth(prev)}><ChevronLeft size={16}/>{monthName(prev,'short')}</button><button type="button" className="on" onClick={()=>pick(monthInput.current)}><CalendarDays size={16}/>Change month</button><button type="button" disabled={next>current} onClick={()=>setMonth(next)}>{monthName(next,'short')}<ChevronRight size={16}/></button></div>
   <input ref={monthInput} className="m-hidden" type="month" aria-label="Reporting month" value={month} onChange={e=>e.target.value&&setMonth(e.target.value)}/>
   <p>As of <button type="button" className="m-link" onClick={()=>pick(dateInput.current)}>{fullDate(asof)}</button> · compared with {monthName(prev)}</p>
   <input ref={dateInput} className="m-hidden" type="date" aria-label="As-of date" value={asof} onChange={e=>e.target.value&&setAsof(e.target.value)}/></div>
 </section>;
}

function Delta({now,before,label,upGood=true}:{now:number;before:number;label:string;upGood?:boolean}){const d=now-before;if(!d)return <small className="m-delta">No change vs {label}</small>;return <small className={'m-delta '+((d>0)===upGood?'m-up':'m-down')}>{d>0?'+':'−'}{n0(Math.abs(d))} vs {label}{!before&&now&&!upGood?' (no spend in '+label+')':''}</small>}

export function CashOverview({payments,month,asof,drill,drillMonth}:{payments:Payment[];month:string;asof:string;drill:Drill;drillMonth:(mo:string)=>void}){
 const [table,setTable]=useState(false);
 const prev=shift(month,-1),pl=monthName(prev,'short'),ml=monthName(month,'short'),m=cashMetrics(payments,month,asof),pm=cashMetrics(payments,prev,asof);
 const kept=m.cashIn?Math.round(m.net/m.cashIn*100):0,inShare=m.cashIn+m.cashOut?m.cashIn/(m.cashIn+m.cashOut)*100:0;
 const pending=payments.filter(isPending),overdueIn=pending.filter(p=>p.due<asof),unpaid=payments.filter(isUnpaid),overdueOut=unpaid.filter(p=>p.due<asof),unpaidTotal=unpaid.reduce((a,p)=>a+paymentTotal(p),0);
 const things=overdueIn.length+overdueOut.length,checks=(l:Payment[])=>l.every(p=>p.method==='Check')?'check':'payment';
 const sources:[string,number][]=[['Rent',m.rentIncome],['PRO services',m.proIncome],['Other income',m.otherIncome]],income=sources.reduce((a,s)=>a+s[1],0);
 const monthEnd=month+'-'+String(daysIn(month)).padStart(2,'0'),current=asof.slice(0,7)===month;
 const dueIn=pending.filter(p=>p.due>=asof&&p.due<=monthEnd).reduce((a,p)=>a+paymentTotal(p),0),dueOut=unpaid.filter(p=>p.due<=monthEnd).reduce((a,p)=>a+paymentTotal(p),0);
 const year=month.slice(0,4),rows=Array.from({length:12},(_,i)=>{const mo=year+'-'+String(i+1).padStart(2,'0'),v=cashMetrics(payments,mo,asof);return {mo,label:monthName(mo,'short'),'Cash in':v.cashIn,'Cash out':v.cashOut}});
 const firstMo=payments.filter(p=>(isIn(p)||isOut(p))&&p.actual?.startsWith(year)).map(p=>p.actual.slice(0,7)).sort()[0];
 return <>
  <section className="m-card m-hero">
   <button type="button" className="m-net" onClick={()=>drillMonth(month)}><span className="m-label">Net cash flow · {ml}{m.net!==pm.net&&<span className={'m-chip '+(m.net>=pm.net?'m-up':'m-down')}>{m.net>=pm.net?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>}AED {n0(Math.abs(m.net-pm.net))} vs {pl}</span>}</span>
    <strong className="m-big"><small>AED</small>{m.net<0?'−':''}{n0(Math.abs(Math.trunc(m.net)))}<small>.{String(Math.round(Math.abs(m.net)*100)%100).padStart(2,'0')}</small></strong>
    <span className="m-split" role="img" aria-label="Cash in against cash out"><span style={{width:inShare+'%',background:IN}}/><span style={{width:(100-inShare)+'%',background:OUT}}/></span>
    <p>{m.cashIn?<>AED {n0(m.cashIn)} came in, AED {n0(m.cashOut)} went out. You kept {kept}% of what you collected.</>:m.cashOut?<>Nothing came in yet; AED {n0(m.cashOut)} went out.</>:'No cash in or out yet this month.'}</p></button>
   <button type="button" className="m-stat" onClick={()=>drill('Cash in · '+monthYear(month),p=>isIn(p)&&!!p.actual&&p.actual.startsWith(month),'Cleared income by actual cash date, including VAT and deposits.')}><span className="m-label"><i style={{background:IN}}/>Cash in</span><strong>{aed0(m.cashIn)}</strong><Delta now={m.cashIn} before={pm.cashIn} label={pl}/></button>
   <button type="button" className="m-stat" onClick={()=>drill('Cash out · '+monthYear(month),p=>isOut(p)&&!!p.actual&&p.actual.startsWith(month),'Paid expenses by actual cash date.')}><span className="m-label"><i style={{background:OUT}}/>Cash out</span><strong>{aed0(m.cashOut)}</strong><Delta now={m.cashOut} before={pm.cashOut} label={pl} upGood={false}/></button>
   <button type="button" className="m-stat" onClick={()=>drill('Pending income',isPending,'Income not yet cleared, whatever its due date.')}><span className="m-label"><Hourglass size={14}/>Pending income</span><strong>{aed0(m.pending)}</strong><small className="m-delta">{pending.length?plural(pending.length,checks(pending))+' not yet cleared':'Nothing waiting to clear'}</small></button>
  </section>
  {(things>0||unpaidTotal>0)&&<section className="m-attention"><span className="m-attention-icon"><TriangleAlert size={18}/></span><p><b>{things?plural(things,'thing')+' need'+(things===1?'s':'')+' you':'Open payments'}</b>{unpaidTotal>0&&<> · AED {n0(unpaidTotal)} still unpaid</>}</p><div>
   {overdueIn.length>0&&<button type="button" onClick={()=>drill('Overdue income',p=>isPending(p)&&p.due<asof,'Pending income due before '+fullDate(asof)+'.')}>{plural(overdueIn.length,'overdue '+checks(overdueIn))}<ChevronRight size={16}/></button>}
   {overdueOut.length>0&&<button type="button" onClick={()=>drill('Overdue expenses',p=>isUnpaid(p)&&p.due<asof,'Unpaid expenses due before '+fullDate(asof)+'.')}>{plural(overdueOut.length,'overdue expense')}<ChevronRight size={16}/></button>}
   {unpaidTotal>0&&<button type="button" onClick={()=>drill('Unpaid expenses',isUnpaid,'Expenses not yet paid, whatever their due date.')}>Pay AED {n0(unpaidTotal)}<ChevronRight size={16}/></button>}</div></section>}
  <div className="m-three">
   <section className="m-card m-list"><h3>Where income came from</h3><small>{monthName(month)} · before VAT and deposits</small>
    {income?sources.filter(s=>s[1]>0).map(([label,v])=><button type="button" key={label} className="m-source" onClick={()=>drill(label+' · '+monthYear(month),p=>isIn(p)&&!!p.actual&&p.actual.startsWith(month)&&(p.incomeType||'Rent')===(label==='PRO services'?'PRO service':label),'Cleared income excluding VAT and deposits.',p=>p.amount)}><span>{label}</span><b>AED {n0(v)} <em>· {Math.round(v/income*100)}%</em></b><span className="m-bar"><span style={{width:v/income*100+'%'}}/></span></button>):<p className="m-quiet">No income cleared this month yet.</p>}
    {income>0&&!m.otherIncome&&<p className="m-quiet">No other income this month.</p>}
    <div className="m-total"><span>Total income</span><b>AED {n0(income)}</b></div></section>
   <section className="m-card m-list"><h3>Held, not earned</h3><small>{monthName(month)} · cleared payments</small>
    <div className="m-row"><span>VAT collected<small>Owed to FTA</small></span><b>AED {n0(m.vatCollected)}</b></div>
    <div className="m-row"><span>Security deposits<small>Refundable to tenants</small></span><b>AED {n0(m.depositsReceived)}</b></div>
    <p className="m-note">These sit inside Cash in but aren’t yours to spend. Tracking only, not a VAT return.</p></section>
   <section className="m-card m-list"><h3>Next 30 days</h3><small>From {fullDate(asof)}</small>
    <div className="m-row"><span>Income due</span>{m.nextIn?<b className="m-up">+ AED {n0(m.nextIn)}</b>:<em>Nothing scheduled</em>}</div>
    <div className="m-row"><span>Expenses due</span>{m.nextOut?<b className="m-down">− AED {n0(m.nextOut)}</b>:<em>Nothing scheduled</em>}</div>
    {current&&<div className="m-dark"><small>Expected net by end of {monthName(month)}</small><strong>AED {n0(m.net+dueIn-dueOut)}</strong><small>{n0(m.net)} today + {n0(dueIn)} due in − {n0(dueOut)} unpaid</small></div>}</section>
  </div>
  <section className="m-card m-chart"><div className="m-chart-head"><div><h3>Monthly cash in and out</h3><small>{year} · AED</small></div><div className="m-chart-tools"><span className="m-legend"><i style={{background:IN}}/>Cash in</span><span className="m-legend"><i style={{background:OUT}}/>Cash out</span><div className="m-seg small"><button type="button" className={table?'':'on'} onClick={()=>setTable(false)}>Chart</button><button type="button" className={table?'on':''} onClick={()=>setTable(true)}>Table</button></div></div></div>
   {table?<div className="table-scroll"><table className="m-table"><thead><tr><th>Month</th><th>Cash in</th><th>Cash out</th><th>Net</th></tr></thead><tbody>{rows.filter(r=>r['Cash in']||r['Cash out']||r.mo===month).map(r=><tr key={r.mo} className={r.mo===month?'on':undefined} onClick={()=>drillMonth(r.mo)}><td><b>{monthName(r.mo)}</b>{r.mo===asof.slice(0,7)&&<small> to date</small>}</td><td>{n0(r['Cash in'])}</td><td>{n0(r['Cash out'])}</td><td><b>{n0(r['Cash in']-r['Cash out'])}</b></td></tr>)}</tbody></table></div>
   :<div className="m-chart-box"><ResponsiveContainer width="100%" height={300}><BarChart data={rows} barGap={6} style={{cursor:'pointer'}} onClick={e=>{const i=Number(e?.activeTooltipIndex);if(Number.isInteger(i)&&rows[i])drillMonth(rows[i].mo)}}><CartesianGrid vertical={false} stroke="#ece6da"/><ReferenceArea x1={monthName(month,'short')} x2={monthName(month,'short')} fill="#f7f1e6" fillOpacity={1} ifOverflow="extendDomain"/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={(t:any)=><text x={t.x} y={t.y+14} textAnchor="middle" fontSize={13} fill={t.payload.value===monthName(month,'short')?'#1f1d18':'#8a8578'} fontWeight={t.payload.value===monthName(month,'short')?700:400}>{t.payload.value}</text>}/><YAxis tickLine={false} axisLine={false} tick={{fontSize:12,fill:'#8a8578'}} tickFormatter={v=>v>=1000?(v/1000)+'k':String(v)}/><Tooltip formatter={(v:any)=>aed0(Number(v))} cursor={{fill:'#c7963614'}}/><Bar dataKey="Cash in" fill={IN} radius={[4,4,0,0]} maxBarSize={28}/><Bar dataKey="Cash out" fill={OUT} radius={[4,4,0,0]} maxBarSize={28}/></BarChart></ResponsiveContainer></div>}
   {firstMo&&firstMo>year+'-01'&&<p className="m-quiet">Records start in {monthYear(firstMo)}. Earlier months will fill in as you add them.</p>}</section>
 </>;
}

type Line={key:string;label:string;sub:string;amount:number};
type Group={key:string;label:string;note:string;lines:Line[];net?:boolean};
const expenseLabel:Record<string,string>={Payroll:'Payroll',Rent:'Rent paid',Utilities:'Utilities',Supplies:'Supplies',Other:'Other expenses'};
// Cleared lines for a set of payments: earned income by type, held funds, and expenses by category.
function cleared(list:Payment[],prefix=''):Line[]{
 const rec=list.filter(isIn),out=list.filter(isOut),sum=(l:Payment[],f:(p:Payment)=>number)=>l.reduce((a,p)=>a+f(p),0);
 const lines:Line[]=[{key:prefix+'rent',label:'Rent',sub:'Cleared',amount:sum(rec.filter(p=>(p.incomeType||'Rent')==='Rent'),p=>p.amount)},{key:prefix+'pro',label:'PRO services',sub:'Cleared',amount:sum(rec.filter(p=>p.incomeType==='PRO service'),p=>p.amount)},{key:prefix+'other',label:'Other income',sub:'Cleared',amount:sum(rec.filter(p=>p.incomeType==='Other income'),p=>p.amount)},
  {key:prefix+'dep',label:'Security deposits',sub:'Refundable to tenants',amount:sum(rec,p=>p.securityDeposit||0)},{key:prefix+'vat',label:'VAT collected',sub:'Owed to FTA',amount:sum(rec,p=>p.vatAmount||0)},
  ...Object.keys(expenseLabel).map(c=>({key:prefix+'x-'+c,label:expenseLabel[c],sub:'Paid',amount:-sum(out.filter(p=>(p.category||'Other')===c),p=>p.amount)}))];
 return lines.filter(l=>Math.abs(l.amount)>0.004);
}
const byAbs=(a:Line,b:Line)=>Math.abs(b.amount)-Math.abs(a.amount);

export function CashAnalysis({payments,month,asof}:{payments:Payment[];month:string;asof:string}){
 const canExport=useContext(ExportAllowed);
 const [by,setBy]=useState<'category'|'direction'|'status'|'month'>('category'),[folded,setFolded]=useState<Set<string>>(new Set());
 const inMonth=(p:Payment)=>(isIn(p)||isOut(p))&&!!p.actual&&p.actual.startsWith(month),monthLines=cleared(payments.filter(inMonth));
 const mn=monthName(month),pending=payments.filter(isPending),unpaid=payments.filter(isUnpaid);
 let groups:Group[]=[],subtitle=monthYear(month)+' · cleared payments',note='';
 if(by==='category'){const earned=['Rent','PRO services','Other income'],held=['Security deposits','VAT collected'];
  groups=[{key:'inc',label:'Income',note:'Earned this month',lines:monthLines.filter(l=>earned.includes(l.label))},{key:'held',label:'Held funds',note:'Not yours to spend',lines:monthLines.filter(l=>held.includes(l.label))},{key:'exp',label:'Expenses',note:'Paid this month',lines:monthLines.filter(l=>l.amount<0)}];
  note='Held funds sit inside Cash in but are not earned: VAT is owed to FTA and deposits are refundable.';}
 else if(by==='direction'){groups=[{key:'in',label:'Money in',note:'Income, VAT and deposits',lines:monthLines.filter(l=>l.amount>0).sort(byAbs)},{key:'out',label:'Money out',note:'Expenses paid',lines:monthLines.filter(l=>l.amount<0).sort(byAbs)}];note='Money in includes VAT and deposits. Earned income is shown under Category.';}
 else if(by==='status'){subtitle=monthYear(month)+' · cleared and open items';
  const waiting:Line[]=[];if(pending.length)waiting.push({key:'wait-in',label:'Checks not cleared',sub:plural(pending.length,pending.every(p=>p.method==='Check')?'check':'payment')+' · '+pending.filter(p=>p.due<asof).length+' overdue',amount:pending.reduce((a,p)=>a+paymentTotal(p),0)});
  if(unpaid.length)waiting.push({key:'wait-out',label:'Unpaid expenses',sub:unpaid.filter(p=>p.due<asof).length+' overdue',amount:-unpaid.reduce((a,p)=>a+paymentTotal(p),0)});
  groups=[{key:'clr',label:'Cleared',note:'Already in or out of the bank',lines:[...monthLines].sort(byAbs),net:true},{key:'wait',label:'Waiting',note:'Not settled yet',lines:waiting,net:true}];note='Waiting items are not in the net cash flow until they clear or are paid.';}
 else{const months=[...new Set(payments.filter(p=>(isIn(p)||isOut(p))&&!!p.actual&&p.actual.slice(0,4)===month.slice(0,4)&&p.actual.slice(0,7)<=month).map(p=>p.actual.slice(0,7)))].sort().reverse();
  groups=months.map(mo=>({key:mo,label:monthYear(mo),note:mo===asof.slice(0,7)?'To '+dayMonth(asof):'Full month',lines:cleared(payments.filter(p=>(isIn(p)||isOut(p))&&p.actual?.startsWith(mo)),mo+'-').sort(byAbs),net:true}));
  subtitle=months.length>1?monthName(months[months.length-1])+' to '+monthYear(months[0])+' · cleared payments':monthYear(month)+' · cleared payments';
  note=months.length?'Records start in '+monthYear(months[months.length-1])+'. More months appear here as they are added.':'';}
 groups=groups.filter(g=>g.lines.length);
 const all=groups.flatMap(g=>g.lines),max=Math.max(1,...all.map(l=>Math.abs(l.amount))),moneyIn=all.filter(l=>l.amount>0).reduce((a,l)=>a+l.amount,0),moneyOut=-all.filter(l=>l.amount<0).reduce((a,l)=>a+l.amount,0);
 const total=(g:Group)=>g.lines.reduce((a,l)=>a+l.amount,0),fold=(k:string)=>setFolded(f=>{const n=new Set(f);if(n.has(k))n.delete(k);else n.add(k);return n});
 const exportCsv=()=>{const q=(v:string|number)=>{const t=String(v);return '"'+(typeof v==='string'&&(/^[=+@\t\r]/.test(t)||/^-/.test(t)&&isNaN(Number(t)))?"'"+t:t).replace(/"/g,'""')+'"'};const csv=['Group,Line,Detail,Amount (AED)',...groups.flatMap(g=>g.lines.map(l=>[g.label,l.label,l.sub,l.amount.toFixed(2)].map(q).join(',')))].join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='cash-flow-'+month+'-by-'+by+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)};
 return <section className="m-card m-analysis"><div className="m-analysis-head"><div><h3>Analyze cash flow</h3><small>{subtitle}</small></div>{canExport&&<button type="button" className="secondary" disabled={!all.length} onClick={exportCsv}><Download size={16}/>Export CSV</button>}</div>
  <div className="m-groupby" role="group" aria-label="Group by"><span>Group by</span>{(['category','direction','status','month'] as const).map(k=><button key={k} type="button" aria-pressed={by===k} onClick={()=>{setBy(k);setFolded(new Set())}}>{k[0].toUpperCase()+k.slice(1)}</button>)}</div>
  <div className="m-sum"><div><small>Money in</small><strong>AED {n0(moneyIn)}</strong></div><div><small>Money out</small><strong>AED {n0(moneyOut)}</strong></div><div className="dark"><small>Net · {plural(groups.length,'group')}</small><strong>{moneyIn-moneyOut<0?'− ':''}AED {n0(Math.abs(moneyIn-moneyOut))}</strong></div></div>
  {all.length?<div className="table-scroll"><table className="m-share"><thead><tr><th>{by[0].toUpperCase()+by.slice(1)}</th><th>Share of largest</th><th>Amount</th></tr></thead><tbody>{groups.map(g=><Fragment key={g.key}>
   <tr className="m-group"><td><button type="button" aria-expanded={!folded.has(g.key)} onClick={()=>fold(g.key)}>{folded.has(g.key)?<ChevronRight size={16}/>:<ChevronDown size={16}/>}<b>{g.label}</b><small>{plural(g.lines.length,'line')}</small></button></td><td>{g.note}</td><td><b>{g.net?'Net '+n0(total(g)):signedAmt(total(g))}</b></td></tr>
   {!folded.has(g.key)&&g.lines.map(l=><tr key={l.key}><td><span className="m-line">{l.label}<small>{l.sub}</small></span></td><td><span className="m-share-bar"><span className="m-bar"><span style={{width:Math.abs(l.amount)/max*100+'%',background:l.amount<0?OUT:IN}}/></span><em>{Math.round(Math.abs(l.amount)/max*100)}%</em></span></td><td className={l.amount<0?'m-down':undefined}>{signedAmt(l.amount)}</td></tr>)}</Fragment>)}</tbody></table></div>
  :<p className="m-note">Nothing cleared in {mn} yet.</p>}
  {note&&all.length>0&&<p className="m-note">{note}</p>}
 </section>;
}
