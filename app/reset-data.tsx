'use client';
import {useEffect,useState} from 'react';
import {AlertTriangle,Download,CheckCircle2,Trash2} from 'lucide-react';
import {toast} from 'sonner';
// Reset data (Advanced settings, super admin only; Admin #831). Step 1 downloads a backup of exactly what will be
// deleted; step 2, typing RESET, deletes it. The server refuses the reset if the data changed after that backup.
type Counts={offices:number;leases:number;payments:number;documents:number;customers:number};
type Kept={invoices:number;creditNotes:number;offices:string[];payments:number;customers:number};
type Plan={deleted:Counts;kept:Kept;last:{at:string;byName:string}|null};
const n=(v:number,one:string,many=one+'s')=>v+' '+(v===1?one:many);
const what=(c:Counts)=>[n(c.offices,'office'),n(c.leases,'lease'),n(c.payments,'payment'),n(c.documents,'document'),n(c.customers,'customer')].join(' · ');
export function ResetData({api,reload,today}:{api:(path:string,body:unknown)=>Promise<unknown>;reload:()=>Promise<void>;today:string}){
 const [plan,setPlan]=useState<Plan|null>(null),[fingerprint,setFingerprint]=useState(''),[typed,setTyped]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const load=()=>api('/api/reset',{action:'plan'}).then(p=>setPlan(p as Plan),(e:Error)=>setError(e.message));
 useEffect(()=>{void load()},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const empty=!!plan&&Object.values(plan.deleted).every(v=>!v);
 const backup=async()=>{setBusy('backup');setError('');try{const file=await api('/api/reset',{action:'backup'}) as {fingerprint:string;willDelete:Counts;kept:Kept};const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='bhb-backup-before-reset-'+today+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
  setFingerprint(file.fingerprint);setPlan(p=>p&&{...p,deleted:file.willDelete,kept:file.kept});toast.success('Backup downloaded. Keep it safe before you reset.')}catch(e){setError((e as Error).message)}finally{setBusy('')}};
 const reset=async()=>{if(typed!=='RESET'||!fingerprint)return;setBusy('reset');setError('');try{const r=await api('/api/reset',{action:'reset',confirm:'RESET',fingerprint}) as {deleted:Counts};toast.success('Data reset: '+what(r.deleted)+' deleted.');setFingerprint('');setTyped('');await reload();await load()}catch(e){setError((e as Error).message);setFingerprint('')}finally{setBusy('')}};
 return <section className="surface reset-zone" aria-labelledby="reset-title"><h2 id="reset-title"><AlertTriangle size={18}/>Reset data</h2>
  <p>Deletes the offices, leases, payments (rent and expenses), documents and customers of both branches. Tax invoices and credit notes are never deleted, nor the offices, payments and customers they point to. Employees, logins, roles, settings, enquiries and to-dos stay. Uploaded files are not erased from storage; the backup lists them so they can be linked again.</p>
  {plan?<p className="reset-counts">{empty?'Nothing to delete.':<><b>Will delete:</b> {what(plan.deleted)}.</>}{(plan.kept.offices.length>0||plan.kept.payments>0||plan.kept.customers>0)&&<> <b>Kept because of tax invoices:</b> {[plan.kept.offices.length&&n(plan.kept.offices.length,'office')+' ('+plan.kept.offices.slice(0,8).join(', ')+(plan.kept.offices.length>8?'…':'')+')',plan.kept.payments&&n(plan.kept.payments,'payment'),plan.kept.customers&&n(plan.kept.customers,'customer')].filter(Boolean).join(', ')}.</>}</p>:!error&&<p className="notes">Checking what would be deleted…</p>}
  {plan?.last&&<p className="notes">Last reset {new Date(plan.last.at).toLocaleString('en-GB',{timeZone:'Asia/Dubai',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} by {plan.last.byName}.</p>}
  <ol className="reset-steps">
   <li><span><b>1. Download a backup</b><small>A file with every record that will be deleted. The reset deletes exactly what is in it.</small></span>{fingerprint?<span className="reset-done"><CheckCircle2 size={16}/>Backup downloaded</span>:<button type="button" className="secondary" disabled={!plan||empty||!!busy} onClick={backup}><Download size={16}/>{busy==='backup'?'Preparing…':'Download backup'}</button>}</li>
   <li><span><b>2. Type RESET to confirm</b><small>This cannot be undone here; the backup file is your copy.</small></span><span className="reset-confirm"><input aria-label="Type RESET to confirm" placeholder="RESET" autoComplete="off" disabled={!fingerprint||!!busy} value={typed} onChange={e=>setTyped(e.target.value)}/><button type="button" className="danger-button" disabled={!fingerprint||typed!=='RESET'||!!busy} onClick={reset}><Trash2 size={16}/>{busy==='reset'?'Deleting…':'Delete data'}</button></span></li>
  </ol>
  {error&&<p role="alert" className="form-error">{error}</p>}
 </section>;
}
