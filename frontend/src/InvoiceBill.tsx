import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Printer, RefreshCw, X } from "lucide-react";
import "./invoice-bill.css";

const money = (value: unknown) => `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function BillDocument({ invoice }: { invoice: any }) {
  const quantity = invoice.lines.reduce((sum: number, line: any) => sum + Number(line.quantity), 0);
  return <article className="bill-document">
    <div className="bill-brand"><div><span>SUPUN AEROSOFT (PVT) LTD</span><p>Customer sales invoice</p></div><div><h1>INVOICE</h1><strong>{invoice.number}</strong></div></div>
    <div className="bill-parties"><div><small>BILL TO</small><h2>{invoice.customer_name}</h2><p>{invoice.customer_address}</p>{invoice.customer_phone && <p>Phone: {invoice.customer_phone}</p>}{invoice.customer_tin && <p>Customer TIN: {invoice.customer_tin}</p>}<p>Customer: {invoice.customer_code}</p></div><dl><div><dt>Invoice date</dt><dd>{date(invoice.invoice_date)}</dd></div><div><dt>Due date</dt><dd>{date(invoice.due_date)}</dd></div><div><dt>Sale type</dt><dd>{invoice.sale_type}</dd></div><div><dt>Salesperson</dt><dd>{invoice.rep_name}</dd></div>{invoice.reference && <div><dt>PO reference</dt><dd>{invoice.reference}</dd></div>}{invoice.order_number && <div><dt>Sales order</dt><dd>{invoice.order_number}</dd></div>}</dl></div>
    <table className="bill-items"><thead><tr><th>#</th><th>Item / description</th><th>Size</th><th>Colour</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{invoice.lines.map((line: any, index: number) => <tr key={line.id}><td>{index + 1}</td><td><b>{line.article_code}</b><span>{line.article_name}</span></td><td>{line.size_label}</td><td>{line.colour || "—"}</td><td>{Number(line.quantity).toLocaleString()}</td><td>{money(line.rate)}</td><td>{money(line.line_total)}</td></tr>)}{invoice.lines.length === 0 && <tr><td colSpan={7}>This invoice has no saved item breakdown. The recorded totals are shown below.</td></tr>}</tbody></table>
    <div className="bill-summary"><div className="bill-note"><b>{invoice.lines.length > 0 ? `${quantity.toLocaleString()} pieces · ${invoice.lines.length} item lines` : "Item breakdown unavailable"}</b><p>Please quote {invoice.number} when making payment.</p><p>Payment status: <strong>{String(invoice.status).replace(/_/g, " ")}</strong></p></div><dl><div><dt>Subtotal</dt><dd>{money(invoice.subtotal)}</dd></div>{Number(invoice.discount) > 0 && <div><dt>Discount</dt><dd>− {money(invoice.discount)}</dd></div>}{Number(invoice.other_deduction) > 0 && <div><dt>Deductions{invoice.other_deduction_description ? ` (${invoice.other_deduction_description})` : ""}</dt><dd>− {money(invoice.other_deduction)}</dd></div>}{Number(invoice.tax) > 0 && <div><dt>Tax{invoice.tax_type === "percentage" ? ` (${Number(invoice.tax_rate)}%)` : ""}</dt><dd>{money(invoice.tax)}</dd></div>}{Number(invoice.other_charges) > 0 && <div><dt>Other charges{invoice.other_charges_description ? ` (${invoice.other_charges_description})` : ""}</dt><dd>{money(invoice.other_charges)}</dd></div>}<div className="bill-total"><dt>Invoice total</dt><dd>{money(invoice.total)}</dd></div><div><dt>Paid / received</dt><dd>{money(invoice.received_amount)}</dd></div><div className="bill-balance"><dt>Balance due</dt><dd>{money(invoice.outstanding)}</dd></div></dl></div>
    <div className="bill-signatures"><span>Prepared by</span><span>Authorized signature</span><span>Customer acknowledgment</span></div><div className="bill-thanks">Thank you for your business.</div>
  </article>;
}

export default function InvoiceBill({ id, api, token, close }: { id: number; api: string; token: string; close: () => void }) {
  const [invoice, setInvoice] = useState<any>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setInvoice(null); setError("");
    fetch(`${api}/sales-invoices/${id}/bill`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Unable to load this bill. Please retry."); return response.json(); })
      .then(result => { if (!controller.signal.aborted) setInvoice(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [id, api, token, attempt]);
  useEffect(() => {
    if (!invoice) return;
    const previous = document.title;
    document.title = `${invoice.number} - Supun AeroSoft`;
    return () => { document.title = previous; };
  }, [invoice]);
  return createPortal(<div className="backdrop invoice-bill-overlay" onMouseDown={close}><section className="modal invoice-bill-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-bill-title" onMouseDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") close(); }}>
    <div className="popup-header"><button type="button" className="close" aria-label="Close bill" autoFocus onClick={close}><X /></button><span>CUSTOMER BILL</span><h2 id="invoice-bill-title">{invoice ? invoice.number : "Invoice bill"}</h2></div>
    <div className="popup-body bill-preview">{invoice ? <BillDocument invoice={invoice} /> : error ? <div className="error" role="alert">{error}<button type="button" onClick={() => setAttempt(current => current + 1)}><RefreshCw size={16} /> Retry</button></div> : <div className="loading"><Loader2 /> Loading bill…</div>}</div>
    <div className="popup-footer"><p className="bill-print-help">Print the bill or choose “Save as PDF” in the print window.</p><div className="actions"><button type="button" onClick={close}>Close</button><button type="button" className="primary" disabled={!invoice} onClick={() => window.print()}><Printer /> Print / Save PDF</button></div></div>
  </section></div>, document.body);
}
