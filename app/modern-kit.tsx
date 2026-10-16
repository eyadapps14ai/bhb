'use client';
import {Fragment,useState} from 'react';
import {ChevronRight,ChevronDown,TriangleAlert,Download,Search,X} from 'lucide-react';
// Modern theme building blocks every page shares (the Cash flow design applied everywhere): a hero with one big
// figure and three stats, a "needs you" strip, cards with share bars or rows, and an Analysis that groups any
// records with share-of-largest bars and a CSV export.
export const n0=(n:number)=>new Intl.NumberFormat('en-AE',{maximumFractionDigits:0}).format(Math.round(n));
export const aed0=(n:number)=>(n<0?'− ':'')+'AED '+n0(Math.abs(n));
export const plural=(n:number,w:string,many=w+'s')=>n0(n)+' '+(n===1?w:many);
export const pct=(part:number,whole:number)=>whole?Math.round(part/whole*100):0;
const SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const shortDate=(iso:string)=>iso?+iso.slice(8,10)+' '+SHORT[+iso.slice(5,7)-1]+' '+iso.slice(0,4):'No date';
export const monthKey=(iso:string)=>iso?SHORT[+iso.slice(5,7)-1]+' '+iso.slice(0,4):'No date';
const Box=({onClick,className,children}:{onClick?:()=>void;className:string;children:React.ReactNode})=>onClick?<button type="button" className={className} onClick={onClick}>{children}</button>:<div className={className+' static'}>{children}</div>;

export type Stat={label:React.ReactNode;value:string;sub?:React.ReactNode;tone?:'up'|'down';dot?:string;onClick?:()=>void};
// value is the big figure; unit sits before it (AED) and bar is a split of [share, colour] pairs.
export function MHero({label,chip,value,unit,bar,text,onClick,stats}:{label:string;chip?:{text:string;up:boolean}|null;value:string;unit?:string;bar?:[number,string][];text:React.ReactNode;onClick?:()=>void;stats:Stat[]}){
 const total=(bar||[]).reduce((a,b)=>a+b[0],0);
 return <section className="m-card m-hero">
  <Box className="m-net" onClick={onClick}><span className="m-label">{label}{chip&&<span className={'m-chip '+(chip.up?'m-up':'m-down')}>{chip.text}</span>}</span>
   <strong className="m-big">{unit&&<small>{unit}</small>}{value}</strong>
   {bar&&<span className="m-split" role="img" aria-label={label}>{total>0&&bar.map(([v,c],i)=><span key={i} style={{width:v/total*100+'%',background:c}}/>)}</span>}
   <p>{text}</p></Box>
  {stats.map((s,i)=><Box key={i} className="m-stat" onClick={s.onClick}><span className="m-label">{s.dot&&<i style={{background:s.dot}}/>}{s.label}</span><strong>{s.value}</strong>{s.sub!==undefined&&<small className={'m-delta'+(s.tone?' m-'+s.tone:'')}>{s.sub}</small>}</Box>)}
 </section>;
}

export type Chip={label:string;onClick:()=>void};
export function MAttention({title,sub,chips}:{title:string;sub?:React.ReactNode;chips:Chip[]}){
 return <section className="m-attention"><span className="m-attention-icon"><TriangleAlert size={18}/></span><p><b>{title}</b>{sub&&<> · {sub}</>}</p><div>{chips.map(c=><button key={c.label} type="button" onClick={c.onClick}>{c.label}<ChevronRight size={16}/></button>)}</div></section>;
}

// A card of labelled amounts, each with its share of the card total.
export type Share={label:string;value:number;text:string;onClick?:()=>void};
export function MShares({title,sub,rows,total,empty,note}:{title:string;sub:string;rows:Share[];total?:[string,string];empty:string;note?:string}){
 const sum=rows.reduce((a,r)=>a+r.value,0),shown=rows.filter(r=>r.value>0);
 return <section className="m-card m-list"><h3>{title}</h3><small>{sub}</small>
  {shown.length?shown.map(r=><Box key={r.label} className="m-source" onClick={r.onClick}><span>{r.label}</span><b>{r.text} <em>· {pct(r.value,sum)}%</em></b><span className="m-bar"><span style={{width:r.value/sum*100+'%'}}/></span></Box>):<p className="m-quiet">{empty}</p>}
  {note&&<p className="m-quiet">{note}</p>}
  {total&&<div className="m-total"><span>{total[0]}</span><b>{total[1]}</b></div>}</section>;
}

