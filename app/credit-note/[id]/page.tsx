import {context,checkOffice,checkBranch,DENIED} from '@/lib/server-records';
import {creditNumber,aedInWords} from '@/lib/invoices';
import {notFound,redirect,forbidden} from 'next/navigation';
import {getUser} from '@/lib/auth';
import PrintInvoice from '@/app/invoice/[id]/print';
// A tax credit note as the client sees it (one A4 page): the words Tax Credit Note, supplier and client details with
// TRNs, its own number and date, the invoice it corrects (number and date), the value on the invoice, the corrected
// value, the difference and the VAT on it, and why it was issued.
const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const day=(s?:string)=>s&&/^\d{4}-\d{2}-\d{2}/.test(s)?+s.slice(8,10)+' '+M[+s.slice(5,7)-1]+' '+s.slice(0,4):s||'';
type Totals={net:number;vat:number;total:number};
export default async function CreditNotePage({params}:{params:Promise<{id:string}>}){if(!await getUser())redirect('/login');const {id}=await params;
let row:{data:string;officeId:string|null}|null=null,denied=false;try{const{db,owner,user}=await context(new Request('http://localhost/credit-note'),'cash','view');row=await db.prepare('SELECT c.data,i.office_id AS "officeId" FROM credit_notes c JOIN invoices i ON i.id=c.invoice_id WHERE c.id=? AND c.owner=?').bind(id,owner).first<{data:string;officeId:string|null}>();if(row){if(row.officeId)await checkOffice(db,owner,user,row.officeId);else checkBranch(user,JSON.parse(row.data).branch||'BHB')}}catch(e){if((e as Error).message===DENIED)denied=true;else throw e}if(denied)forbidden();if(!row)notFound();
const c=JSON.parse(row.data),is=c.issuer||{},fmt=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED'}).format(n);
const o:Totals=c.original,cr:Totals=c.credit,after:Totals=c.corrected,earlier=Math.round((o.net-after.net-cr.net)*100)/100,supplierContact=[is.email,is.phone].filter(Boolean).join(' · ');
return <main className="invoice-document credit-note"><PrintInvoice/>
 <header className="invoice-heading"><img src="/bhb-logo.png" alt="BHB Business Centre"/><div className="inv-title"><h1>Tax Credit Note</h1><p className="inv-ar" lang="ar" dir="rtl">إشعار دائن ضريبي</p>
  <dl className="inv-meta"><div><dt>Credit note no.</dt><dd>{creditNumber(c)}</dd></div><div><dt>Date</dt><dd>{day(c.issueDate)}</dd></div><div><dt>For invoice</dt><dd><a href={'/invoice/'+c.invoiceId}>{c.invoiceNumber}</a></dd></div><div><dt>Invoice date</dt><dd>{day(c.invoiceDate)}</dd></div></dl></div></header>
 <div className="invoice-columns"><section><h2>From</h2><b>{is.name}</b><p className="inv-pre">{is.address}</p><p>TRN {is.trn}</p>{supplierContact&&<p>{supplierContact}</p>}</section>
  <section><h2>To</h2><b>{c.buyerName}</b><p className="inv-pre">{c.buyerAddress}</p><p>{c.buyerTrn?'TRN '+c.buyerTrn:'TRN: not VAT registered'}</p></section></div>
 <p className="inv-lease"><b>Reason:</b> {c.reason}</p>
 <table className="invoice-table"><thead><tr>{[['Description',''],['On the invoice','num'],['Corrected','num'],['Credited','num'],['VAT rate','num'],['VAT credited','num'],['Total credited','num']].map(([h,k])=><th key={h} className={k}>{h}</th>)}</tr></thead>
  <tbody><tr><td>{c.description}</td><td className="num">{fmt(o.net)}</td><td className="num">{fmt(after.net)}</td><td className="num">{fmt(cr.net)}</td><td className="num">{c.vatRate}%</td><td className="num">{fmt(cr.vat)}</td><td className="num">{fmt(cr.total)}</td></tr></tbody></table>
 <div className="inv-bottom"><div className="inv-info"><p>Amounts before VAT. The invoice {c.invoiceNumber} was {fmt(o.total)} including VAT; after this credit note it is {fmt(after.total)}.</p>{earlier>0.004&&<p>Earlier credit notes on this invoice took off {fmt(earlier)} before VAT.</p>}</div>
  <div className="inv-totals"><div><span>Credit before VAT</span><b>{fmt(cr.net)}</b></div><div><span>VAT {c.vatRate}%</span><b>{fmt(cr.vat)}</b></div><div className="inv-grand"><span>Total credited (AED)</span><b>{fmt(cr.total)}</b></div><p className="inv-words">{aedInWords(cr.total)}</p></div></div>
 <footer>All amounts in UAE dirhams (AED). This credit note reduces the VAT charged on the invoice above.</footer>
</main>}
