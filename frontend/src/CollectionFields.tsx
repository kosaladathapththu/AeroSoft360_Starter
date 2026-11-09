import { useEffect, useRef, useState } from "react";
import { displayCode } from "./representative-reference";
import { invoiceReference } from "./invoice-reference";
import { matchesSearch } from "./search";
import { availableInvoicePayment, manualCollectionPlan } from "./collection-plan";
import OrderCustomerPicker from "./OrderCustomerPicker";
import "./customer-collections.css";

const money = (value: unknown) => `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CollectionFields({ data, initial, user, busy, correction }: {
  data: any; initial?: any; user?: any; busy: boolean; correction?: any;
}) {
  const [customerId, setCustomerId] = useState(Number(correction?.customer_id || initial?.customer_id || 0));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>(correction ? correction.allocations.map((line: any) => Number(line.invoice_id)) : initial?.id ? [Number(initial.id)] : []);
  const [invoiceAmounts, setInvoiceAmounts] = useState<Record<number, string>>(() => correction ? Object.fromEntries(correction.allocations.map((line: any) => [Number(line.invoice_id), String(line.amount)])) : initial?.id ? { [Number(initial.id)]: Number(initial.outstanding || 0).toFixed(2) } : {});
  const [commissionIds, setCommissionIds] = useState<number[]>(correction ? correction.allocations.filter((line: any) => Number(line.planned_commission) > 0).map((line: any) => Number(line.invoice_id)) : []);
  const [amount, setAmount] = useState(correction ? String(correction.amount) : "");
  const [method, setMethod] = useState(correction?.payment_method || "cash");
  const [deductCardCharge, setDeductCardCharge] = useState(Number(correction?.bank_charge_amount || 0) > 0);
  const cardCharge = method === "card" && deductCardCharge ? Math.round(Number(amount || 0) * 3) / 100 : 0;
  const [recipient, setRecipient] = useState("invoice_salesperson");
  const [requestKey] = useState(() => crypto.randomUUID());
  const amountInput = useRef<HTMLInputElement>(null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  const invoices = (data.invoices || []).filter((row: any) => Number(row.customer_id) === customerId && !["void", "cancelled"].includes(row.status))
    .sort((a: any, b: any) => String(a.invoice_date).localeCompare(String(b.invoice_date)) || Number(a.id) - Number(b.id));
  const visible = invoices.filter((row: any) => matchesSearch([invoiceReference(row), row.number, row.rep_name, row.invoice_date], query));
  const plan = manualCollectionPlan(invoices, selected, Number(amount), invoiceAmounts);
  const allocated = plan.allocations.filter((row) => row.amount > 0);
  const hasCommission = invoices.some((row: any) => !row.is_opening_balance);
  const outstanding = invoices.reduce((sum: number, row: any) => sum + Number(row.outstanding || 0), 0);
  const error = !customerId ? "Choose a customer."
    : !selected.length ? "Tick the invoices you want to pay."
    : plan.invalid.length ? "Enter a payment greater than zero and no more than the outstanding balance for each ticked invoice."
    : plan.unallocated > 0 ? `Still to allocate: ${money(plan.unallocated)}. Enter how much to pay toward each invoice.`
    : plan.unallocated < 0 ? `Allocated too much: ${money(-plan.unallocated)}. Reduce the invoice payments.`
    : Number(amount) <= 0 ? "Enter the total collected amount." : "";
  useEffect(() => { amountInput.current?.setCustomValidity(error); }, [error]);
  const reps = (data.reps || []).filter((row: any) => row.status === "active");
  const pendingCollections = (data.customer_collections || []).filter((row: any) => Number(row.customer_id) === customerId && row.status === "held");
  const pendingAmount = pendingCollections.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
  const history = (data.customer_collections || []).filter((row: any) => Number(row.customer_id) === customerId);
  const toggle = (id: number) => {
    if (selected.includes(id)) {
      setSelected((old) => old.filter((value) => value !== id));
      return;
    }
    const invoice = invoices.find((row: any) => Number(row.id) === id);
    if (!invoice || Number(invoice.outstanding) <= 0) return;
    const available = availableInvoicePayment(id, Number(invoice.outstanding), selected, Number(amount), invoiceAmounts);
    if (available <= 0) return;
    setInvoiceAmounts((old) => ({ ...old, [id]: available.toFixed(2) }));
    setSelected((old) => [...old, id]);
  };
  const selectAllUnpaid = () => {
    const unpaid = invoices.filter((row: any) => Number(row.outstanding) > 0);
    const nextSelected = [...selected];
    const updated = { ...invoiceAmounts };
    unpaid.forEach((row: any) => {
      const id = Number(row.id);
      if (nextSelected.includes(id)) return;
      const available = availableInvoicePayment(id, Number(row.outstanding), nextSelected, Number(amount), updated);
      if (available > 0) { updated[id] = available.toFixed(2); nextSelected.push(id); }
    });
    setInvoiceAmounts(updated);
    setSelected(nextSelected);
  };
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
        setCustomerId(id); setSelected([]); setInvoiceAmounts({}); setCommissionIds([]); setAmount(""); setQuery("");
      }} />
      {customerId > 0 && <div className="collection-customer-balance"><span><b>{invoices.filter((row: any) => Number(row.outstanding) > 0).length} unpaid invoices</b><small>{invoices.length} invoices in total · Pending cheques: {money(pendingAmount)}</small></span><strong>{money(outstanding)}</strong></div>}
    </section>
    {customerId > 0 && <>
      <section className="collection-section collection-payment-panel">
        <h3>Collection details</h3>
        <div className="collection-input-grid">
          <label>Amount collected (LKR)<input ref={amountInput} name="amount" type="number" min="0.01" step="0.01" value={amount} required placeholder="Enter total collected" onChange={(event) => setAmount(event.target.value)} /></label>
          <label>Collection date<input name="receipt_date" type="date" max={today} defaultValue={today} required /></label>
          <label>Payment method<select name="payment_method" value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cheque">Cheque</option></select></label>
          <label>Collected by (optional)<select name="collector_sales_rep_id" defaultValue={correction?.collector_sales_rep_id || user?.sales_rep_id || ""} required={recipient === "collector" && commissionIds.some(id => selected.includes(id))}><option value="">Not assigned</option>{reps.map((rep: any) => <option key={rep.id} value={rep.id}>{rep.name} - {displayCode(rep)}</option>)}</select></label>
          {method !== "cheque" ? <label>Receive into<select name="payment_account_id" required defaultValue={correction?.payment_account_id || ""}><option value="" disabled>Choose cash / bank account</option>{(data.payment_accounts || []).map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select><small>For a cheque, choose Cheque as the payment method.</small></label> : <label>Receive into<input value="1120 - Cheques in Hand" readOnly /><small>Current Assets · transferred to your bank only after clearance.</small></label>}
          <label>Reference (optional)<input name="reference" defaultValue={correction?.reference || ""} maxLength={80} placeholder="Payment reference or note" /></label>
        </div>
        {method === "card" && <div className="collection-cheque-panel">
          <label className="collection-commission-check"><input type="checkbox" name="deduct_card_charge" checked={deductCardCharge} onChange={event => setDeductCardCharge(event.target.checked)} /> Deduct 3% bank charge — paid by our business</label>
          <p>Customer payment: <b>{money(amount)}</b> · Bank charge: <b>{money(cardCharge)}</b> · Net received: <b>{money(Number(amount || 0) - cardCharge)}</b></p>
          <small>The full payment is allocated to invoices. Any charge posts to 5500 - Bank Charges expense.</small>
        </div>}
        {method === "cheque" && <div className="collection-cheque-panel">
          <b>Cheque details</b>
          <div className="collection-input-grid">
            <label>Cheque number<input name="cheque_number" defaultValue={correction?.cheque_number || ""} maxLength={80} required /></label>
            <label>Cheque bank / branch<input name="cheque_bank" defaultValue={correction?.cheque_bank || ""} maxLength={160} required /></label>
            <label>Cheque date<input name="cheque_date" type="date" required defaultValue={correction?.cheque_date || today} /></label>
          </div>
          <p>Received into 1120 - Cheques in Hand. This is pending clearance, not available cash. Commission is held until clearance. Use the cheque register to clear or return it.</p>
        </div>}
      </section>
      <section className="collection-section">
        <div className="collection-invoice-toolbar"><h3>Invoice payments</h3>
          <button type="button" className="secondary" disabled={plan.unallocated <= 0} onClick={selectAllUnpaid}>Auto allocate</button>
          <button type="button" className="secondary" disabled={!selected.length} onClick={() => { setSelected([]); setInvoiceAmounts({}); setCommissionIds([]); }}>Clear selection</button>
        </div>
        <label className="collection-invoice-search">Search invoices<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Invoice number, date or salesperson" /></label>
        <div className={`collection-allocation-summary ${error ? "needs-allocation" : "ready"}`} role="status">
          <span>Collected <b>{money(amount)}</b></span>
          <span>Allocated <b>{money(plan.total)}</b></span>
          <span>Remaining <b>{money(Math.max(0, plan.unallocated))}</b></span>
        </div>
        {error && selected.length > 0 && <p className="collection-search-status" role="status">{error}</p>}
        <div className="collection-table-scroll"><table className="collection-allocation-table simple-allocation-table"><thead><tr><th>Pay</th><th>Invoice</th><th>Outstanding</th><th>Available</th><th>Pay amount (LKR)</th><th>Balance after</th>{hasCommission && <th>Commission</th>}</tr></thead><tbody>
          {visible.map((row: any) => {
            const allocation = plan.allocations.find((item) => item.invoice_id === Number(row.id));
            const available = availableInvoicePayment(Number(row.id), Number(row.outstanding), selected, Number(amount), invoiceAmounts);
            return <tr key={row.id} className={selected.includes(Number(row.id)) ? "collection-selected-row" : ""}>
              <td><input type="checkbox" aria-label={`Pay ${invoiceReference(row)}`} checked={selected.includes(Number(row.id))} disabled={Number(row.outstanding) <= 0 || (!selected.includes(Number(row.id)) && available <= 0)} onChange={() => toggle(Number(row.id))} /></td>
              <td><b>{invoiceReference(row)}</b><small>{row.invoice_date} · {row.rep_name || "Unassigned"}</small>{Number(row.outstanding) <= 0 && <small>{(data.collection_allocations || []).some((line: any) => Number(line.invoice_id) === Number(row.id) && pendingCollections.some((cheque: any) => Number(cheque.id) === Number(line.collection_id))) ? "Covered by pending cheque" : "Settled"}</small>}</td>
              <td>{money(row.outstanding)}{Number(row.total) !== Number(row.outstanding) && <small>Bill: {money(row.total)}</small>}</td><td>{money(available)}</td><td className="collection-pay-cell">
                <div className="collection-manual-payment">
                  <input type="number" min="0.01" max={available} step="0.01"
                    aria-label={`Payment for ${invoiceReference(row)}`}
                    disabled={!selected.includes(Number(row.id))}
                    required={selected.includes(Number(row.id))}
                    value={selected.includes(Number(row.id)) ? invoiceAmounts[Number(row.id)] || "" : ""}
                    placeholder="Enter amount"
                    onChange={(event) => setInvoiceAmounts((old) => ({ ...old, [Number(row.id)]: event.target.value }))} />
                </div>
              </td>
              <td>{money(!error && allocation ? allocation.remaining : row.outstanding)}{allocation && allocation.amount > 0 && <small>{error ? "Adjust allocation before saving" : method === "cheque" ? "Pending cheque clearance" : allocation.remaining === 0 ? "Will settle on save" : "Part payment on save"}</small>}</td>
              {hasCommission && <td>{row.is_opening_balance ? <small>Not applicable</small> : <label className="collection-commission-check"><input type="checkbox" aria-label={`Commission for ${invoiceReference(row)}`} checked={commissionIds.includes(Number(row.id))} disabled={!selected.includes(Number(row.id))} onChange={(event) => setCommissionIds((old) => event.target.checked ? [...old, Number(row.id)] : old.filter((id) => id !== Number(row.id)))} /> Apply</label>}</td>}
            </tr>;
          })}
          {!visible.length && <tr><td colSpan={hasCommission ? 7 : 6}>No matching invoices for this customer.</td></tr>}
        </tbody></table></div>
        {hasCommission && <details className="collection-commission-options"><summary>Commission settings</summary><div className="collection-invoice-toolbar">
          <label>Commission recipient<select value={recipient} onChange={(event) => setRecipient(event.target.value)}><option value="invoice_salesperson">Each invoice salesperson</option><option value="collector">Payment collector</option></select></label>
        </div>
        <p className="collection-search-status">Applies only to ticked commission entries. Existing eligibility rules apply.</p></details>}
      </section>
      <details className="collection-section collection-history"><summary>Customer collection history ({history.length})</summary>
        <div className="collection-table-scroll"><table><thead><tr><th>Collection / date</th><th>Method / reference</th><th>Collected by</th><th>Amount</th><th>Status</th><th>Invoices paid</th></tr></thead><tbody>
          {history.map((row: any) => <tr key={row.id}><td><b>{row.number}</b><small>{row.receipt_date}</small></td><td>{row.payment_method}<small>{row.cheque_number || row.reference}</small></td><td>{row.collector_name || "Not assigned"}</td><td>{money(row.amount)}{Number(row.bank_charge_amount) > 0 && <small>Bank charge (3%): {money(row.bank_charge_amount)}<br />Net received: {money(Number(row.amount) - Number(row.bank_charge_amount))}</small>}</td><td>{row.status}<small>{row.cheque_date ? `Cheque date: ${row.cheque_date}` : ""}</small></td><td>{(data.collection_allocations || []).filter((line: any) => Number(line.collection_id) === Number(row.id)).map((line: any) => <small key={line.id}>{invoiceReference({number: line.invoice_number})}: {money(line.amount)}</small>)}</td></tr>)}
          {!history.length && <tr><td colSpan={6}>No new customer collections recorded yet. Earlier individual receipts remain in Payment History.</td></tr>}
        </tbody></table></div>
      </details>
    </>}
  </fieldset>;
}
