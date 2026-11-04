import { X, Package } from "lucide-react";
import { financeMoney } from "./finance-utils";
import "./sales-order-details.css";

export function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function SalesOrderDetails({ row, close }: { row: any; close: () => void }) {
  const lines = Array.isArray(row.lines) ? row.lines : [];
  const quantity = (value: unknown) => {
    const number = optionalNumber(value);
    return number == null ? "Not recorded" : number.toLocaleString();
  };
  const amount = (value: unknown) => {
    const number = optionalNumber(value);
    return number == null ? "Not recorded" : financeMoney(number);
  };
  const totalPieces = lines.reduce((sum: number, line: any) => sum + (optionalNumber(line.quantity) ?? 0), 0);
  const invoicedPieces = lines.reduce((sum: number, line: any) => sum + (optionalNumber(line.invoiced_quantity) ?? 0), 0);
  return <div className="backdrop" onMouseDown={close}>
    <div className="modal sales-order-details" role="dialog" aria-modal="true" aria-labelledby="sales-order-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="popup-header">
        <button className="close" onClick={close} aria-label="Close sales order"><X /></button>
        <span>SALES ORDER DETAILS</span>
        <h2 id="sales-order-detail-title">{row.number || "Sales order"}</h2>
        <p>Customer, ordered sizes and dispatch progress in one place.</p>
      </div>
      <div className="popup-body">
        <section className="so-detail-summary" aria-label="Order summary">
          <div><small>Customer</small><strong>{row.customer_name || "Not recorded"}</strong></div>
          <div><small>Salesperson</small><strong>{row.rep_name || "Not assigned"}</strong></div>
          <div><small>Order date</small><strong>{row.order_date || "Not recorded"}</strong></div>
          <div><small>Status</small><strong className="so-detail-status">{String(row.status || "Not recorded").replace(/_/g, " ")}</strong></div>
        </section>
        <section className="so-detail-progress" aria-label="Fulfilment summary">
          <div><small>Ordered</small><b>{quantity(totalPieces)} pieces</b></div>
          <div><small>Invoiced</small><b>{quantity(invoicedPieces)} pieces</b></div>
          <div><small>To dispatch</small><b>{quantity(Math.max(0, totalPieces - invoicedPieces))} pieces</b></div>
        </section>
        <div className="so-detail-section-title"><h3><Package size={19} /> Order items</h3><span>{lines.length} size lines</span></div>
        <div className="so-detail-table-wrap" tabIndex={0} role="region" aria-label="Order items; scroll horizontally for all columns">
          <table className="so-detail-table">
            <thead><tr>{["Article", "Size", "Colour", "Ordered", "Invoiced", "Remaining", "Fixed / piece", "Given / piece", "Amount"].map((title) => <th key={title}>{title}</th>)}</tr></thead>
            <tbody>{lines.map((line: any, index: number) => {
              const ordered = optionalNumber(line.quantity);
              const invoiced = optionalNumber(line.invoiced_quantity);
              const remaining = optionalNumber(line.remaining_quantity) ?? (ordered != null && invoiced != null ? Math.max(0, ordered - invoiced) : null);
              const rate = optionalNumber(line.rate);
              const lineAmount = optionalNumber(line.line_total) ?? (ordered != null && rate != null ? Math.round(ordered * rate * 100) / 100 : null);
              return <tr key={line.id ?? index}>
                <td><b>{line.article_code || "Not recorded"}</b><small>{line.article_name || ""}</small></td>
                <td><span className="so-detail-size">{line.size_label || "Not recorded"}</span></td>
                <td>{line.colour || "Not specified"}</td>
                <td>{quantity(ordered)}</td><td>{quantity(invoiced)}</td><td>{quantity(remaining)}</td>
                <td>{amount(line.fixed_rate)}</td><td>{amount(rate)}</td><td><b>{amount(lineAmount)}</b></td>
              </tr>;
            })}{!lines.length && <tr><td colSpan={9}>No order items recorded.</td></tr>}</tbody>
          </table>
        </div>
        <p className="so-detail-note">Fixed price is the saved price-list snapshot. Given price is the rate recorded for this order. Each row identifies the exact article, size and colour.</p>
        {row.review_changes?.length > 0 && <section className="so-detail-history"><h3>Review changes &amp; reasons</h3>{row.review_changes.map((change: any, index: number) => <div key={index}><b>Size {change.size_label}{change.colour ? ` / ${change.colour}` : ""}</b><span>{quantity(change.original_quantity)} to {quantity(change.quantity)} pieces</span><p>{change.reason || "No reason recorded"}</p></div>)}</section>}
      </div>
      <div className="popup-footer so-detail-footer"><div><small>Order total</small><strong>{amount(row.total)}</strong></div><button type="button" onClick={close}>Close</button></div>
    </div>
  </div>;
}
