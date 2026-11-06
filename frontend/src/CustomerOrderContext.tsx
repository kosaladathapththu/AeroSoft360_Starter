import { useEffect, useState } from "react";
import { financeMoney, financeRequest } from "./finance-utils";
import { pendingCustomerOrders } from "./customer-order-context";
import "./customer-order-context.css";

export default function CustomerOrderContext({ api, customerId, data, articleIds, excludePoId, excludeOrderId }: {
  api: string; customerId: number; data: any; articleIds: number[]; excludePoId?: number; excludeOrderId?: number;
}) {
  const [finance, setFinance] = useState<{ customerId: number; summary: any } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    setFinance(null); setError(""); setExpanded(false);
    if (customerId) financeRequest(api, localStorage.getItem("aerosoft_token") || "", `customers/${customerId}/profile`)
      .then((result) => { if (active) setFinance({ customerId, summary: result.summary }); })
      .catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [api, customerId, retry]);
  if (!customerId) return null;
  const customer = data.customers.find((row: any) => Number(row.id) === customerId);
  const pending = pendingCustomerOrders(data, customerId, { poId: excludePoId, orderId: excludeOrderId });
  const confirmed = pending.filter((row) => row.stage === "Confirmed order");
  const requests = pending.filter((row) => row.stage === "Unconfirmed PO");
  const matches = pending.filter((row) => articleIds.includes(row.articleId));
  const summary = finance?.customerId === customerId ? finance.summary : null;
  const count = (rows: typeof pending) => rows.reduce((total, row) => total + row.pending, 0);
  return <section className="customer-order-context" aria-label="Customer outstanding and previous orders">
    <div className="customer-context-heading"><div><small>CUSTOMER SNAPSHOT</small><h3>{customer?.name || "Selected customer"}</h3></div>
      <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Hide previous orders" : `Previous orders (${new Set(pending.map((row) => row.document)).size})`}</button></div>
    <div className="customer-context-metrics">
      <div><span>Unpaid invoices</span><strong>{summary ? financeMoney(summary.outstanding) : error ? "Unavailable" : "Loading…"}</strong><small>Includes opening receivables</small></div>
      <div><span>Overdue balance</span><strong>{summary ? financeMoney(summary.overdue) : "—"}</strong><small>Invoices without terms are not classed as overdue</small></div>
      <div><span>Still to supply</span><strong>{count(confirmed)} <em>pieces</em></strong><small>Confirmed orders · dispatch not completed</small></div>
      <div><span>Awaiting confirmation</span><strong>{count(requests)} <em>pieces</em></strong><small>Unconverted customer POs</small></div>
    </div>
    {summary && Number(summary.customer_credit) > 0 && <p>Customer credit available: <b>{financeMoney(summary.customer_credit)}</b></p>}
    {error && <p className="customer-context-error" role="alert">Unable to load balances: {error} <button type="button" onClick={() => setRetry(retry + 1)}>Retry</button></p>}
    {matches.length > 0 && <div className="customer-context-alert" role="status"><b>Already on an earlier order</b>
      <span>{[...new Set(matches.map((row) => row.articleCode))].join(", ")}: {count(matches)} pieces still outstanding across previous orders / requests. Check the previous orders before adding more.</span></div>}
    {expanded && <div className="customer-context-history">
      <p>Previous saved orders only; the current draft is excluded. Quantities use the system’s combined dispatch-and-invoice records. Pending orders are separate from money owed.</p>
      {!pending.length ? <p>No outstanding orders or unconfirmed POs for this customer.</p> : <div className="customer-context-table"><table><thead><tr>{["Order / date", "Stage", "Article", "Size / colour", "Ordered", "Supplied", "Remaining"].map((name) => <th key={name}>{name}</th>)}</tr></thead>
        <tbody>{pending.map((row) => <tr key={row.key} className={articleIds.includes(row.articleId) ? "matching-article" : ""}>
          <td><b>{row.document}</b><small>{row.date}</small></td><td>{row.stage}</td><td><b>{row.articleCode}</b><small>{row.articleName}</small></td><td>{row.size}<small>{row.colour}</small></td><td>{row.ordered}</td><td>{row.supplied}</td><td><b>{row.pending}</b></td>
        </tr>)}</tbody></table></div>}
    </div>}
  </section>;
}
