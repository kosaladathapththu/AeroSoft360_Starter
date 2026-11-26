import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { financeMoney } from "./finance-utils";
import { representativeReference, displayCode, displayReferenceValue } from "./representative-reference";
import { invoiceDisplayLines } from "./invoice-display-lines";

const labels: Record<string, string> = {
  number: "Document number", rep_name: "Salesperson", invoice_rep_name: "Invoice salesperson",
  collector_name: "Collected by", customer_name: "Customer", supplier_name: "Supplier",
  original_invoice_number: "Original invoice number", is_opening_balance: "Opening balance",
  received_amount: "Amount received", outstanding: "Outstanding balance", credit_days: "Credit terms (days)",
  rate: "Given rate / piece", fixed_rate: "Fixed rate / piece", unit_price: "Unit price",
  line_total: "Amount", quantity: "Pieces", pieces: "Pieces", sets: "Sets", net_salary: "Net salary",
  article_name: "Article", article_code: "Article code", size_label: "Size", colour: "Colour",
};
const moneyKey = /(^|_)(total|subtotal|amount|balance|outstanding|discount|tax|salary|cost|price|rate|debit|credit|limit|pay|deductions|additions)$/;
const hidden = new Set(["lines", "items", "review_changes", "created_at", "updated_at", "original_invoice_number"]);
const titleFor = (key: string) => labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export function readableReference(row: any): string {
  if (row.original_invoice_number) return `Invoice ${row.original_invoice_number}`;
  if (row.is_opening_balance && /^AR-(.+)-[a-f0-9]{12}$/i.test(row.number || "")) return `Invoice ${row.number.replace(/^AR-(.+)-[a-f0-9]{12}$/i, "$1")}`;
  return row.number || (row.code ? displayCode(row) : row.name) || "Record details";
}
export function detailValue(key: string, value: any): string {
  if (value == null || value === "") return key === "due_date" ? "Terms not set" : "Not recorded";
  if (typeof value === "boolean" || key.startsWith("is_")) return value === true || value === 1 || value === "1" ? "Yes" : "No";
  if (moneyKey.test(key) && Number.isFinite(Number(value))) return financeMoney(Number(value));
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} entries` : "Additional information recorded";
  if (key === "status" || key.endsWith("_type") || key === "payment_method") return String(value).replace(/_/g, " ");
  return String(value);
}

export default function RecordDetails({ page, row, close, onReturn }: { page: string; row: any; close: () => void; onReturn?: () => void }) {
  if (page === "Salespersons") row = { ...row, code: representativeReference(row) };
  row = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, displayReferenceValue(value, row, key)]));
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("keydown", escape); previous?.focus(); };
  }, [close]);
  const entries = Object.entries(row).filter(([key, value]) => !hidden.has(key) && key !== "id" && !key.endsWith("_id") && (value == null || typeof value !== "object"));
  const amounts = entries.filter(([key]) => moneyKey.test(key) && (!row.is_opening_balance || ["total", "received_amount", "outstanding", "returned_amount"].includes(key)));
  const information = entries.filter(([key]) => !moneyKey.test(key) && key !== "number");
  const sourceLines: any[] = Array.isArray(row.lines) ? row.lines : Array.isArray(row.items) ? row.items : [];
  const lines = page === "Invoices" ? invoiceDisplayLines(sourceLines) : sourceLines;
  const candidateColumns = ["article_code", "article_name", "material_name", "account_name", "name", "size_label", "colour", "order_mode", "sets", "pieces", "quantity", "invoiced_quantity", "fixed_rate", "rate", "unit_price", "unit_cost", "debit", "credit", "net_salary", "line_total"];
  const columns = candidateColumns.filter((key) => lines.some((line) => line[key] != null));
  return <div className="backdrop" onMouseDown={close}>
    <div className="modal record-details-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
      <div className="popup-header"><button ref={closeButton} type="button" className="close" onClick={close} aria-label="Close details"><X /></button><span>{page.toUpperCase()} / RECORD DETAILS</span><h2 id={titleId}>{readableReference(row)}</h2><p>{row.customer_name || row.supplier_name || "Review document information and financial details."}</p></div>
      <div className="popup-body">
        {row.is_opening_balance && <div className="record-details-notice"><b>Opening receivable</b><span>This is a brought-forward customer balance. It does not represent a new sale or stock movement.</span></div>}
        {amounts.length > 0 && <section className="record-details-section"><h3>Financial summary</h3><dl className="record-details-amounts">{amounts.map(([key, value]) => <div className={key === "outstanding" || key === "total" ? "emphasized" : ""} key={key}><dt>{titleFor(key)}</dt><dd>{detailValue(key, value)}</dd></div>)}</dl></section>}
        <section className="record-details-section"><h3>Document information</h3><dl className="record-details-information">{information.map(([key, value]) => <div key={key}><dt>{titleFor(key)}</dt><dd>{detailValue(key, value)}</dd></div>)}</dl></section>
        {(lines.length > 0 || ["Invoices", "Customer POs"].includes(page)) && <section className="record-details-section"><div className="record-details-section-heading"><h3>Item details</h3><small>{lines.length} lines</small></div>{lines.length ? <div className="record-details-table" tabIndex={0} role="region" aria-label="Item details; scroll horizontally for all columns"><table><thead><tr>{columns.map((key) => <th key={key}>{titleFor(key)}</th>)}</tr></thead><tbody>{lines.map((line, index) => <tr key={line.id ?? index}>{columns.map((key) => <td key={key}>{detailValue(key, line[key])}</td>)}</tr>)}</tbody></table></div> : <p className="record-details-empty">{row.is_opening_balance ? "No product lines apply to this opening balance. The amount above is the unpaid balance brought forward." : "No item lines recorded for this document."}</p>}</section>}
        {Array.isArray(row.review_changes) && row.review_changes.length > 0 && <section className="record-details-section"><h3>Review history &amp; reasons</h3>{row.review_changes.map((change: any, index: number) => <article className="record-details-history" key={index}><b>Size {change.size_label}{change.colour ? ` / ${change.colour}` : ""}</b><span>{change.original_quantity} to {change.quantity} pieces</span><p>{change.reason || "No reason recorded"}</p></article>)}</section>}
      </div>
      <div className="popup-footer"><div className="actions">{onReturn && <button type="button" className="primary" onClick={onReturn}>Return items</button>}<button type="button" onClick={close}>Close details</button></div></div>
    </div>
  </div>;
}
