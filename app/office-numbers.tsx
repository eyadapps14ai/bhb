'use client';
import {useState} from 'react';
import {toast} from 'sonner';
import {officeCode,type OfficeNumbering} from '@/lib/records';
// Advanced settings > Office numbers (Admin #1069): the prefix of each branch and the ending of virtual offices, set
// once. Add office and Many offices then only ask for the number and show the code it is saved as.
export function OfficeNumbers({value,api,reload}:{value:OfficeNumbering;api:(path:string,body:unknown)=>Promise<unknown>;reload:()=>Promise<void>}){
 const [f,setF]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await api('/api/settings',{action:'officeNumbering',...f});await reload();toast.success('Office numbers saved')}catch(err){setError((err as Error).message)}finally{setBusy(false)}};
 const input=(label:string,v:string,set:(v:string)=>void)=><label className="field"><span>{label}</span><input aria-label={label} value={v} maxLength={20} onChange={e=>set(e.target.value)}/></label>;
 return <section className="surface office-numbers" aria-labelledby="office-numbers-title"><h2 id="office-numbers-title">Office numbers</h2>
  <p className="notes">How new office codes are written. When adding offices you type only the number; the code gets the branch prefix, and virtual offices get the ending.</p>
  <form onSubmit={save}><div className="form-grid">
   {input('Prefix for BHB',f.prefixes.BHB,v=>setF({...f,prefixes:{...f.prefixes,BHB:v}}))}{input('Prefix for 111',f.prefixes['111'],v=>setF({...f,prefixes:{...f.prefixes,'111':v}}))}
   {input('Ending for virtual offices',f.virtualSuffix,v=>setF({...f,virtualSuffix:v}))}
   <p className="field-hint full on-preview">Examples: {officeCode('12','BHB','Physical',f)} · {officeCode('12','BHB','Virtual',f)} · {officeCode('4','111','Physical',f)} · {officeCode('4','111','Virtual',f)}. Existing offices keep their codes.</p>
  </div>{error&&<p role="alert" className="form-error">{error}</p>}<div className="form-footer"><button className="primary" disabled={busy}>{busy?'Saving…':'Save office numbers'}</button></div></form>
 </section>;
}
