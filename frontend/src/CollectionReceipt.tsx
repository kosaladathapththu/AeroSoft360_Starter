import { useEffect, useRef, useState } from "react";
import { invoiceReference } from "./invoice-reference";
import { printReport } from "./report-print";
import receiptPrintStyles from "./collection-receipt-print.css?inline";

const money = (value: unknown) => `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CollectionReceipt({ data, collection, close, printOnOpen = false }: { data: any; collection: any; close: () => void; printOnOpen?: boolean }) {
  const content = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const printed = useRef(false);
  const lines = (data.collection_allocations || []).filter((line: any) => Number(line.collection_id) === Number(collection.id));
  const invoiceFor = (line: any) => (data.invoices || []).find((row: any) => Number(row.id) === Number(line.invoice_id));
  const entries = lines.map((allocation: any) => {
    const invoice = invoiceFor(allocation);
    let snapshot: any = null;
    try { snapshot = JSON.parse(allocation.invoice_snapshot || "null"); } catch { /* Legacy receipts use their original invoice. */ }
    return { allocation, invoice, snapshot, items: snapshot?.lines || invoice?.lines || [] };
  });
  const legacyBalances = lines.some((line: any) => line.balance_after == null);
  const hasBefore = lines.every((line: any) => line.balance_before != null);
  const inactive = ["void", "returned"].includes(collection.status);
  const account = (data.payment_accounts || []).find((row: any) => Number(row.id) === Number(collection.payment_account_id));
  const print = () => {
    if (content.current && !printReport({ key: "collection_settlement", title: `Payment receipt ${collection.number}`, group: "Customer settlement", from: collection.receipt_date, to: collection.receipt_date, source: content.current, styles: receiptPrintStyles })) {
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
      <h2 className="receipt-customer">{collection.customer_name}</h2>
      {(() => {
        const customer = (data.customers || []).find((row: any) => Number(row.id) === Number(collection.customer_id));
        return customer && (customer.address || customer.phone || customer.email) && <p>{customer.address}{customer.address && <br />}{customer.phone}{customer.email && ` · ${customer.email}`}</p>;
      })()}
      <div className="receipt-payment-details">
        <p><span>Receipt</span><b>{collection.number}</b></p>
        <p><span>Payment date</span><b>{collection.receipt_date}</b></p>
        <p><span>Method / status</span><b>{collection.payment_method.replaceAll("_", " ")} / {collection.status}</b></p>
        <p><span>Collector</span><b>{collection.collector_name || "Not assigned"}</b></p>
        <p><span>Received into</span><b>{account ? account.name : collection.payment_method === "cheque" ? "Cheques in Hand" : "See collection journal"}</b></p>
        {collection.reference && <p><span>Reference</span><b>{collection.reference}</b></p>}
      </div>
      {inactive && <p className="receipt-note"><b>Reversed receipt ? not an active settlement.</b></p>}
      {collection.cheque_number && <p>Cheque: {collection.cheque_number} · Bank: {collection.cheque_bank} · Cheque date: {collection.cheque_date}<br />
        {collection.status === "held" ? "Pending clearance — not cleared bank funds." : `Cleared: ${collection.cleared_date || "Not cleared"} · ${collection.cleared_account_name || ""}`}</p>}
      {(collection.void_reason || collection.return_reason) && <p><b>Reason:</b> {collection.void_reason || collection.return_reason} · Effective date: {collection.returned_date}</p>}
      {collection.replaces_collection_id && <p>Correction of COL-{String(collection.replaces_collection_id).padStart(6, "0")}. Original payment retained in the register.</p>}
      <div className="receipt-payment-summary"><span>Payment received<strong>{money(collection.amount)}</strong></span><span>Invoices covered<strong>{lines.length}</strong></span>{Number(collection.bank_charge_amount) > 0 && <span>Bank charge<strong>{money(collection.bank_charge_amount)}</strong><small>Net funds: {money(Number(collection.amount) - Number(collection.bank_charge_amount))}</small></span>}</div>
      <h3>Invoice settlement breakdown</h3>
      <table className="receipt-settlement-table"><thead><tr><th>Invoice / date</th><th>Invoice total</th>{hasBefore && <th>Balance before</th>}<th>Paid now</th><th>{legacyBalances ? "Remaining *" : "Remaining"}</th><th>Settlement</th></tr></thead><tbody>
        {lines.map((line: any) => {
          const current = invoiceFor(line);
          const remaining = line.balance_after == null ? current?.outstanding : line.balance_after;
          return <tr key={line.id}><td><b>{invoiceReference({number: line.invoice_number})}</b><small>{line.invoice_date}</small>{line.rep_name && <small>{line.rep_name}</small>}</td><td>{money(line.invoice_total)}</td>{hasBefore && <td>{money(line.balance_before)}</td>}<td><b>{money(line.amount)}</b></td><td>{remaining == null ? "Unavailable" : money(remaining)}{line.balance_after == null && <small>Current balance</small>}</td><td>{inactive ? "Reversed" : collection.status === "held" ? "Cheque pending" : line.balance_after == null ? (line.settlement_type === "final" ? "Fully settled" : "Part payment") : Number(line.balance_after) < 0.01 ? "Fully settled" : "Part payment"}</td></tr>;
        })}
      </tbody></table>
      {legacyBalances && <p className="receipt-note">* Older receipt: remaining amounts are current invoice balances, including later activity.</p>}
      {entries.some((entry: any) => entry.items.length) && <h3>Purchased items by invoice</h3>}

      {entries.filter((entry: any) => entry.items.length).map(({allocation, invoice, snapshot, items}: any) => {
        return <section key={allocation.id} className="collection-receipt-invoice"><h4>{invoiceReference({number: allocation.invoice_number})} · {allocation.invoice_date}</h4>
          {items.length ? <table><thead><tr><th>Article / item</th><th>Size</th><th>Colour</th><th>Pieces</th><th>Fixed / piece</th><th>Invoice / piece</th><th>Item total</th></tr></thead><tbody>{items.map((item: any, index: number) => {
            const original = (invoice?.lines || []).find((row: any) => Number(row.id) === Number(item.id));
            return <tr key={index}><td>{item.article_code || original?.article_code || `Article ${item.article_id}`}<br />{item.article_name || original?.article_name}</td><td>{item.size_label || "Not recorded"}</td><td>{item.colour || "Not specified"}</td><td>{Number(item.quantity || 0)}</td><td>{item.fixed_rate == null ? "Not recorded" : money(item.fixed_rate)}</td><td>{money(item.rate)}</td><td>{money(item.line_total)}</td></tr>;
          })}</tbody></table> : <p>{invoice?.is_opening_balance ? "Opening receivable — purchased item details were not supplied with the opening balance." : "Purchased item details are unavailable in the original record."}</p>}
          {(Number((snapshot || invoice)?.discount) > 0 || Number((snapshot || invoice)?.tax) > 0) && <p>Discount: {money((snapshot || invoice).discount)} ? Tax: {money((snapshot || invoice).tax)}</p>}
          {Number(allocation.planned_commission) > 0 && <p>Commission: {money(allocation.commission_amount)} · {allocation.commission_payee_name || "Not assigned"} · {allocation.commission_status}</p>}
        </section>;
      })}
      {entries.some((entry: any) => !entry.items.length) && <p className="receipt-note">Opening / historical invoices without item records: {entries.filter((entry: any) => !entry.items.length).map((entry: any) => invoiceReference({number: entry.allocation.invoice_number})).join(", ")}. Purchased item details were not supplied.</p>}
      <div className="receipt-closing"><p className="receipt-allocated-total"><span>Total allocated</span><strong>{money(lines.reduce((sum: number, line: any) => sum + Number(line.amount), 0))}</strong></p><div className="receipt-signatures"><span>Received by<br /><b>________________________</b></span><span>Customer acknowledgement<br /><b>________________________</b></span></div></div>
    </div>
  </section>;
}
