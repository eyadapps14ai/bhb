'use client';
import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
// "+ New customer" from the New lease tenant step (Admin #826): the same details as on the Customers page, saved as a
// customer, then used as the tenant of the lease being made, without leaving the lease form.
export type NewCustomer={name:string;contact:string;email:string;phone:string;trn:string;billingAddress:string};
export function QuickCustomer({open,initialName,onSave,onClose}:{open:boolean;initialName:string;onSave:(c:NewCustomer)=>Promise<void>;onClose:()=>void}){
 const [f,setF]=useState<NewCustomer>({name:initialName,contact:'',email:'',phone:'',trn:'',billingAddress:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const field=(label:string,k:keyof NewCustomer,extra:{required?:boolean;pattern?:string;type?:string}={})=><label className={'field'+(k==='billingAddress'?' full':'')}><span>{label}{extra.required?' *':''}</span><input aria-label={label} required={extra.required} pattern={extra.pattern} type={extra.type||'text'} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></label>;
 return <Dialog open={open} onOpenChange={v=>!v&&!busy&&onClose()}><DialogContent className="form-dialog"><DialogTitle>New customer</DialogTitle><DialogDescription>Saved on the Customers page and used as the tenant of this lease.</DialogDescription>
  <form onSubmit={async e=>{e.preventDefault();e.stopPropagation();setBusy(true);setError('');try{await onSave({...f,name:f.name.trim()})}catch(err){setError((err as Error).message)}finally{setBusy(false)}}}><div className="form-grid">
   {field('Company or person','name',{required:true})}{field('Contact person','contact')}{field('Email','email',{type:'email'})}{field('Phone','phone')}{field('TRN (15 digits, if registered)','trn',{pattern:'[0-9]{15}'})}{field('Billing address','billingAddress')}
  </div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-footer"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save customer'}</button></div></form>
 </DialogContent></Dialog>;
}
