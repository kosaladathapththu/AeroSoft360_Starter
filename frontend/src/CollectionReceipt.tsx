import { useEffect, useRef, useState } from "react";
import { invoiceReference } from "./invoice-reference";
import { printReport } from "./report-print";

const money = (value: unknown) => `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CollectionReceipt({ data, collection, close, printOnOpen = false }: { data: any; collection: any; close: () => void; printOnOpen?: boolean }) {
  const content = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const printed = useRef(false);
  const lines = (data.collection_allocations || []).filter((line: any) => Number(line.collection_id) === Number(collection.id));
  const inactive = ["void", "returned"].includes(collection.status);
  const account = (data.payment_accounts || []).find((row: any) => Number(row.id) === Number(collection.payment_account_id));
  const print = () => {
    if (content.current && !printReport({ key: "collection_settlement", title: `Payment receipt ${collection.number}`, group: "Customer settlement", from: collection.receipt_date, to: collection.receipt_date, source: content.current })) {
      setMessage("Allow printing in your browser, then click Print / PDF again.");
    }
  };
  useEffect(() => {
    if (printOnOpen && !printed.current) { printed.current = true; print(); }
  }, [printOnOpen]);
  return <section className="collection-receipt">
    <div className="collection-receipt-toolbar"><button className="secondary" onClick={close}>Back to collections</button><h2>Payment receipt · {collection.number}</h2><button className="primary" onClick={print}>Print / PDF</button></div>
    {message && <p role="status">{message}</p>}
    <div ref={content} className="collection-receipt-content">
      <h2>{collection.customer_name}</h2>
      {(() => {
        const customer = (data.customers || []).find((row: any) => Number(row.id) === Number(collection.customer_id));
        return customer && (customer.address || customer.phone || customer.email) && <p>{customer.address}{customer.address && <br />}{customer.phone}{customer.email && ` · ${customer.email}`}</p>;
      })()}
      <p><b>{collection.number}</b> · {collection.receipt_date} · Status: <b>{collection.status}</b>{inactive && " — not an active settlement"}</p>
      <p>Payment method: {collection.payment_method} · Collector: {collection.collector_name || "Not assigned"}<br />
        Received into: {account ? `${account.code} — ${account.name}` : collection.payment_method === "cheque" ? "1120 — Cheques in Hand" : "Account recorded in journal"}<br />Reference: {collection.reference || "None"}</p>
      {collection.cheque_number && <p>Cheque: {collection.cheque_number} · Bank: {collection.cheque_bank} · Cheque date: {collection.cheque_date}<br />
        {collection.status === "held" ? "Pending clearance — not cleared bank funds." : `Cleared: ${collection.cleared_date || "Not cleared"} · ${collection.cleared_account_name || ""}`}</p>}
      {(collection.void_reason || collection.return_reason) && <p><b>Reason:</b> {collection.void_reason || collection.return_reason} · Effective date: {collection.returned_date}</p>}
      {collection.replaces_collection_id && <p>Correction of COL-{String(collection.replaces_collection_id).padStart(6, "0")}. Original payment retained in the register.</p>}
      <div className="collection-receipt-totals"><span>Customer payment<b>{money(collection.amount)}</b></span><span>Business bank charge<b>{money(collection.bank_charge_amount)}</b></span><span>Net funds{collection.status === "held" ? " (pending)" : ""}<b>{money(Number(collection.amount) - Number(collection.bank_charge_amount || 0))}</b></span></div>
      <h3>Invoice settlement breakdown</h3>
      <table><thead><tr><th>Invoice / date</th><th>Bill total</th><th>Balance before</th><th>This payment</th><th>Balance after</th><th>Result</th></tr></thead><tbody>
        {lines.map((line: any) => <tr key={line.id}><td>{invoiceReference({number: line.invoice_number})}<br />{line.invoice_date}<br />{line.rep_name || "No salesperson"}</td><td>{money(line.invoice_total)}</td><td>{line.balance_before == null ? "Not recorded" : money(line.balance_before)}</td><td>{money(line.amount)}</td><td>{line.balance_after == null ? "Not recorded" : money(line.balance_after)}</td><td>{inactive ? "Reversed" : collection.status === "held" ? "Pending cheque clearance" : line.balance_after == null ? (line.settlement_type === "final" ? "Settled at payment" : "Part payment") : Number(line.balance_after) < 0.01 ? "Fully settled" : "Part payment"}</td></tr>)}
      </tbody></table>
      <p>Settlement balances refer to this payment, before later transactions. Older receipts without a saved balance show “Not recorded”.</p>
      {lines.some((line: any) => line.balance_after == null) && <p>Current invoice balances: {lines.map((line: any) => {
        const invoice = (data.invoices || []).find((row: any) => Number(row.id) === Number(line.invoice_id));
        return `${invoiceReference({number: line.invoice_number})}: ${invoice ? money(invoice.outstanding) : "Unavailable"}`;
      }).join(" · ")}. These include any later payments, returns or corrections.</p>}
      <h3>Purchased items by invoice</h3>
      {lines.map((allocation: any) => {
        const invoice = (data.invoices || []).find((row: any) => Number(row.id) === Number(allocation.invoice_id));
        let snapshot: any = null;
        try { snapshot = JSON.parse(allocation.invoice_snapshot || "null"); } catch { /* Legacy data uses original invoice lines. */ }
        const items = snapshot?.lines || invoice?.lines || [];
        return <section key={allocation.id} className="collection-receipt-invoice"><h4>{invoiceReference({number: allocation.invoice_number})} · {allocation.invoice_date}</h4>
          {items.length ? <table><thead><tr><th>Article / item</th><th>Size</th><th>Colour</th><th>Pieces</th><th>Fixed / piece</th><th>Invoice / piece</th><th>Item total</th></tr></thead><tbody>{items.map((item: any, index: number) => {
            const original = (invoice?.lines || []).find((row: any) => Number(row.id) === Number(item.id));
            return <tr key={index}><td>{item.article_code || original?.article_code || `Article ${item.article_id}`}<br />{item.article_name || original?.article_name}</td><td>{item.size_label || "Not recorded"}</td><td>{item.colour || "Not specified"}</td><td>{Number(item.quantity || 0)}</td><td>{item.fixed_rate == null ? "Not recorded" : money(item.fixed_rate)}</td><td>{money(item.rate)}</td><td>{money(item.line_total)}</td></tr>;
          })}</tbody></table> : <p>{invoice?.is_opening_balance ? "Opening receivable — purchased item details were not supplied with the opening balance." : "Purchased item details are unavailable in the original record."}</p>}
          <p>Invoice total: <b>{money(snapshot?.total ?? allocation.invoice_total)}</b> · Paid by this receipt: <b>{money(allocation.amount)}</b>{allocation.balance_after != null && <> · Remaining after this payment: <b>{money(allocation.balance_after)}</b></>}</p>
          {(snapshot || invoice) && <p>Discount: {money((snapshot || invoice).discount)} · Tax: {money((snapshot || invoice).tax)} · Due date: {(snapshot || invoice).due_date || "Terms not set"}</p>}
          {Number(allocation.planned_commission) > 0 && <p>Commission: {money(allocation.commission_amount)} · {allocation.commission_payee_name || "Not assigned"} · {allocation.commission_status}</p>}
        </section>;
      })}
      <p><b>Total allocated: {money(lines.reduce((sum: number, line: any) => sum + Number(line.amount), 0))}</b></p>
      <p>Received by: ____________________ &nbsp; Customer acknowledgement: ____________________</p>
    </div>
  </section>;
}
