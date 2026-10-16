'use client';
import {Download} from 'lucide-react';
import {GroupedTable,type Column} from './board';
import type {Office,Payment,Attachment} from '@/lib/records';
import type {Enquiry} from '@/lib/enquiries';
import {invoiceNumber} from '@/lib/invoices';
// Analytical layouts: each page's records as one grouped table (search, filter chips, group-by chips, subtotals).
const aed=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:2}).format(n);
const showDate=(s:string)=>s?new Date(s.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
const monthOf=(s:string)=>s?new Date(s.slice(0,7)+'-01T00:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}):'No date';
const pill=(s:string)=><span className={'pill '+(['Contacted','Closed'].includes(s)?(s==='Closed'?'neutral':'good'):'warn')}>{s}</span>;

export function EnquiryGrid({enquiries}:{enquiries:Enquiry[]}){
 const columns:Column<Enquiry>[]=[
  {id:'from',label:'From',cell:e=><><strong>{e.name}</strong><small>{[e.email,e.phone].filter(Boolean).join(' · ')}</small></>},
  {id:'service',label:'Service',cell:e=>e.service},
  {id:'message',label:'Message',cell:e=><span className="gt-clip" title={e.message}>{e.message}</span>},
  {id:'received',label:'Received',cell:e=>showDate(e.created)},
  {id:'status',label:'Status',cell:e=>pill(e.status)},
 ];
 return <GroupedTable title="Website enquiries" rows={[...enquiries].sort((a,b)=>b.created.localeCompare(a.created))} rowKey={e=>e.id} columns={columns} search={e=>[e.name,e.email,e.phone,e.service,e.message,e.page].join(' ')} initialGroups={['status']} empty="Enquiries sent from the website appear here."
  filters={[{id:'all',label:'All',test:()=>true},{id:'new',label:'New',test:e=>e.status==='New'},{id:'contacted',label:'Contacted',test:e=>e.status==='Contacted'},{id:'closed',label:'Closed',test:e=>e.status==='Closed'}]}
  groupings={[{id:'status',label:'Status',key:e=>e.status},{id:'service',label:'Service',key:e=>e.service||'—'},{id:'month',label:'Month received',key:e=>monthOf(e.created)},{id:'page',label:'Page',key:e=>e.page||'—'}]}/>;
}

export function DocumentGrid({documents,offices,payments}:{documents:Attachment[];offices:Office[];payments:Payment[]}){
 const code=(id:string)=>offices.find(o=>o.id===id)?.code||'—',ref=(id:string|null)=>id?payments.find(p=>p.id===id)?.reference||'—':'—';
 const types=[...new Set(documents.map(d=>d.category))].sort();
 const columns:Column<Attachment>[]=[
  {id:'name',label:'Document',cell:d=><a className="text-button" href={'/api/documents?id='+encodeURIComponent(d.id)} target="_blank" rel="noreferrer"><Download size={14}/>{d.name}</a>},
  {id:'type',label:'Type',cell:d=>d.category},
  {id:'office',label:'Office',cell:d=>code(d.officeId)},
  {id:'payment',label:'Payment',cell:d=>ref(d.paymentId)},
  {id:'uploaded',label:'Uploaded',cell:d=>showDate(d.created)},
  {id:'size',label:'Size (KB)',numeric:true,cell:d=>Math.round(d.size/1024).toLocaleString('en'),total:l=>Math.round(l.reduce((a,d)=>a+d.size,0)/1024).toLocaleString('en')},
 ];
 return <GroupedTable title="Documents" rows={[...documents].sort((a,b)=>b.created.localeCompare(a.created))} rowKey={d=>d.id} columns={columns} search={d=>[d.name,d.category,code(d.officeId),ref(d.paymentId)].join(' ')} initialGroups={['office']} empty="Upload a licence, lease agreement or check copy for an office."
  filters={[{id:'all',label:'All',test:()=>true},...types.map(t=>({id:t,label:t,test:(d:Attachment)=>d.category===t}))]}
  groupings={[{id:'office',label:'Office',key:d=>code(d.officeId)},{id:'type',label:'Type',key:d=>d.category},{id:'month',label:'Month uploaded',key:d=>monthOf(d.created)}]}/>;
}

export function InvoiceGrid({invoices,offices,month}:{invoices:any[];offices:Office[];month:string}){
 const code=(id:string)=>offices.find(o=>o.id===id)?.code||'—';
 const columns:Column<any>[]=[
  {id:'invoice',label:'Invoice',cell:i=><><a className="text-button" href={'/invoice/'+i.id} target="_blank" rel="noreferrer">{invoiceNumber(i)}</a><small>{i.buyerName}</small></>},
  {id:'date',label:'Issued',cell:i=>showDate(i.issueDate)},
  {id:'office',label:'Office',cell:i=>code(i.officeId)},
  {id:'description',label:'Description',cell:i=><span className="gt-clip" title={i.description}>{i.description}</span>},
  {id:'net',label:'Net',numeric:true,cell:i=>aed(i.totals?.net||0),total:l=>aed(l.reduce((a,i)=>a+(i.totals?.net||0),0))},
  {id:'vat',label:'VAT',numeric:true,cell:i=>aed(i.totals?.vat||0),total:l=>aed(l.reduce((a,i)=>a+(i.totals?.vat||0),0))},
  {id:'total',label:'Total (AED)',numeric:true,highlight:true,cell:i=>aed(i.totals?.total||0),total:l=>aed(l.reduce((a,i)=>a+(i.totals?.total||0),0))},
 ];
 return <GroupedTable title="Invoices" rows={[...invoices].sort((a,b)=>b.issueDate.localeCompare(a.issueDate)||b.seq-a.seq)} rowKey={i=>i.id} columns={columns} search={i=>[invoiceNumber(i),i.buyerName,i.description,code(i.officeId)].join(' ')} initialGroups={['month']} empty="Invoices you issue appear here."
  filters={[{id:'all',label:'All',test:()=>true},{id:'month',label:'Reporting month',test:i=>i.issueDate?.slice(0,7)===month},{id:'payment',label:'Linked to a payment',test:i=>!!i.paymentId},{id:'vat',label:'With VAT',test:i=>(i.totals?.vat||0)>0}]}
  groupings={[{id:'month',label:'Month',key:i=>monthOf(i.issueDate)},{id:'buyer',label:'Buyer',key:i=>i.buyerName||'—'},{id:'office',label:'Office',key:i=>code(i.officeId)}]}/>;
}
