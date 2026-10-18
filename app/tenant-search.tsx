'use client';
import {useEffect,useState} from 'react';
import {ChevronDown} from 'lucide-react';
// Company / tenant field with a smart search: typing shows existing tenants and customers that match (name, TRN,
// contact); picking one fills their contact, TRN, billing address and licence. Typing a new name is fine too.
export type TenantPick={company:string;contact:string;email:string;phone:string;trn:string;billingAddress:string;licenseNumber:string;licenseExpiry:string;from:string};
type Party={company?:string;name?:string;contact?:string;email?:string;phone?:string;trn?:string;billingAddress?:string;licenseNumber?:string;licenseExpiry?:string;code?:string;start?:string};
export function tenantList(offices:Party[],leases:{office?:Party}[],customers:Party[]):TenantPick[]{
 const out=new Map<string,TenantPick&{at:string}>(),key=(n:string,t:string)=>t?'trn:'+t:'name:'+n.trim().toLowerCase();
 const add=(o:Party,from:string,at:string)=>{const company=String(o.company||o.name||'').trim();if(!company)return;const k=key(company,o.trn||''),was=out.get(k);if(was&&was.at>=at)return;
  out.set(k,{company,contact:o.contact||'',email:o.email||'',phone:o.phone||'',trn:o.trn||'',billingAddress:o.billingAddress||'',licenseNumber:o.licenseNumber||'',licenseExpiry:o.licenseExpiry||'',from,at})};
 for(const c of customers)add(c,'Customer','0');
 for(const l of leases)if(l.office)add(l.office,'Past tenant · '+(l.office.code||''),l.office.start||'1');
 for(const o of offices)if(o.company)add(o,'Tenant · '+o.code,o.start||'2');
 return [...out.values()].sort((a,b)=>a.company.localeCompare(b.company)).map(t=>{const {at,...rest}=t;void at;return rest});
}
export function TenantSearch({value,onChange,onPick,list,required}:{value:string;onChange:(v:string)=>void;onPick:(t:TenantPick)=>void;list:TenantPick[];required?:boolean}){
 const [open,setOpen]=useState(false),[active,setActive]=useState(0);
 const q=value.trim().toLowerCase(),picked=list.some(t=>t.company===value),hits=(q&&!picked?list.filter(t=>[t.company,t.trn,t.contact].join(' ').toLowerCase().includes(q)):list).slice(0,60);
 const pick=(t:TenantPick)=>{onPick(t);setOpen(false)},shown=open&&hits.length>0;
 // While the list is open, Escape closes the list only: the dialog around it checks this mark and stays open.
 useEffect(()=>{document.body.toggleAttribute('data-picker-open',shown);return()=>{document.body.removeAttribute('data-picker-open')}},[shown]);
 return <label className="field full tenant-search"><span>Company / tenant{required?' *':''}</span>
  <span className="tenant-box"><input aria-label="Company / tenant" role="combobox" aria-expanded={open&&hits.length>0} aria-controls="tenant-hits" aria-autocomplete="list" autoComplete="off" required={required} value={value}
   onChange={e=>{onChange(e.target.value);setOpen(true);setActive(0)}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)}
   onKeyDown={e=>{if(e.key==='ArrowDown'&&!open){setOpen(true);return}if(!open||!hits.length)return;if(e.key==='ArrowDown'){e.preventDefault();setActive((active+1)%hits.length)}else if(e.key==='ArrowUp'){e.preventDefault();setActive((active-1+hits.length)%hits.length)}else if(e.key==='Enter'){e.preventDefault();pick(hits[active])}else if(e.key==='Escape')setOpen(false)}}/><button type="button" className="tenant-toggle" aria-label="Show customers" tabIndex={-1} onMouseDown={e=>{e.preventDefault();setOpen(!open)}}><ChevronDown size={16}/></button></span>
  <small className="field-hint">{list.length?'Pick from your customers (list opens on click), or type to search; a new name can be typed too.':'No customers yet: type the tenant name.'}</small>
  {open&&hits.length>0&&<ul id="tenant-hits" role="listbox" className="tenant-hits">{hits.map((t,i)=><li key={t.company+t.trn} role="option" aria-selected={i===active} onMouseDown={e=>{e.preventDefault();pick(t)}} onMouseEnter={()=>setActive(i)}><b>{t.company}</b><small>{[t.from,t.trn&&'TRN '+t.trn,t.contact].filter(Boolean).join(' · ')}</small></li>)}</ul>}
 </label>;
}
