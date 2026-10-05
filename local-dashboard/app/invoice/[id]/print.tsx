'use client';
export default function PrintInvoice(){return <div className="invoice-print-actions"><button className="primary" onClick={()=>window.print()}>Print / Save PDF</button><a className="secondary" href="/">Back to dashboard</a></div>}
