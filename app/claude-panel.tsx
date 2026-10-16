'use client';
import {useState} from 'react';
import {Sparkles,Copy,Unplug,KeyRound} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
// "Connect Claude": how to add the dashboard as a connector in Claude, the Claude sign-ins this person has
// allowed, and personal keys for Claude Code. Claude only ever reads, as this person.
type Item={id:string;created:string;lastUsed:string};
type Key=Item&{label:string;expires:string};
type Connection=Item&{name:string};
type Owned={owner:string};
type Reply={keys?:Key[];connections?:Connection[];everyone?:{keys:(Key&Owned)[];connections:(Connection&Owned)[]};key?:string;error?:string};
const when=(iso:string)=>iso?new Date(iso).toLocaleString('en-GB',{timeZone:'Asia/Dubai',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'never';
async function copy(text:string,what:string){try{await navigator.clipboard.writeText(text);toast.success(what+' copied')}catch{toast.error('Copy did not work. Select the text and copy it.')}}
export default function ClaudePanel({roleName,branches}:{roleName:string;branches:string[]}){
 const [open,setOpen]=useState(false),[keys,setKeys]=useState<Key[]|null>(null),[connections,setConnections]=useState<Connection[]>([]),[label,setLabel]=useState(''),[fresh,setFresh]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirming,setConfirming]=useState(''),[everyone,setEveryone]=useState<Reply['everyone']>();
 const url=typeof window==='undefined'?'/api/mcp':window.location.origin+'/api/mcp',command=(key:string)=>`claude mcp add --transport http bhb ${url} --header "Authorization: Bearer ${key}"`;
 const call=async(method:string,body?:unknown)=>{const r=await fetch('/api/claude-keys',{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const j=(await r.json().catch(()=>({}))) as Reply;if(!r.ok)throw new Error(j.error||'Something went wrong. Please try again.');return j};
 const load=async()=>{try{const j=await call('GET');setKeys(j.keys??[]);setConnections(j.connections??[]);setEveryone(j.everyone);setError('')}catch(e){setError((e as Error).message)}};
 const show=()=>{setOpen(true);setFresh('');setConfirming('');load()};
 const create=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{const j=await call('POST',{label});setFresh(j.key??'');setLabel('');await load()}catch(err){setError((err as Error).message)}finally{setBusy(false)}};
 const remove=async(id:string,kind:'key'|'connection',anyone=false)=>{if(confirming!==id){setConfirming(id);return}setConfirming('');try{await call('DELETE',{id,kind,anyone});toast.success(kind==='key'?'Key revoked':'Claude disconnected');await load()}catch(e){setError((e as Error).message)}};
 const row=(id:string,title:string,item:Item&{expires?:string},kind:'key'|'connection',anyone=false)=><li key={id}><div><strong>{title}</strong><small>Added {when(item.created)} · last used {when(item.lastUsed)}{item.expires&&<> · expires {when(item.expires)}</>}</small></div><button type="button" className={confirming===id?'primary':'secondary'} onClick={()=>remove(id,kind,anyone)}>{kind==='key'?<KeyRound size={15}/>:<Unplug size={15}/>}{confirming===id?'Confirm':kind==='key'?'Revoke':'Disconnect'}</button></li>;
 return <><button type="button" className="text-button claude-link" onClick={show}><Sparkles size={16}/>Connect Claude</button>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="claude-dialog"><DialogTitle>Connect Claude</DialogTitle><DialogDescription>Ask Claude about offices, payments and enquiries, for example “which checks are overdue?”. Claude reads the dashboard as you ({roleName}, {branches.join(' and ')}) and cannot change anything.</DialogDescription>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <section><h3>In Claude (claude.ai or the Claude app)</h3><ol><li>Open Settings › Connectors › Add custom connector.</li><li>Name it “BHB dashboard” and paste this address:<span className="claude-copy"><code>{url}</code><button type="button" className="secondary" onClick={()=>copy(url,'Address')}><Copy size={15}/>Copy</button></span></li><li>Claude opens the BHB sign-in page. Sign in and choose Allow.</li></ol>
    {connections.length>0&&<><h4>Connected</h4><ul className="claude-list">{connections.map(c=>row(c.id,c.name,c,'connection'))}</ul></>}</section>
   <section><h3>In Claude Code (developers)</h3>{fresh?<div className="claude-fresh"><p><strong>Copy this key now.</strong> It is shown only once.</p><span className="claude-copy"><code>{command(fresh)}</code><button type="button" className="secondary" onClick={()=>copy(command(fresh),'Command')}><Copy size={15}/>Copy</button></span><p>Run it in a terminal; Claude Code then has the BHB tools.</p></div>
    :<form className="claude-form" onSubmit={create}><label>Key name<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Claude Code on my laptop" maxLength={80} required/></label><button className="secondary" type="submit" disabled={busy}><KeyRound size={15}/>{busy?'Creating…':'Create key'}</button></form>}
    {keys===null?<p className="claude-muted">Loading…</p>:keys.length>0&&<ul className="claude-list">{keys.map(k=>row(k.id,k.label,k,'key'))}</ul>}</section>
   {everyone&&<section><h3>Everyone&rsquo;s Claude access</h3><p className="claude-muted">You manage Users &amp; roles, so you see every person&rsquo;s Claude connections and keys and can cut them off. A new password or deactivating a user removes theirs automatically.</p>
    {everyone.connections.length+everyone.keys.length?<ul className="claude-list">{everyone.connections.map(c=>row(c.id,c.owner+' · '+c.name,c,'connection',true))}{everyone.keys.map(k=>row(k.id,k.owner+' · key “'+k.label+'”',k,'key',true))}</ul>:<p className="claude-muted">Nobody has connected Claude yet.</p>}</section>}
  </DialogContent></Dialog></>;
}
