'use client';
import {CalendarDays,RotateCcw} from 'lucide-react';
import {contractValue} from '@/lib/access';
// Payment schedule for a lease: choose how many payments, the first due date and the method; the rent over the lease
// is split evenly (the last payment takes the rounding), VAT is added to each payment and the deposit to the first.
// Due dates are spread evenly over the lease. Each row can be changed before saving; the office API then creates
// one pending rent payment per row.
export type Installment={due:string;amount:number;vat:number;deposit:number};
export type Schedule={on:boolean;count:number;first:string;method:'Check'|'Transfer'|'Cash';rows:Installment[];edited:boolean};
type Lease={start:string;end:string;rent:number;period:string;vat:number;deposit:number};
const r2=(n:number)=>Math.round(n*100)/100;
const addMonths=(iso:string,n:number)=>{const d=new Date(iso+'T00:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10)};
const aed=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:2}).format(n);
export const COUNTS=[1,2,3,4,6,12];

export function planSchedule(o:Lease,count:number,first:string):Installment[]{
 const {months,value}=contractValue(o),n=Math.max(1,Math.min(24,Math.round(count)||1)),start=first||o.start;
 if(!start||!value)return [];
 const base=Math.floor(value/n*100)/100;
 return Array.from({length:n},(_,i)=>{const amount=i===n-1?r2(value-base*(n-1)):base,due=addMonths(start,Math.round(i*months/n));return {due:o.end&&due>o.end?o.end:due,amount,vat:r2(amount*(o.vat||0)/100),deposit:i===0?r2(o.deposit||0):0}});
}
// The schedule as shown: rows follow the lease (dates, rent) until a row is edited by hand.
export function liveSchedule(o:Lease,s:Schedule|undefined,on:boolean):Schedule{const v=s||{on,count:o.period==='Monthly'?12:1,first:'',method:'Check' as const,rows:[],edited:false},first=v.first||o.start;return v.edited?{...v,first}:{...v,first,rows:planSchedule(o,v.count,first)}}

export function ScheduleEditor({lease,value,onChange}:{lease:Lease;value:Schedule;onChange:(s:Schedule)=>void}){
 const {value:worth}=contractValue(lease),total=value.rows.reduce((a,r)=>a+r.amount,0),diff=r2(total-worth);
 const set=(patch:Partial<Schedule>)=>{const next={...value,...patch};onChange(patch.rows?next:{...next,rows:planSchedule(lease,next.count,next.first),edited:false})};
 const row=(i:number,patch:Partial<Installment>)=>onChange({...value,edited:true,rows:value.rows.map((r,j)=>j===i?{...r,...patch,...(patch.amount!==undefined?{vat:r2(patch.amount*(lease.vat||0)/100)}:{})}:r)});
 return <div className="schedule full">
  <label className="schedule-on"><input type="checkbox" checked={value.on} onChange={e=>onChange({...value,on:e.target.checked})}/>Create the payment schedule when I save</label>
  {value.on&&(!lease.start||!lease.end||!worth?<p className="notes">Enter the lease start, end and rent first; the payments are worked out from them.</p>:<>
   <div className="schedule-controls">
    <div className="field"><span>Number of payments</span><div className="seg" role="group" aria-label="Number of payments">{COUNTS.map(n=><button key={n} type="button" aria-pressed={value.count===n} onClick={()=>set({count:n})}>{n}</button>)}<input aria-label="Other number of payments" type="number" min={1} max={24} value={value.count} onChange={e=>set({count:Math.max(1,Math.min(24,Number(e.target.value)||1))})}/></div></div>
    <label className="field"><span>First payment date</span><input type="date" value={value.first} onChange={e=>e.target.value&&set({first:e.target.value})}/></label>
    <label className="field"><span>Paid by</span><select value={value.method} onChange={e=>onChange({...value,method:e.target.value as Schedule['method']})}>{['Check','Transfer','Cash'].map(m=><option key={m}>{m}</option>)}</select></label>
   </div>
   <div className="table-scroll"><table className="admin-table schedule-table"><thead><tr><th>#</th><th>Due date</th><th className="numeric">Rent (AED)</th><th className="numeric">VAT</th><th className="numeric">Deposit</th><th className="numeric">Total</th></tr></thead>
    <tbody>{value.rows.map((r,i)=><tr key={i}><td>{i+1}</td><td><input type="date" aria-label={'Due date of payment '+(i+1)} value={r.due} onChange={e=>e.target.value&&row(i,{due:e.target.value})}/></td><td className="numeric"><input type="number" min={0} step="0.01" aria-label={'Rent of payment '+(i+1)} value={r.amount} onChange={e=>row(i,{amount:Math.max(0,Number(e.target.value)||0)})}/></td><td className="numeric">{aed(r.vat)}</td><td className="numeric">{r.deposit?aed(r.deposit):'—'}</td><td className="numeric"><b>{aed(r.amount+r.vat+r.deposit)}</b></td></tr>)}</tbody>
    <tfoot><tr><th colSpan={2}>{value.rows.length} payment{value.rows.length===1?'':'s'} · {value.method.toLowerCase()}</th><th className="numeric">{aed(total)}</th><th className="numeric">{aed(value.rows.reduce((a,r)=>a+r.vat,0))}</th><th className="numeric">{aed(value.rows.reduce((a,r)=>a+r.deposit,0))}</th><th className="numeric">{aed(value.rows.reduce((a,r)=>a+r.amount+r.vat+r.deposit,0))}</th></tr></tfoot></table></div>
   <p className={'schedule-note'+(diff?' warn':'')}><CalendarDays size={15}/><span>{diff?<>Rent in the schedule is {aed(Math.abs(diff))} {diff>0?'more':'less'} than the contract value ({aed(worth)}).</>:<>Rent adds up to the contract value, {aed(worth)}. Each payment is saved as a pending rent payment in Cash and expenses.</>}</span>{value.edited&&<button type="button" className="text-button" onClick={()=>set({count:value.count})}><RotateCcw size={14}/>Recalculate</button>}</p>
  </>)}
 </div>;
}
