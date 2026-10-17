import {z} from 'zod';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Use a valid date');
// A UAE IBAN: AE, two check digits, 19 more digits; the ISO 13616 mod-97 check must give 1.
const ibanOk=(v:string)=>{if(!v)return true;if(!/^AE\d{21}$/.test(v))return false;let m=0;for(const ch of (v.slice(4)+v.slice(0,4)).replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55)))m=(m*10+Number(ch))%97;return m===1};
export const issuerSchema=z.object({branch:z.enum(['BHB','111']),name:z.string().trim().min(1).max(200),address:z.string().trim().min(1).max(2000),trn:z.string().regex(/^\d{15}$/,'Supplier TRN must be 15 digits'),email:z.union([z.literal(''),z.string().email()]).default(''),phone:z.string().max(80).default(''),autoFrom:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/,'Use a valid date').default(''),
 // Optional bank details printed under the total so clients know where to pay.
 bankName:z.string().trim().max(120).default(''),accountName:z.string().trim().max(200).default(''),iban:z.string().max(40).default('').transform(v=>v.replace(/\s+/g,'').toUpperCase()).refine(ibanOk,'Check the IBAN: AE, then 21 digits, and its check digits must match')});
// One line of a tax invoice. "service" lines carry the invoice's VAT rate; "disbursement" lines are government fees
// paid on the client's behalf (visas, licences, Emirates ID), charged at cost, outside the scope of VAT and shown apart.
export const lineKinds=['service','disbursement'] as const;
const lineSchema=z.object({description:z.string().trim().min(1,'Describe each line').max(500),quantity:z.coerce.number().finite().positive().max(1e6),unitPrice:z.coerce.number().finite().min(0).max(1e11),discount:z.coerce.number().finite().min(0).max(1e11).default(0),kind:z.enum(lineKinds).default('service')});
export type InvoiceLine=z.infer<typeof lineSchema>;
// Older invoices (and the single-line forms) send description, quantity, unit price and discount on the invoice
// itself; they become one service line. The top-level fields then repeat the first service line, for older readers.
const withLines=(v:unknown)=>{if(!v||typeof v!=='object')return v;const o=v as Record<string,unknown>;
 const lines=Array.isArray(o.lines)&&o.lines.length?o.lines as Record<string,unknown>[]:[{description:o.description,quantity:o.quantity,unitPrice:o.unitPrice,discount:o.discount??0,kind:'service'}];
 const first=lines.find(l=>(l.kind||'service')==='service')||lines[0];
 return {...o,lines,description:lines.length>1?lines.map(l=>String(l.description??'').trim()).filter(Boolean).join('; ').slice(0,2000):first.description,quantity:first.quantity,unitPrice:first.unitPrice,discount:first.discount??0};};
export const invoiceSchema=z.preprocess(withLines,z.object({officeId:z.string().default(''),customerId:z.string().nullable().default(null),paymentId:z.string().nullable().default(null),issueDate:date,supplyDate:date,buyerName:z.string().trim().min(1).max(200),buyerAddress:z.string().trim().min(1).max(2000),buyerTrn:z.string().regex(/^$|^\d{15}$/,'Tenant TRN must be 15 digits').default(''),description:z.string().trim().min(1).max(2000),quantity:z.coerce.number().finite().positive().max(1e6),unitPrice:z.coerce.number().finite().min(0).max(1e11),discount:z.coerce.number().finite().min(0).max(1e11),vatRate:z.coerce.number().finite().min(0).max(100),lines:z.array(lineSchema).min(1).max(30),notes:z.string().max(4000).default('')}).superRefine((d,c)=>{if(!d.officeId&&!d.customerId)c.addIssue({code:'custom',message:'Choose the office or the customer this invoice is for'});if(!d.officeId&&d.paymentId)c.addIssue({code:'custom',message:'An invoice for a payment needs that payment\'s office'});
 d.lines.forEach((l,i)=>{if(l.discount>l.quantity*l.unitPrice)c.addIssue({code:'custom',path:['lines',i,'discount'],message:'Discount cannot exceed the line amount'})});
 // A tax invoice needs at least one VAT-able line; government fees alone are not a taxable supply.
 if(!d.lines.some(l=>l.kind==='service'&&l.quantity*l.unitPrice-l.discount>0))c.addIssue({code:'custom',message:'Invoice must have a positive service line'});
 if(d.paymentId&&d.lines.length>1)c.addIssue({code:'custom',message:'An invoice for one payment has one line; issue a multi-line invoice without choosing a payment'});}));
