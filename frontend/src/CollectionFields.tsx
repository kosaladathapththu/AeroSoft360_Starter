import { useEffect, useRef, useState } from "react";
import { displayCode } from "./representative-reference";
import { invoiceReference } from "./invoice-reference";
import { matchesSearch } from "./search";
import { collectionPlan } from "./collection-plan";
import OrderCustomerPicker from "./OrderCustomerPicker";
import "./customer-collections.css";

const money = (value: unknown) => `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CollectionFields({ data, initial, user, busy }: {
  data: any; initial?: any; user?: any; busy: boolean;
}) {
  const [customerId, setCustomerId] = useState(Number(initial?.customer_id || 0));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>(initial?.id ? [Number(initial.id)] : []);
  const [commissionIds, setCommissionIds] = useState<number[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [recipient, setRecipient] = useState("invoice_salesperson");
  const [requestKey] = useState(() => crypto.randomUUID());
  const amountInput = useRef<HTMLInputElement>(null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  const invoices = (data.invoices || []).filter((row: any) => Number(row.customer_id) === customerId && !["void", "cancelled"].includes(row.status))
    .sort((a: any, b: any) => String(a.invoice_date).localeCompare(String(b.invoice_date)) || Number(a.id) - Number(b.id));
  const visible = invoices.filter((row: any) => matchesSearch([invoiceReference(row), row.number, row.rep_name, row.invoice_date], query));
  const plan = collectionPlan(invoices, selected, Number(amount));
  const allocated = plan.allocations.filter((row) => row.amount > 0);
  const outstanding = invoices.reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0);
  const selectedTotal = invoices.filter((row: any) => selected.includes(Number(row.id))).reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0);
  const error = !customerId ? "Choose a customer." : !allocated.length ? "Enter an amount and tick at least one unpaid invoice." : plan.unallocated > 0 ? "The collection exceeds the selected invoice balances. Select more invoices or reduce the amount." : "";
  useEffect(() => { amountInput.current?.setCustomValidity(error); }, [error]);
  const reps = (data.reps || []).filter((row: any) => row.status === "active");
  const pendingCollections = (data.customer_collections || []).filter((row: any) => Number(row.customer_id) === customerId && row.status === "held");
  const pendingAmount = pendingCollections.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
  const history = (data.customer_collections || []).filter((row: any) => Number(row.customer_id) === customerId);
  const toggle = (id: number) => setSelected((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id]);
  return <fieldset className="collection-fields customer-collection-form" disabled={busy}>
    <input type="hidden" name="request_key" value={requestKey} />
    <input type="hidden" name="customer_id" value={customerId || ""} />
    <input type="hidden" name="allocations" value={JSON.stringify(allocated.map((row) => ({
      invoice_id: row.invoice_id, amount: row.amount,
      commission_decision: commissionIds.includes(row.invoice_id) ? recipient : "cancel",
    })))} />
    <section className="collection-section">
      <h3>Customer &amp; invoices</h3>
      <OrderCustomerPicker help="Search and choose a customer to list all their invoices." customers={data.customers || []} selectedId={customerId} select={(id) => {
        setCustomerId(id); setSelected([]); setCommissionIds([]); setAmount(""); setQuery("");
      }} />
      {customerId > 0 && <div className="collection-customer-balance"><span>Unpaid invoices <small>Pending cheques: {money(pendingAmount)}</small></span><strong>{money(outstanding)}</strong></div>}
    </section>
    {customerId > 0 && <>
      <section className="collection-section collection-payment-panel">
        <h3>Collection details</h3>
        <div className="collection-input-grid">
          <label>Amount collected (LKR)<input ref={amountInput} name="amount" type="number" min="0.01" step="0.01" value={amount} required placeholder="Enter total collected" onChange={(event) => setAmount(event.target.value)} /></label>
          <label>Collection date<input name="receipt_date" type="date" max={today} defaultValue={today} required /></label>
          <label>Payment method<select name="payment_method" value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cheque">Cheque</option></select></label>
          <label>Collected by<select name="collector_sales_rep_id" defaultValue={user?.sales_rep_id || ""} required><option value="" disabled>Choose collector</option>{reps.map((rep: any) => <option key={rep.id} value={rep.id}>{rep.name} - {displayCode(rep)}</option>)}</select></label>
          {method !== "cheque" && <label>Receive into<select name="payment_account_id" required defaultValue=""><option value="" disabled>Choose cash / bank account</option>{(data.payment_accounts || []).map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></label>}
          <label>Reference (optional)<input name="reference" maxLength={80} placeholder="Payment reference or note" /></label>
        </div>
        {method === "cheque" && <div className="collection-cheque-panel">
          <b>Cheque details</b>
          <div className="collection-input-grid">
            <label>Cheque number<input name="cheque_number" maxLength={80} required /></label>
            <label>Cheque bank / branch<input name="cheque_bank" maxLength={160} required /></label>
            <label>Cheque date<input name="cheque_date" type="date" required defaultValue={today} /></label>
          </div>
          <p>Received into 1120 - Cheques in Hand. This is pending clearance, not available cash. Commission is held until clearance. Use the cheque register to clear or return it.</p>
        </div>}
      </section>
      <section className="collection-section">
        <div className="collection-invoice-toolbar"><h3>Tick invoices to settle</h3>
          <button type="button" className="secondary" onClick={() => setSelected(invoices.filter((row: any) => Number(row.outstanding) > 0).map((row: any) => Number(row.id)))}>Select all unpaid</button>
          <button type="button" className="secondary" onClick={() => { setSelected([]); setCommissionIds([]); }}>Clear ticks</button>
        </div>
        <label>Search invoices<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Invoice number, date or salesperson" /></label>
        <p className="collection-search-status">{visible.length} invoices. Payments apply oldest first across the invoices you tick. Search does not change your ticks.</p>
        <div className="collection-table-scroll"><table className="collection-allocation-table"><thead><tr><th>Pay</th><th>Invoice / date</th><th>Salesperson</th><th>Bill value</th><th>Outstanding</th><th>This payment</th><th>After payment</th><th>Commission</th></tr></thead><tbody>
          {visible.map((row: any) => {
            const allocation = plan.allocations.find((item) => item.invoice_id === Number(row.id));
            return <tr key={row.id} className={selected.includes(Number(row.id)) ? "collection-selected-row" : ""}>
              <td><input type="checkbox" aria-label={`Pay ${invoiceReference(row)}`} checked={selected.includes(Number(row.id))} disabled={Number(row.outstanding) <= 0} onChange={() => toggle(Number(row.id))} /></td>
              <td><b>{invoiceReference(row)}</b><small>{row.invoice_date}</small>{Number(row.outstanding) <= 0 && <small>{(data.collection_allocations || []).some((line: any) => Number(line.invoice_id) === Number(row.id) && pendingCollections.some((cheque: any) => Number(cheque.id) === Number(line.collection_id))) ? "Covered by pending cheque" : "Settled"}</small>}</td>
              <td>{row.rep_name || "Unassigned"}</td><td>{money(row.total)}</td><td>{money(row.outstanding)}</td><td><b>{money(allocation?.amount)}</b></td>
              <td>{money(allocation?.remaining ?? row.outstanding)}{allocation && allocation.amount > 0 && <small>{allocation.remaining === 0 ? "Fully settled" : "Part payment"}</small>}</td>
              <td>{row.is_opening_balance ? <small>Opening balance: none</small> : <label className="collection-commission-check"><input type="checkbox" aria-label={`Commission for ${invoiceReference(row)}`} checked={commissionIds.includes(Number(row.id))} disabled={!selected.includes(Number(row.id))} onChange={(event) => setCommissionIds((old) => event.target.checked ? [...old, Number(row.id)] : old.filter((id) => id !== Number(row.id)))} /> Apply</label>}</td>
            </tr>;
          })}
          {!visible.length && <tr><td colSpan={8}>No matching invoices for this customer.</td></tr>}
        </tbody></table></div>
        <div className="collection-invoice-toolbar">
          <button type="button" className="secondary" disabled={!selected.length} onClick={() => setAmount(selectedTotal.toFixed(2))}>Use selected balances</button>
          <label>Commission recipient<select value={recipient} onChange={(event) => setRecipient(event.target.value)}><option value="invoice_salesperson">Each invoice salesperson</option><option value="collector">Payment collector</option></select></label>
        </div>
        <p className="collection-search-status">Only ticked commission entries are considered. Existing collection-day and per-piece rules apply; opening balances earn no commission.</p>
        <div className="collection-allocation-summary" role="status"><b>{allocated.length} invoices allocated · {money(Number(amount) - plan.unallocated)}</b><span>{error || (method === "cheque" ? "Ready to record as cheque pending clearance." : "Fully allocated. Ready to save collection.")}</span></div>
      </section>
      <section className="collection-section"><h3>Customer collection history</h3>
        <div className="collection-table-scroll"><table><thead><tr><th>Collection / date</th><th>Method / reference</th><th>Collected by</th><th>Amount</th><th>Status</th><th>Invoices paid</th></tr></thead><tbody>
          {history.map((row: any) => <tr key={row.id}><td><b>{row.number}</b><small>{row.receipt_date}</small></td><td>{row.payment_method}<small>{row.cheque_number || row.reference}</small></td><td>{row.collector_name}</td><td>{money(row.amount)}</td><td>{row.status}<small>{row.cheque_date ? `Cheque date: ${row.cheque_date}` : ""}</small></td><td>{(data.collection_allocations || []).filter((line: any) => Number(line.collection_id) === Number(row.id)).map((line: any) => <small key={line.id}>{invoiceReference({number: line.invoice_number})}: {money(line.amount)}</small>)}</td></tr>)}
          {!history.length && <tr><td colSpan={6}>No new customer collections recorded yet. Earlier individual receipts remain in Payment History.</td></tr>}
        </tbody></table></div>
      </section>
    </>}
  </fieldset>;
}
