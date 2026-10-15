'use client';
import {useMemo,useRef,useState} from 'react';
import {Inbox,MailCheck,Archive,Mails,Search,Mail,Phone,UserPlus,ArrowLeft,Globe,RotateCcw,CheckCircle2,X} from 'lucide-react';
import {toast} from 'sonner';
import type {Enquiry} from '@/lib/enquiries';
import {number as waNumber,WhatsAppIcon} from './whatsapp-panel';
// Website enquiries in an Outlook-style inbox: folders by status, a message list and a reading pane.
type Folder='New'|'Contacted'|'Closed'|'All';
const folders:{id:Folder;label:string;icon:React.ElementType}[]=[{id:'New',label:'New',icon:Inbox},{id:'Contacted',label:'Contacted',icon:MailCheck},{id:'Closed',label:'Closed',icon:Archive},{id:'All',label:'All enquiries',icon:Mails}];
const tz='Asia/Dubai';
const dayOf=(d:Date)=>d.toLocaleDateString('en-CA',{timeZone:tz});
const daysAgo=(iso:string)=>Math.round((Date.parse(dayOf(new Date()))-Date.parse(dayOf(new Date(iso))))/864e5);
const stamp=(iso:string)=>{const d=new Date(iso),n=daysAgo(iso);return n<=0?d.toLocaleTimeString('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit'}):n<7?d.toLocaleDateString('en-GB',{timeZone:tz,weekday:'short'}):d.toLocaleDateString('en-GB',{timeZone:tz,day:'numeric',month:'short'})};
const group=(iso:string)=>{const n=daysAgo(iso);return n<=0?'Today':n===1?'Yesterday':n<7?'Earlier this week':n<31?'Earlier this month':'Older'};
const fullDate=(iso:string)=>new Date(iso).toLocaleString('en-GB',{timeZone:tz,weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const initials=(name:string)=>name.split(/\s+/).map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
export const replyLink=(e:Enquiry)=>{const n=waNumber(e.phone)||waNumber(e.phone.replace(/^\s*0(?=[1-9])/,'+971'));return n?'https://wa.me/'+n+'?text='+encodeURIComponent('Hello '+e.name+', thank you for your enquiry about '+e.service+' at BHB Business Centre.'):''};
export const mailLink=(e:Enquiry)=>'mailto:'+e.email+'?subject='+encodeURIComponent('Your BHB enquiry: '+e.service);
export default function EnquiryInbox({enquiries,error,onStatus,onAddTenant}:{enquiries:Enquiry[];error:string;onStatus:(e:Enquiry,status:Enquiry['status'])=>Promise<void>;onAddTenant:(e:Enquiry)=>void}){
 const [folder,setFolder]=useState<Folder>('New'),[query,setQuery]=useState(''),[pick,setPick]=useState<{id:string|null;index:number}>({id:null,index:0}),[reading,setReading]=useState(false);
 const list=useRef<HTMLDivElement>(null);
 const q=query.trim().toLowerCase();
 const shown=useMemo(()=>enquiries.filter(e=>(folder==='All'||e.status===folder)&&(!q||[e.name,e.email,e.phone,e.service,e.message].some(v=>v.toLowerCase().includes(q)))),[enquiries,folder,q]);
 // When the open enquiry leaves this folder (for example after Mark contacted), the next one in the list opens, as in Outlook.
 const selected=shown.find(e=>e.id===pick.id)??shown[Math.min(pick.index,shown.length-1)]??null,at=selected?shown.indexOf(selected):-1;
 const count=(f:Folder)=>f==='All'?enquiries.length:enquiries.filter(e=>e.status===f).length;
 const choose=(f:Folder)=>{setFolder(f);setPick({id:null,index:0});setReading(false)};
 const open=(e:Enquiry,i:number)=>{setPick({id:e.id,index:i});setReading(true)};
 const move=(i:number)=>{const e=shown[i];if(!e)return;setPick({id:e.id,index:i});list.current?.querySelectorAll<HTMLButtonElement>('.mail-row')[i]?.focus()};
 const keys=(ev:React.KeyboardEvent)=>{if(ev.key==='ArrowDown'||ev.key==='j'){ev.preventDefault();move(at+1)}else if(ev.key==='ArrowUp'||ev.key==='k'){ev.preventDefault();move(Math.max(0,at-1))}else if(ev.key==='Home'){ev.preventDefault();move(0)}else if(ev.key==='End'){ev.preventDefault();move(shown.length-1)}};
 // Replying does not change the status by itself; staff are offered a one-click Mark contacted.
 const replied=(e:Enquiry)=>{if(e.status==='New')toast('Mark '+e.name+' as contacted?',{duration:10000,action:{label:'Mark contacted',onClick:()=>{onStatus(e,'Contacted')}}})};
 const rows:React.ReactNode[]=[];let last='';
 shown.forEach((e,i)=>{const g=group(e.created);if(g!==last){rows.push(<div key={'g'+g} className="mail-group" role="presentation">{g}</div>);last=g}rows.push(<button key={e.id} type="button" className={'mail-row'+(e.status==='New'?' unread':'')+(selected?.id===e.id?' selected':'')} aria-current={selected?.id===e.id?'true':undefined} tabIndex={selected?.id===e.id||(!selected&&i===0)?0:-1} onClick={()=>open(e,i)}><span className="mail-avatar" aria-hidden="true">{initials(e.name)}</span><span className="mail-summary"><span className="mail-line"><strong>{e.name}</strong><time dateTime={e.created}>{stamp(e.created)}</time></span><span className="mail-subject">{e.service}</span><span className="mail-preview">{e.message}</span></span>{e.status==='New'&&<span className="sr-only">Unread</span>}</button>)});
 const wa=selected?replyLink(selected):'';
 const currentFolder=folders.find(f=>f.id===folder)!;
 return <section className={'surface inbox'+(reading?' reading':'')} aria-label="Website enquiries">
  <nav className="mail-folders" aria-label="Enquiry folders"><h2>Folders</h2>{folders.map(f=>{const Icon=f.icon,n=count(f.id);return <button key={f.id} type="button" aria-pressed={folder===f.id} onClick={()=>choose(f.id)}><Icon size={17}/><span>{f.label}</span>{n>0&&<span className={'folder-count'+(f.id==='New'?' strong':'')}>{n}</span>}</button>})}</nav>
  <div className="mail-list-pane"><div className="mail-list-head"><div className="search"><Search size={16}/><input aria-label="Search enquiries" placeholder="Search name, email or message" value={query} onChange={e=>{setQuery(e.target.value);setPick({id:null,index:0})}}/>{query&&<button type="button" className="search-clear" aria-label="Clear search" onClick={()=>{setQuery('');setPick({id:null,index:0})}}><X size={15}/></button>}</div><p className="mail-list-title">{currentFolder.label}<span>{shown.length} {shown.length===1?'enquiry':'enquiries'}</span></p></div>
   {error?<div className="error-banner enquiry-error" role="alert">{error}</div>:shown.length?<div className="mail-list" ref={list} onKeyDown={keys} aria-label={currentFolder.label+' enquiries'}>{rows}</div>:<div className="empty compact"><Inbox size={30}/><h3>{q?'No enquiries match':enquiries.length?'Nothing in '+currentFolder.label:'No enquiries yet'}</h3><p>{q?'Try another name, email or word.':enquiries.length?'Try another folder.':'Enquiries sent from bhbcentre.com appear here as soon as they arrive.'}</p></div>}
  </div>
  <article className="mail-read" aria-label="Enquiry">{selected?<>
   <div className="mail-toolbar"><button type="button" className="text-button mail-back" onClick={()=>setReading(false)}><ArrowLeft size={17}/>{currentFolder.label}</button>
    {wa&&<a className="secondary wa-reply" href={wa} target="_blank" rel="noopener noreferrer" onClick={()=>replied(selected)}><WhatsAppIcon className="wa-mini"/>Reply on WhatsApp</a>}
    <a className="secondary" href={mailLink(selected)} onClick={()=>replied(selected)}><Mail size={16}/>Email</a>
    {selected.phone&&<a className="secondary" href={'tel:'+selected.phone.replace(/[^\d+]/g,'')} onClick={()=>replied(selected)}><Phone size={16}/>Call</a>}
    <button type="button" className="secondary" onClick={()=>onAddTenant(selected)}><UserPlus size={16}/>Add as tenant</button>
    <span className="mail-toolbar-end">{selected.status==='New'&&<button type="button" className="primary" onClick={()=>onStatus(selected,'Contacted')}><CheckCircle2 size={16}/>Mark contacted</button>}{selected.status!=='Closed'?<button type="button" className="secondary" onClick={()=>onStatus(selected,'Closed')}><Archive size={16}/>Close</button>:<button type="button" className="secondary" onClick={()=>onStatus(selected,'New')}><RotateCcw size={16}/>Reopen</button>}</span></div>
   <div className="mail-body"><h3 className="mail-title">{selected.service}</h3>
    <div className="mail-from"><span className="mail-avatar large" aria-hidden="true">{initials(selected.name)}</span><div><strong>{selected.name}</strong><span><a href={mailLink(selected)} onClick={()=>replied(selected)}>{selected.email}</a>{selected.phone&&<> · <a href={'tel:'+selected.phone.replace(/[^\d+]/g,'')}>{selected.phone}</a></>}</span></div><time dateTime={selected.created}>{fullDate(selected.created)}</time></div>
    <div className="mail-meta"><span className={'mail-status '+selected.status.toLowerCase()}>{selected.status}</span>{selected.page&&<span><Globe size={14}/>Sent from {selected.page==='/'?'the homepage':selected.page}</span>}</div>
    <p className="mail-message">{selected.message}</p></div>
  </>:<div className="mail-empty"><Mail size={38}/><p>{shown.length?'Select an enquiry to read it.':'No enquiry selected.'}</p></div>}</article>
 </section>;
}
