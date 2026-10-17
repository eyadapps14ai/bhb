import {context,checkOffice,checkBranch,DENIED} from '@/lib/server-records';
import {invoiceNumber,aedInWords} from '@/lib/invoices';
import {notFound,redirect,forbidden} from 'next/navigation';
import {getUser} from '@/lib/auth';
import PrintInvoice from './print';
// The tax invoice as the client sees it (and prints on one A4 page). Every item UAE law asks for is here: the words
// Tax Invoice, supplier and client name, address and TRN, the sequential number, issue date and date of supply, the
// line with quantity, unit price, discount, VAT rate and VAT, and the totals in AED. Internal notes stay out.
const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const day=(s?:string)=>s&&/^\d{4}-\d{2}-\d{2}/.test(s)?+s.slice(8,10)+' '+M[+s.slice(5,7)-1]+' '+s.slice(0,4):s||'';
const METHOD:Record<string,string>={Check:'Cheque',Transfer:'Bank transfer',Cash:'Cash'};
export default async function InvoicePage({params}:{params:Promise<{id:string}>}){if(!await getUser())redirect('/login');const {id}=await params;// Someone whose role or branches do not cover this invoice gets the plain "no access" page (forbidden.tsx) with a 403.
let row:any=null,current:{bankName?:string;accountName?:string;iban?:string}|null=null,denied=false;try{const{db,owner,user}=await context(new Request('http://localhost/invoice'),'cash','view');row=await db.prepare('SELECT seq,data,office_id AS "officeId" FROM invoices WHERE id=? AND owner=?').bind(id,owner).first();if(row){const branch=JSON.parse(row.data).branch||'BHB';if(row.officeId)await checkOffice(db,owner,user,row.officeId);else checkBranch(user,branch);
 // Only invoices issued before the bank fields existed fall back to the branch's current bank details.
 const r=await db.prepare('SELECT data FROM invoice_issuers WHERE id=? AND owner=?').bind(owner+':'+branch,owner).first<{data:string}>();current=r?JSON.parse(r.data):null}}catch(e){// Only a refusal shows "No access"; a database or server error is an error, not a permission problem.
 if((e as Error).message===DENIED)denied=true;else throw e}if(denied)forbidden();if(!row)notFound();
const d=JSON.parse(row.data),number=invoiceNumber({...d,seq:row.seq}),fmt=(n:number)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED'}).format(n);
// Each invoice prints the bank details saved with it, so changing them later never rewrites an issued invoice.
const is=d.issuer||{},saved='iban' in is||'bankName' in is,bank=saved?(is.iban||is.bankName?is:null):current?.iban||current?.bankName?current:null,party=d.office||d.customer||{},pay=d.payment,o=d.office;
const supplierContact=[is.email,is.phone].filter(Boolean).join(' · '),clientContact=[party.contact,party.email,party.phone].filter(Boolean).join(' · ');
const auto='Issued automatically for payment '+(pay?.reference||'')+'.',raw=String(d.notes||'').trim(),notes=(pay&&raw.startsWith(auto)?raw.slice(auto.length):raw.replace(/^Issued automatically for payment [^\n]*\.$/,'')).trim();
const payRef=pay&&!/^INC-[0-9a-f]{8}-[0-9a-f]{4}-/i.test(pay.reference||'')?pay.reference:'';
const lease=o&&[o.code&&'Office '+o.code,o.leaseReference&&'Lease '+o.leaseReference,o.start&&'Lease period '+day(o.start)+' to '+day(o.end),o.licenseNumber&&'Trade licence '+o.licenseNumber].filter(Boolean).join(' · ');
return <main className="invoice-document"><PrintInvoice/>
 <header className="invoice-heading"><img src="/bhb-logo.png" alt="BHB Business Centre"/><div className="inv-title"><h1>Tax Invoice</h1><p className="inv-ar" lang="ar" dir="rtl">فاتورة ضريبية</p>
  <dl className="inv-meta"><div><dt>Invoice no.</dt><dd>{number}</dd></div><div><dt>Issue date</dt><dd>{day(d.issueDate)}</dd></div><div><dt>Date of supply</dt><dd>{day(d.supplyDate||d.issueDate)}</dd></div></dl></div></header>
 <div className="invoice-columns"><section><h2>From</h2><b>{is.name}</b><p className="inv-pre">{is.address}</p><p>TRN {is.trn}</p>{supplierContact&&<p>{supplierContact}</p>}</section>
  <section><h2>Bill to</h2><b>{d.buyerName}</b><p className="inv-pre">{d.buyerAddress}</p><p>{d.buyerTrn?'TRN '+d.buyerTrn:'TRN: not VAT registered'}</p>{clientContact&&<p>{clientContact}</p>}</section></div>
 {lease&&<p className="inv-lease">{lease}</p>}
 <table className="invoice-table"><thead><tr>{[['Description',''],['Qty','num'],['Unit price','num'],['Discount','num'],['Net amount','num'],['VAT rate','num'],['VAT','num'],['Total','num']].map(([h,c])=><th key={h} className={c}>{h}</th>)}</tr></thead>
  <tbody><tr><td>{d.description}</td><td className="num">{d.quantity}</td><td className="num">{fmt(d.unitPrice)}</td><td className="num">{fmt(d.discount)}</td><td className="num">{fmt(d.totals.net)}</td><td className="num">{d.vatRate}%</td><td className="num">{fmt(d.totals.vat)}</td><td className="num">{fmt(d.totals.total)}</td></tr></tbody></table>
 <div className="inv-bottom"><div className="inv-info">
   {bank&&<section><h2>Payment details</h2><dl>{([['Bank',bank.bankName],['Account name',bank.accountName||is.name],['IBAN',String(bank.iban||'').replace(/(.{4})/g,'$1 ').trim()]] as [string,string][]).filter(([,v])=>v).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>}
   {pay&&<p>Payment: {[METHOD[pay.method]||pay.method,payRef].filter(Boolean).join(' ')}{pay.bankName?', '+pay.bankName:''}{pay.due?', due '+day(pay.due):''}.</p>}
   {d.replacedPayments?.length>0&&<p>Replaces {d.replacedPayments.map((r:any)=>typeof r==='string'?r:'bounced payment '+r.reference).join(', ')}.</p>}
   {(pay?.securityDeposit||0)>0&&<p>Security deposit of {fmt(pay.securityDeposit)} received separately; it is refundable and not part of this invoice.</p>}
   {notes&&<p className="inv-pre">{notes}</p>}</div>
  <div className="inv-totals"><div><span>Subtotal excl. VAT</span><b>{fmt(d.totals.net)}</b></div><div><span>VAT {d.vatRate}%</span><b>{fmt(d.totals.vat)}</b></div><div className="inv-grand"><span>Total (AED)</span><b>{fmt(d.totals.total)}</b></div><p className="inv-words">{aedInWords(d.totals.total)}</p></div></div>
 <footer>All amounts in UAE dirhams (AED). Thank you for your business.</footer>
</main>}