export const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
// net and vat are the taxable part (what credit notes and VAT reports use); outside is the government fees paid for
// the client; total is what the client pays. Older single-line invoices have no lines and no outside part.
export function invoiceTotals(d:{lines?:InvoiceLine[];quantity?:number;unitPrice?:number;discount?:number;vatRate:number}){
 const lines=d.lines?.length?d.lines:[{description:'',quantity:d.quantity||0,unitPrice:d.unitPrice||0,discount:d.discount||0,kind:'service' as const}];
 const lineNet=(l:InvoiceLine)=>round(round(l.quantity*l.unitPrice)-(l.discount||0)),service=lines.filter(l=>l.kind!=='disbursement');
 const gross=round(service.reduce((a,l)=>a+round(l.quantity*l.unitPrice),0)),net=round(service.reduce((a,l)=>a+lineNet(l),0)),vat=round(net*d.vatRate/100),outside=round(lines.filter(l=>l.kind==='disbursement').reduce((a,l)=>a+lineNet(l),0));
 return {gross,net,vat,outside,total:round(net+vat+outside)};}
// Numbers run per branch and year without gaps (number); invoices issued before that keep their old sequence (seq).
export function invoiceNumber(i:{seq:number;number?:number;branch:string;issueDate:string}){return i.branch+'-'+i.issueDate.slice(0,4)+'-'+String(i.number??i.seq).padStart(6,'0');}
// A tax credit note against one issued invoice: the amount before VAT to take off (all that is left, or part), why, and when.
export const creditNoteSchema=z.object({invoiceId:z.string().min(1).max(80),issueDate:date,reason:z.string().trim().min(3,'Say why this credit note is issued').max(500),net:z.coerce.number().finite().positive('Enter the amount to credit').max(1e11)});
export function creditNumber(c:{number:number;branch:string;issueDate:string}){return c.branch+'-CN-'+c.issueDate.slice(0,4)+'-'+String(c.number).padStart(6,'0');}
// Automatic invoices are only for money received: an income payment with an amount, on a current lease, cleared on
// or after the branch's go-live date ("Issue invoices automatically from" with your company details in Accounts). Off when unset.
export const receivedForInvoice=(p:{direction:string;amount:number;officeId:string|null;leaseId?:string|null;status:string;actual?:string},from:string)=>!!from&&p.direction==='Income'&&p.amount>0&&!!p.officeId&&!p.leaseId&&p.status==='Cleared'&&!!p.actual&&p.actual>=from;
// Why a received payment is not invoiced automatically ('' when it can be). The server and the Accounts count share it.
// vat: its VAT does not match the lease rate. hand: the lease has an invoice made by hand in its current term, so the
// rest of that lease is invoiced by hand too (no guessing which payments a hand-made invoice covers).
export function autoInvoiceBlock(p:{officeId:string|null;amount:number;vatAmount?:number;incomeType?:string},office:{vat?:number;start?:string;end?:string}|undefined,invoices:{paymentId?:string|null;officeId?:string;supplyDate?:string;issueDate?:string}[]):''|'vat'|'hand'|'pro'{
 // pro: PRO service income is invoiced by hand, so government fees can go on their own line outside VAT.
 if(p.incomeType==='PRO service')return 'pro';
 if(!office)return 'hand';const expected=Math.round(p.amount*(Number(office.vat)||0))/100;if(Math.abs(expected-(p.vatAmount||0))>0.01)return 'vat';
 const when=(i:{supplyDate?:string;issueDate?:string})=>i.supplyDate||i.issueDate||'';
 return invoices.some(i=>!i.paymentId&&i.officeId===p.officeId&&!!office.start&&!!office.end&&when(i)>=office.start&&when(i)<=office.end)?'hand':'';
}

// Amount in words for the invoice total, e.g. 21000 -> "Twenty-one thousand UAE dirhams only".
const ONES=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'],TENS=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const under1000=(n:number):string=>n<20?ONES[n]:n<100?TENS[Math.floor(n/10)]+(n%10?'-'+ONES[n%10]:''):ONES[Math.floor(n/100)]+' hundred'+(n%100?' and '+under1000(n%100):'');
function numberWords(n:number):string{if(n<1000)return under1000(n);if(n>=1e15)return new Intl.NumberFormat('en-AE').format(n);const parts:string[]=[];for(const [v,name] of [[1e12,'trillion'],[1e9,'billion'],[1e6,'million'],[1e3,'thousand']] as [number,string][])if(n>=v){parts.push(under1000(Math.floor(n/v))+' '+name);n%=v}if(n)parts.push((n<100?'and ':'')+under1000(n));return parts.join(' ')}
export function aedInWords(amount:number){const cents=Math.round(Math.abs(amount)*100),dirhams=Math.floor(cents/100),fils=cents%100;const s=numberWords(dirhams)+' UAE dirham'+(dirhams===1?'':'s')+(fils?' and '+numberWords(fils)+' fils':'')+' only';return s[0].toUpperCase()+s.slice(1)}
