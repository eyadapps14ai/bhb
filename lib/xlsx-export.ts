import {buildWorkbook} from './period-report';
// Excel export for any list: a Summary sheet (title, when, how many rows) and a Data sheet with a frozen header.
// Amounts shown as text ("AED 12,000.00", "1,500", "12") become numbers so they add up in Excel; phone numbers, TRNs,
// codes and anything with a leading zero or ten or more plain digits stay text so nothing is lost.
export type Cell=string|number;
export function cellValue(text:string):Cell{const s=text.replace(/\s+/g,' ').trim(),m=s.replace(/^AED\s*/,'').replace(/^[−–]\s?/,'-');if(/^\+/.test(m)||/^-?0\d/.test(m)||/^-?\d{10,}$/.test(m))return s;return /^-?\d{1,3}(,\d{3})+(\.\d+)?$|^-?\d+(\.\d+)?$/.test(m)?Number(m.replace(/,/g,'')):s}
export function tableToRows(table:HTMLTableElement):Cell[][]{return [...table.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(c=>cellValue((c as HTMLElement).innerText||c.textContent||'')))}
const safe=(s:string)=>s.replace(/[\\/?*[\]:]/g,' ').slice(0,31)||'Data';
export function downloadXlsx(title:string,rows:Cell[][],file:string){
 const blob=buildWorkbook([{name:'Summary',rows:[[title],['Exported '+new Date().toLocaleString('en-GB')],['Rows',Math.max(0,rows.length-1)]]},{name:safe(title),rows}]);
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(file.endsWith('.xlsx')?file:file+'.xlsx').replace(/[^\w.-]+/g,'-');a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
