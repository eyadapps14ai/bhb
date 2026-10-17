'use client';
import {useState} from 'react';
// On the invoice page (screen only, never printed): the tax credit notes issued against this invoice, and "Issue credit
// note" for people allowed to (Cash flow edit and Invoices). Full credit takes off all that is left; part credit an amount
// before VAT. The reason is printed on the credit note.
const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const day=(s:string)=>s?+s.slice(8,10)+' '+M[+s.slice(5,7)-1]+' '+s.slice(0,4):'';
const fmt=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED'}).format(n);
const REASONS=['Cheque bounced and not replaced','Lease cancelled, rent refunded','Discount agreed after invoicing','Invoice amount was wrong'];
export type NoteLine={id:string;number:string;issueDate:string;reason:string;total:number};
export default function CreditNotes({invoiceId,notes,leftNet,leftVat,vatRate,invoiceDate,today,canCredit}:{invoiceId:string;notes:NoteLine[];leftNet:number;leftVat:number;vatRate:number;invoiceDate:string;today:string;canCredit:boolean}){
 const [open,setOpen]=useState(false),[part,setPart]=useState(false),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[date,setDate]=useState(today),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const net=part?Number(amount)||0:leftNet,vat=part?Math.round(net*vatRate)/100:leftVat;
 const issue=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/invoices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'creditNote',invoiceId,issueDate:date,reason,net})});const d=await r.json() as {url?:string;error?:string};if(!r.ok)throw new Error(d.error||'Could not issue the credit note');window.location.href=d.url||'/'}catch(err){setError((err as Error).message);setBusy(false)}};
 return <section className="cn-panel no-print" aria-labelledby="cn-title"><div className="cn-head"><h2 id="cn-title">Tax credit notes</h2>{leftNet<=0.004?<span className="badge danger">Credited in full</span>:notes.length>0?<span className="badge warn">Credited in part · {fmt(leftNet)} before VAT left</span>:null}</div>
  {notes.length?<ul className="cn-list">{notes.map(n=><li key={n.id}><a className="text-button" href={'/credit-note/'+n.id}>{n.number}</a><span>{day(n.issueDate)}</span><b>{fmt(n.total)}</b><small>{n.reason}</small></li>)}</ul>:<p className="notes">None. Issue one if this invoice must be reduced: a bounced cheque that is not replaced, a refund, or a discount after invoicing.</p>}
  {canCredit&&leftNet>0.004&&(!open?<button type="button" className="secondary" onClick={()=>setOpen(true)}>Issue credit note</button>
  :<form className="cn-form" onSubmit={issue}>
   <div className="seg" role="group" aria-label="Credit"><button type="button" aria-pressed={!part} onClick={()=>setPart(false)}>Full: {fmt(leftNet+leftVat)}</button><button type="button" aria-pressed={part} onClick={()=>setPart(true)}>Part</button></div>
   {part&&<label className="field"><span>Amount to credit before VAT (at most {fmt(leftNet)})</span><input aria-label="Amount to credit before VAT" type="number" min="0.01" max={leftNet} step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/><small>VAT {vatRate}%: {fmt(vat)} · total {fmt(net+vat)}</small></label>}
   <label className="field"><span>Reason (printed on the credit note)</span><textarea aria-label="Credit note reason" required minLength={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <div className="chip-set cn-reasons">{REASONS.map(r=><button key={r} type="button" className="chip" aria-pressed={reason===r} onClick={()=>setReason(r)}>{r}</button>)}</div>
   <label className="field"><span>Credit note date</span><input aria-label="Credit note date" type="date" required min={invoiceDate} max={today} value={date} onChange={e=>setDate(e.target.value)}/></label>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="form-footer"><button type="button" className="secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button className="primary" disabled={busy||net<=0}>{busy?'Issuing…':'Issue credit note for '+fmt(net+vat)}</button></div>
  </form>)}
 </section>;
}
