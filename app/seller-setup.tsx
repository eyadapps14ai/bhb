'use client';
import {useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
// The first tax invoice of a branch: the law needs your company (legal name, address, TRN) printed as the supplier.
// Instead of sending people to Accounts, a super admin fills them in right here once; the invoice form then opens with
// the draft unchanged. Everyone else is asked to get a super admin to do it once.
type Seller={name:string;address:string;trn:string;email:string;phone:string;bankName:string;accountName:string;iban:string};
export function SellerSetup({open,branch,canSave,onSave,onCancel}:{open:boolean;branch:string;canSave:boolean;onSave:(s:Seller)=>Promise<void>;onCancel:()=>void}){
 const [f,setF]=useState<Seller>({name:'',address:'',trn:'',email:'',phone:'',bankName:'',accountName:'',iban:''}),[bank,setBank]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const field=(label:string,k:keyof Seller,extra:{required?:boolean;pattern?:string;type?:string;placeholder?:string}={})=><label className={'field'+(k==='address'?' full':'')}><span>{label}{extra.required?' *':''}</span><input aria-label={label} required={extra.required} pattern={extra.pattern} type={extra.type||'text'} placeholder={extra.placeholder} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></label>;
 return <Dialog open={open} onOpenChange={v=>!v&&!busy&&onCancel()}><DialogContent className="form-dialog"><DialogTitle>Your company on tax invoices · {branch}</DialogTitle>
  <DialogDescription>{canSave?'Fill these once: they are printed as the supplier on every tax invoice of '+branch+', as UAE law requires. Then your invoice opens right away. You can change them later in Accounts.':'Every tax invoice must show your company as the supplier (legal name, address, TRN). A super admin fills them in once for '+branch+'; ask one to create the first invoice of this branch.'}</DialogDescription>
  {canSave?<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onSave(f)}catch(err){setError((err as Error).message)}finally{setBusy(false)}}}><div className="form-grid">
   {field('Legal business name','name',{required:true})}{field('TRN (15 digits)','trn',{required:true,pattern:'[0-9]{15}'})}{field('Address','address',{required:true})}{field('Email','email',{type:'email'})}{field('Phone','phone')}
   {!bank?<button type="button" className="text-button full" onClick={()=>setBank(true)}>Add bank details for payments (optional)</button>:<>{field('Bank name','bankName')}{field('Account name','accountName')}{field('IBAN (AE + 21 digits)','iban',{pattern:'\\s*[Aa][Ee]( ?[0-9]){21}\\s*',placeholder:'AE07 0331 2345 6789 0123 456'})}</>}
  </div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-footer"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Not now</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save and continue'}</button></div></form>
  :<div className="form-footer"><button type="button" className="primary" onClick={onCancel}>OK</button></div>}
 </DialogContent></Dialog>;
}
