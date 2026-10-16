'use client';
import {Fragment,useRef,useState,useSyncExternalStore} from 'react';
import {downloadXlsx,tableToRows} from '@/lib/xlsx-export';
import {ChevronDown,ChevronRight,Search,X,FileSpreadsheet} from 'lucide-react';
// Building blocks for the "Analytical" layout that pages can offer next to their classic layout:
// a table with filter chips and group-by chips.

// Layout choice per page, kept in this browser (falls back to memory when storage is blocked).
const memory=new Map<string,string>(),listeners=new Set<()=>void>();
const subscribe=(l:()=>void)=>{listeners.add(l);window.addEventListener('storage',l);return()=>{listeners.delete(l);window.removeEventListener('storage',l)}};
export function useLayoutChoice<T extends string>(key:string,options:readonly T[],fallback:T){
 const read=()=>{let v=memory.get(key);if(v===undefined)try{v=localStorage.getItem(key)??undefined}catch{}return options.includes(v as T)?v as T:fallback};
 const value=useSyncExternalStore(subscribe,read,()=>fallback);
 const set=(v:T)=>{memory.set(key,v);try{localStorage.setItem(key,v)}catch{}listeners.forEach(l=>l())};
 return [value,set] as const;
}
export function LayoutSwitch<T extends string>({value,onChange,options,label='Layout'}:{value:T;onChange:(v:T)=>void;options:readonly {value:T;label:string;icon?:React.ElementType}[];label?:string}){return <div className="seg layout-switch" role="group" aria-label={label}>{options.map(o=>{const Icon=o.icon;return <button key={o.value} type="button" aria-pressed={value===o.value} onClick={()=>onChange(o.value)}>{Icon&&<Icon size={16}/>}{o.label}</button>})}</div>}


export type Column<T>={id:string;label:string;numeric?:boolean;highlight?:boolean;cell:(row:T)=>React.ReactNode;total?:(rows:T[])=>React.ReactNode};
export type Option<T>={id:string;label:string;test:(row:T)=>boolean};
export type Grouping<T>={id:string;label:string;key:(row:T)=>string};
// A searchable table: one filter chip at a time, any number of group-by chips. Selected groupings
// combine into one group per row ("Tenant — Oct 2026"), each with its own subtotal row, which folds.
export function GroupedTable<T>({title,rows,columns,filters,groupings,initialGroups=[],search,rowKey,empty='Nothing here yet.'}:{title:string;rows:T[];columns:Column<T>[];filters:Option<T>[];groupings:Grouping<T>[];initialGroups?:string[];search:(row:T)=>string;rowKey:(row:T)=>string;empty?:string}){
 const tableRef=useRef<HTMLTableElement>(null),[filter,setFilter]=useState(filters[0]?.id),[groups,setGroups]=useState<string[]>(initialGroups),[query,setQuery]=useState(''),[folded,setFolded]=useState<Set<string>>(new Set());
 const q=query.trim().toLowerCase(),test=filters.find(f=>f.id===filter)?.test??(()=>true);
 const shown=rows.filter(r=>test(r)&&(!q||search(r).toLowerCase().includes(q)));
 const active=groupings.filter(g=>groups.includes(g.id));
 const buckets=new Map<string,T[]>();
 for(const r of shown){const k=active.map(g=>g.key(r)).join(' — ');buckets.set(k,[...(buckets.get(k)||[]),r])}
 const toggleGroup=(id:string)=>{setGroups(gs=>gs.includes(id)?gs.filter(x=>x!==id):groupings.map(g=>g.id).filter(x=>x===id||gs.includes(x)));setFolded(new Set())};
 const fold=(k:string)=>setFolded(f=>{const n=new Set(f);if(n.has(k))n.delete(k);else n.add(k);return n});
 const cells=(r:T)=>columns.map(c=><td key={c.id} className={(c.numeric?'num':'')+(c.highlight?' hl':'')}>{c.cell(r)}</td>);
 const lead=Math.max(1,columns.findIndex(c=>c.total));
 const totals=(list:T[])=>columns.slice(lead).map(c=><td key={c.id} className={(c.numeric?'num':'')+(c.highlight?' hl':'')}>{c.total?.(list)}</td>);
 return <section className="surface grouped-table" aria-label={title}>
  <div className="gt-head"><h2>{title}</h2><span className="gt-count">{shown.length} of {rows.length}</span><div className="search"><Search size={16}/><input aria-label={'Search '+title.toLowerCase()} placeholder="Search…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" className="search-clear" aria-label="Clear search" onClick={()=>setQuery('')}><X size={15}/></button>}</div><button type="button" className="secondary gt-excel" disabled={!shown.length} onClick={()=>tableRef.current&&downloadXlsx(title,tableToRows(tableRef.current),title.toLowerCase().replace(/\W+/g,'-'))}><FileSpreadsheet size={16}/>Excel</button></div>
  <div className="gt-chips"><div className="chip-set" role="group" aria-label="Show">{filters.map(f=><button key={f.id} type="button" className="chip" aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)}>{f.label}<span className="chip-count">{rows.filter(f.test).length}</span></button>)}</div><span className="gt-divider" aria-hidden="true"/><div className="chip-set" role="group" aria-label="Group by"><span className="gt-label">Group by</span>{groupings.map(g=><button key={g.id} type="button" className="chip" aria-pressed={groups.includes(g.id)} onClick={()=>toggleGroup(g.id)}>{g.label}</button>)}{groups.length>0&&<button type="button" className="chip clear" onClick={()=>{setGroups([]);setFolded(new Set())}}>Clear<X size={13}/></button>}</div></div>
  {shown.length?<div className="table-scroll"><table className="gt-table" ref={tableRef}><thead><tr>{columns.map(c=><th key={c.id} scope="col" className={(c.numeric?'num':'')+(c.highlight?' hl':'')}>{c.label}</th>)}</tr></thead>
   <tbody>{active.length?[...buckets].map(([k,list])=><Fragment key={k}><tr className="gt-group"><td colSpan={lead}><button type="button" aria-expanded={!folded.has(k)} onClick={()=>fold(k)}>{folded.has(k)?<ChevronRight size={16}/>:<ChevronDown size={16}/>}{k||'—'}<small>({list.length})</small></button></td>{totals(list)}</tr>{!folded.has(k)&&list.map(r=><tr key={rowKey(r)}>{cells(r)}</tr>)}</Fragment>):shown.map(r=><tr key={rowKey(r)}>{cells(r)}</tr>)}</tbody>
   <tfoot><tr className="gt-total"><td colSpan={lead}>Total</td>{totals(shown)}</tr></tfoot></table></div>
  :<div className="empty compact"><h3>{q?'No matches':'Nothing to show'}</h3><p>{q?'Try another search.':empty}</p></div>}
 </section>;
}
export function Progress({value}:{value:number}){const pct=Math.max(0,Math.min(100,Math.round(value*100)));return <span className="progress" role="img" aria-label={pct+'% collected'}><b>{pct}%</b><span className="progress-track"><span style={{width:pct+'%'}}/></span></span>}