// A card of rows (label, small line, value) with an optional dark summary box or note at the bottom.
export type Row={label:string;sub?:string;value:React.ReactNode;tone?:'up'|'down';onClick?:()=>void};
export function MRows({title,sub,rows,dark,note,empty}:{title:string;sub:string;rows:Row[];dark?:{label:string;value:string;sub?:string}|null;note?:string;empty?:string}){
 return <section className="m-card m-list"><h3>{title}</h3><small>{sub}</small>
  {rows.length?rows.map((r,i)=><Box key={i} className="m-row" onClick={r.onClick}><span>{r.label}{r.sub&&<small>{r.sub}</small>}</span>{typeof r.value==='string'?<b className={r.tone?'m-'+r.tone:undefined}>{r.value}</b>:r.value}</Box>):<p className="m-quiet">{empty||'Nothing here yet.'}</p>}
  {note&&<p className="m-note">{note}</p>}
  {dark&&<div className="m-dark"><small>{dark.label}</small><strong>{dark.value}</strong>{dark.sub&&<small>{dark.sub}</small>}</div>}</section>;
}

export function MThree({children}:{children:React.ReactNode}){return <div className="m-three">{children}</div>}

// Analysis: pick a Group by option; each group lists its records (or, when the option has a line key, its records
// summed per line) with a share-of-largest bar. Totals and Export CSV follow the current grouping and filter.
// sort: by group total (default) or by the order key (asc or desc; e.g. YYYY-MM for months).
export type MGroupBy<T>={id:string;label:string;key:(r:T)=>string;line?:(r:T)=>string;sort?:'total'|'asc'|'desc';order?:(r:T)=>string;note?:(rows:T[])=>string};
export type MFilter<T>={id:string;label:string;test:(r:T)=>boolean};
type Line={key:string;label:string;sub:string;amount:number;count:number;open?:()=>void};
export function MAnalysis<T>({title,subtitle,rows,groupings,filters,measure,format,describe,summary,filename,search,onOpen,unit}:{title:string;subtitle:string;rows:T[];groupings:MGroupBy<T>[];filters?:MFilter<T>[];measure:(r:T)=>number;format:(n:number)=>string;describe:(r:T)=>{label:string;sub:string};summary:(rows:T[])=>[string,string][];filename:string;search?:(r:T)=>string;onOpen?:(r:T)=>void;unit:string}){
 const [by,setBy]=useState(groupings[0].id),[filter,setFilter]=useState(filters?.[0]?.id||''),[query,setQuery]=useState(''),[folded,setFolded]=useState<Set<string>>(new Set());
 const g=groupings.find(x=>x.id===by)||groupings[0],test=filters?.find(f=>f.id===filter)?.test||(()=>true),q=query.trim().toLowerCase();
 const shown=rows.filter(r=>test(r)&&(!q||!search||search(r).toLowerCase().includes(q)));
 const buckets=new Map<string,T[]>();for(const r of shown){const k=g.key(r)||'—';buckets.set(k,[...(buckets.get(k)||[]),r])}
 const groups=[...buckets].map(([k,list])=>{let lines:Line[];
  if(g.line){const m=new Map<string,Line>();for(const r of list){const l=g.line(r)||'—',e=m.get(l)||{key:k+'|'+l,label:l,sub:'',amount:0,count:0};e.amount+=measure(r);e.count++;m.set(l,e)}lines=[...m.values()].map(l=>({...l,sub:plural(l.count,'record')}))}
  else lines=list.map((r,i)=>{const d=describe(r);return {key:k+'|'+i+'|'+d.label,label:d.label,sub:d.sub,amount:measure(r),count:1,open:onOpen?()=>onOpen(r):undefined}});
  lines.sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount)||a.label.localeCompare(b.label));
  return {key:k,list,lines,total:lines.reduce((a,l)=>a+l.amount,0)}});
 const rank=(x:{key:string;list:T[]})=>g.order?g.order(x.list[0]):x.key;
 groups.sort((a,b)=>g.sort==='asc'?rank(a).localeCompare(rank(b),undefined,{numeric:true}):g.sort==='desc'?rank(b).localeCompare(rank(a),undefined,{numeric:true}):Math.abs(b.total)-Math.abs(a.total));
 const max=Math.max(1e-9,...groups.flatMap(x=>x.lines.map(l=>Math.abs(l.amount)))),boxes=summary(shown).slice(0,3);
 const fold=(k:string)=>setFolded(f=>{const n=new Set(f);if(n.has(k))n.delete(k);else n.add(k);return n});
 const exportCsv=()=>{const c=(v:string|number)=>'"'+String(v).replace(/"/g,'""')+'"';const csv=[[g.label,'Line','Detail',unit].map(c).join(','),...groups.flatMap(x=>x.lines.map(l=>[x.key,l.label,l.sub,Number.isInteger(l.amount)?l.amount:l.amount.toFixed(2)].map(c).join(',')))].join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download=filename+'-by-'+g.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)};
 return <section className="m-card m-analysis"><div className="m-analysis-head"><div><h3>{title}</h3><small>{subtitle}</small></div><div className="m-analysis-tools">{search&&<label className="m-search"><Search size={16}/><input aria-label={'Search '+title.toLowerCase()} placeholder="Search…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" aria-label="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>}</label>}<button type="button" className="secondary" disabled={!shown.length} onClick={exportCsv}><Download size={16}/>Export CSV</button></div></div>
  <div className="m-groupby" role="group" aria-label="Group by"><span>Group by</span>{groupings.map(x=><button key={x.id} type="button" aria-pressed={by===x.id} onClick={()=>{setBy(x.id);setFolded(new Set())}}>{x.label}</button>)}</div>
  {filters&&filters.length>1&&<div className="m-show" role="group" aria-label="Show"><span>Show</span>{filters.map(f=><button key={f.id} type="button" aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)}>{f.label}<em>{rows.filter(f.test).length}</em></button>)}</div>}
  {boxes.length>0&&<div className="m-sum">{boxes.map(([label,value],i)=><div key={label} className={i===boxes.length-1?'dark':undefined}><small>{label}</small><strong>{value}</strong></div>)}</div>}
  {shown.length?<div className="table-scroll"><table className="m-share"><thead><tr><th>{g.label}</th><th>Share of largest</th><th>{unit}</th></tr></thead><tbody>{groups.map(x=><Fragment key={x.key}>
   <tr className="m-group"><td><button type="button" aria-expanded={!folded.has(x.key)} onClick={()=>fold(x.key)}>{folded.has(x.key)?<ChevronRight size={16}/>:<ChevronDown size={16}/>}<b>{x.key}</b><small>{plural(x.list.length,'record')}</small></button></td><td>{g.note?.(x.list)||''}</td><td><b>{format(x.total)}</b></td></tr>
   {!folded.has(x.key)&&x.lines.map(l=><tr key={l.key}><td><span className="m-line">{l.open?<button type="button" className="m-line-open" onClick={l.open}>{l.label}</button>:l.label}<small>{l.sub}</small></span></td><td><span className="m-share-bar"><span className="m-bar"><span style={{width:Math.abs(l.amount)/max*100+'%',background:l.amount<0?'#c98a3c':undefined}}/></span><em>{Math.round(Math.abs(l.amount)/max*100)}%</em></span></td><td className={l.amount<0?'m-down':undefined}>{format(l.amount)}</td></tr>)}</Fragment>)}</tbody></table></div>
  :<p className="m-note">{q?'No matches. Try another search.':'Nothing to show for this choice yet.'}</p>}
 </section>;
}
