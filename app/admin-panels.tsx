'use client';
import {useState} from 'react';
import {toast} from 'sonner';
import {Plus,Lock,KeyRound,BadgePercent} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {BRANCHES,SUPER_ADMIN,DEFAULT_RATES,pages,components,contractValue,type Access,type Role,type Level} from '@/lib/access';
import type {Office} from '@/lib/records';
export type Person={id:string;name:string;email:string;roleId:string;branches:string[];active:boolean;employeeId:string};
export type SalesStaff={id:string;name:string;branch:string;active:boolean;commissionNew?:number;commissionRenewal?:number};
export type StaffItem={id:string;name:string;job:string;branch:string};
const fmt=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:2}).format(n);
const showDate=(s:string)=>s?new Date(s+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
const monthLabel=(mo:string)=>new Date(mo+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
const levels:[Level,string][]=[['none','Hidden'],['view','View'],['edit','Edit']];

// Users & roles: logins (role, branches, linked employee) and the permission matrix by page and component.
export function UsersPanel({people,roles,staffList,me,api,reload}:{people:Person[];roles:Role[];staffList:StaffItem[];me:Access;api:(path:string,body:unknown)=>Promise<any>;reload:()=>Promise<void>}){
 const [draft,setDraft]=useState<(Partial<Person>&{password?:string})|null>(null),[matrix,setMatrix]=useState<Role[]>(roles),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const roleName=(id:string)=>roles.find(r=>r.id===id)?.name||id,employee=(id:string)=>staffList.find(e=>e.id===id);
 const saveUser=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const r=await api('/api/users',draft);setDraft(null);await reload();toast.success('User saved');if(r.signOut)window.location.href='/login';}catch(err){setError((err as Error).message)}finally{setBusy(false)}};
 const saveMatrix=async()=>{setBusy(true);try{await api('/api/roles',{roles:matrix});await reload();toast.success('Permissions saved')}catch(err){toast.error((err as Error).message)}finally{setBusy(false)}};
 const setLevel=(roleId:string,page:string,level:Level)=>setMatrix(m=>m.map(r=>r.id===roleId?{...r,pages:{...r.pages,[page]:level}}:r));
 const setComponent=(roleId:string,c:string,on:boolean)=>setMatrix(m=>m.map(r=>r.id===roleId?{...r,components:{...r.components,[c]:on}}:r));
 const addRole=()=>{const name=window.prompt('Name of the new role (for example Secretary)')?.trim();if(!name)return;const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'role';if(matrix.some(r=>r.id===id)){toast.error('A role with this name already exists');return}const base=matrix.find(r=>r.id==='sales')!;setMatrix(m=>[...m,{...base,id,name,pages:Object.fromEntries(pages.map(([k])=>[k,'none'])) as Role['pages'],components:Object.fromEntries(components.map(([k])=>[k,false])) as Role['components']}])};
 return <div className="admin-grid">
  <section className="surface"><div className="surface-head"><h2>Staff <span className="count">{people.length}</span></h2><button className="primary" onClick={()=>{setError('');setDraft({name:'',email:'',roleId:'sales',branches:['BHB'],active:true,employeeId:'',password:''})}}><Plus size={17}/>Add user</button></div>
   {me.bootstrap&&<p className="setup-note"><Lock size={16}/>You are signed in with the shared setup password. Add yourself as a Super admin, then sign in with your own email; the shared password stops working once a super admin exists.</p>}
   {people.length?<div className="table-scroll"><table className="admin-table"><thead><tr><th>Name</th><th>Role</th><th>Branches</th><th className="opt">Employee</th><th>Status</th><th/></tr></thead><tbody>{people.map(p=><tr key={p.id} className={p.active?undefined:'inactive'}><td><strong>{p.name}</strong><small>{p.email}</small></td><td>{roleName(p.roleId)}</td><td>{p.roleId===SUPER_ADMIN?'All':p.branches.join(', ')||'—'}</td><td className="opt">{employee(p.employeeId)?<>{employee(p.employeeId)!.name}<small>{employee(p.employeeId)!.job} · {employee(p.employeeId)!.branch}</small></>:'Not linked'}</td><td><span className={'badge '+(p.active?'good':'neutral')}>{p.active?'Active':'Inactive'}</span></td><td><button className="text-button" onClick={()=>{setError('');setDraft({...p,password:''})}}>Edit</button></td></tr>)}</tbody></table></div>:<div className="empty compact"><h3>No staff accounts yet</h3><p>Add each person with their role and branches.</p></div>}
  </section>
  <section className="surface"><div className="surface-head"><h2>Permissions</h2><div className="actions"><button className="secondary" onClick={addRole}><Plus size={16}/>Add role</button><button className="primary" disabled={busy} onClick={saveMatrix}>Save permissions</button></div></div>
   <div className="table-scroll"><table className="admin-table matrix"><thead><tr><th>Page or component</th>{matrix.map(r=><th key={r.id}>{r.name}{r.id===SUPER_ADMIN&&<Lock size={13} aria-label="Always full access"/>}</th>)}</tr></thead><tbody>
    <tr className="matrix-group"><th colSpan={matrix.length+1}>Pages</th></tr>
    {pages.map(([k,label])=><tr key={k}><th scope="row">{label}</th>{matrix.map(r=><td key={r.id}><select aria-label={label+' for '+r.name} value={r.pages[k]} disabled={r.id===SUPER_ADMIN} onChange={e=>setLevel(r.id,k,e.target.value as Level)}>{levels.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td>)}</tr>)}
    <tr className="matrix-group"><th colSpan={matrix.length+1}>Components</th></tr>
    {components.map(([k,label])=><tr key={k}><th scope="row">{label}</th>{matrix.map(r=><td key={r.id}><input type="checkbox" aria-label={label+' for '+r.name} checked={r.components[k]} disabled={r.id===SUPER_ADMIN} onChange={e=>setComponent(r.id,k,e.target.checked)}/></td>)}</tr>)}
   </tbody></table></div><p className="category-note admin-note">Branches are set per person in Staff. Super admin always has full access to every branch, so nobody can lock themselves out.</p>
  </section>
  <Dialog open={!!draft} onOpenChange={v=>!v&&!busy&&setDraft(null)}><DialogContent className="form-dialog"><DialogTitle>{draft?.id?'Edit user':'Add user'}</DialogTitle><DialogDescription>Each person signs in with this email and their own password.</DialogDescription>{draft&&<form onSubmit={saveUser}><div className="form-grid">
   <label className="field"><span>Name *</span><input required value={draft.name||''} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
   <label className="field"><span>Email *</span><input type="email" required value={draft.email||''} onChange={e=>setDraft({...draft,email:e.target.value})}/></label>
   <label className="field"><span>Role</span><select value={draft.roleId} onChange={e=>setDraft({...draft,roleId:e.target.value})}>{roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
   <fieldset className="field branch-pick"><legend>Branches</legend>{draft.roleId===SUPER_ADMIN?<small>Super admin sees every branch.</small>:BRANCHES.map(b=><label key={b}><input type="checkbox" checked={!!draft.branches?.includes(b)} onChange={e=>setDraft({...draft,branches:e.target.checked?[...(draft.branches||[]),b]:(draft.branches||[]).filter(x=>x!==b)})}/>{b}</label>)}</fieldset>
   <label className="field"><span>Employee record</span><select value={draft.employeeId||''} onChange={e=>{const x=employee(e.target.value);setDraft({...draft,employeeId:e.target.value,name:draft.name||x?.name||''})}}><option value="">Not linked</option>{[...staffList].sort((a,b)=>a.name.localeCompare(b.name)).map(x=><option key={x.id} value={x.id}>{x.name} · {x.job} · {x.branch}</option>)}</select><small>Link a salesperson to see their own commission.</small></label>
   <label className="field"><span><KeyRound size={14}/> {draft.id?'New password (leave empty to keep)':'Password *'}</span><input type="password" autoComplete="new-password" minLength={10} required={!draft.id} value={draft.password||''} onChange={e=>setDraft({...draft,password:e.target.value})}/></label>
   <label className="field checkbox-field"><input type="checkbox" checked={draft.active!==false} onChange={e=>setDraft({...draft,active:e.target.checked})}/><span>Active (can sign in)</span></label>
  </div>{error&&<p role="alert" className="form-error">{error}</p>}<div className="form-footer"><button type="button" className="secondary" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save user'}</button></div></form>}</DialogContent></Dialog>
 </div>;
}

export type Deal={key:string;code:string;company:string;sellerId:string;dealType:'New'|'Renewal';start:string;end:string;months:number;value:number;rate:number;commission:number;status:'Current'|'Cancelled'};
// Every lease with a seller: current offices plus cancelled leases (their snapshot). Commission is the seller's rate
// (new or renewal) % of the whole contract value, earned in the month the lease starts.
export function salesDeals(offices:Office[],leases:any[],staff:SalesStaff[]):Deal[]{
 const seller=(id:string)=>staff.find(t=>t.id===id);
 return [...offices.filter(o=>o.salesEmployeeId&&o.start).map(o=>({o,key:o.id,status:'Current' as const})),...leases.filter(l=>l.office?.salesEmployeeId&&l.office?.start).map(l=>({o:l.office as Office,key:l.id,status:'Cancelled' as const}))]
  .map(({o,key,status})=>{const m=seller(o.salesEmployeeId),type=o.dealType==='Renewal'?'Renewal':'New',rate=type==='Renewal'?(m?.commissionRenewal??DEFAULT_RATES.commissionRenewal):(m?.commissionNew??DEFAULT_RATES.commissionNew),{months,value}=contractValue(o);return {key,code:o.code,company:o.company,sellerId:o.salesEmployeeId,dealType:type,start:o.start,end:o.end,months,value,rate,commission:Math.round(value*rate)/100,status}});
}
// Sales commission page: by month and salesperson. A salesperson without "see every commission" only sees their own deals.
export function SalesPanel({offices,leases,salesStaff,me}:{offices:Office[];leases:any[];salesStaff:SalesStaff[];me:Access}){
 const seeAll=me.components.allCommissions,own=me.employeeId||'';
 const [month,setMonth]=useState(new Date().toISOString().slice(0,7)),[person,setPerson]=useState(seeAll?'all':own);
 const member=(id:string)=>salesStaff.find(t=>t.id===id);
 const deals=salesDeals(offices,leases,salesStaff).filter(d=>seeAll||(own&&d.sellerId===own));
 const mine=deals.filter(d=>person==='all'||d.sellerId===person),inMonth=mine.filter(d=>d.start.slice(0,7)===month);
 const sum=(list:Deal[],k:'value'|'commission')=>list.reduce((a,d)=>a+d[k],0);
 const year=month.slice(0,4),months=Array.from({length:12},(_,i)=>year+'-'+String(i+1).padStart(2,'0'));
 const people=salesStaff.filter(t=>t.active||deals.some(d=>d.sellerId===t.id));
 if(!seeAll&&!own)return <div className="empty"><BadgePercent size={40}/><h3>Your login is not linked to an employee yet</h3><p>Ask an admin to link your login to your Sales employee record in Users &amp; roles. Your commission then shows here.</p></div>;
 return <div className="sales-panel">
  <section className="surface cash-hero"><div className="cash-hero-head"><h2>Commission · {monthLabel(month)}</h2><div className="controls"><label>Month<input type="month" value={month} onChange={e=>e.target.value&&setMonth(e.target.value)}/></label>{seeAll&&<label>Sales person<select value={person} onChange={e=>setPerson(e.target.value)}><option value="all">Everyone</option>{people.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}</div></div>
   <div className="cash-hero-body sales-figures"><div className="hero-net"><span className="hero-label"><BadgePercent size={14}/>Commission</span><strong className="hero-value">{fmt(sum(inMonth,'commission'))}</strong><small>{person==='all'?'All salespeople':member(person)?.name||me.name}</small></div><div className="hero-stat"><span className="hero-label">Leases started</span><strong>{inMonth.length}</strong><small>{inMonth.filter(d=>d.dealType==='New').length} new · {inMonth.filter(d=>d.dealType==='Renewal').length} renewal</small></div><div className="hero-stat"><span className="hero-label">Contract value</span><strong>{fmt(sum(inMonth,'value'))}</strong><small>Rent over each lease, excl. VAT and deposit</small></div><div className="hero-stat"><span className="hero-label">{year} so far</span><strong>{fmt(sum(mine.filter(d=>d.start.slice(0,4)===year&&d.start.slice(0,7)<=month),'commission'))}</strong><small>Commission January to {monthLabel(month)}</small></div></div></section>
  <section className="surface"><div className="surface-head"><h2>Leases started in {monthLabel(month)} <span className="count">{inMonth.length}</span></h2></div>{inMonth.length?<DealTable deals={inMonth} seller={seeAll?(id=>member(id)?.name||'Former staff'):undefined}/>:<div className="empty compact"><BadgePercent size={34}/><h3>No leases started this month</h3><p>Set Sold by and Deal type on an office lease to count it here.</p></div>}</section>
  <section className="surface"><div className="surface-head"><h2>{year} by month</h2></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Month</th><th className="numeric">Leases</th><th className="numeric opt">Contract value</th><th className="numeric">Commission</th></tr></thead><tbody>{months.map(mo=>{const list=mine.filter(d=>d.start.slice(0,7)===mo);return <tr key={mo} className={mo===month?'current':undefined}><td><button className="text-button" onClick={()=>setMonth(mo)}>{monthLabel(mo)}</button></td><td className="numeric">{list.length}</td><td className="numeric opt">{fmt(sum(list,'value'))}</td><td className="numeric">{fmt(sum(list,'commission'))}</td></tr>})}<tr className="total"><th scope="row">Year</th><td className="numeric">{mine.filter(d=>d.start.slice(0,4)===year).length}</td><td className="numeric opt">{fmt(sum(mine.filter(d=>d.start.slice(0,4)===year),'value'))}</td><td className="numeric">{fmt(sum(mine.filter(d=>d.start.slice(0,4)===year),'commission'))}</td></tr></tbody></table></div></section>
 </div>;
}
export function DealTable({deals,seller}:{deals:Deal[];seller?:(id:string)=>string}){
 return <div className="table-scroll"><table className="admin-table"><thead><tr><th>Office / tenant</th>{seller&&<th>Sold by</th>}<th>Type</th><th className="opt">Lease</th><th className="numeric opt">Months</th><th className="numeric opt">Contract value</th><th className="numeric opt">Rate</th><th className="numeric">Commission</th></tr></thead><tbody>{deals.map(d=><tr key={d.key}><td><strong>{d.code}</strong><small>{d.company||'—'}{d.status==='Cancelled'?' · lease later cancelled':''}</small></td>{seller&&<td>{seller(d.sellerId)}</td>}<td>{d.dealType}</td><td className="opt">{showDate(d.start)} – {showDate(d.end)}</td><td className="numeric opt">{d.months}</td><td className="numeric opt">{fmt(d.value)}</td><td className="numeric opt">{d.rate}%</td><td className="numeric"><strong>{fmt(d.commission)}</strong></td></tr>)}</tbody></table></div>;
}
