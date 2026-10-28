import { useState } from "react";

const money = (amount: unknown) => `LKR ${Number(amount || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CollectionFields({ data, initial, user, busy }: { data: any; initial?: any; user?: any; busy: boolean }) {
  const invoices = data.invoices.filter((invoice: any) => Number(invoice.outstanding) > 0);
  const reps = data.reps.filter((rep: any) => rep.status === "active");
  const [invoiceId, setInvoiceId] = useState(Number(initial?.id || invoices[0]?.id || 0));
  const invoice = invoices.find((item: any) => Number(item.id) === invoiceId);
  const [amount, setAmount] = useState("");
  const [collectionType, setCollectionType] = useState("auto");
  const [collectorId, setCollectorId] = useState(Number(user?.sales_rep_id || reps.find((rep: any) => Number(rep.id) === Number(invoice?.sales_rep_id))?.id || reps[0]?.id || 0));
  const balance = Number(invoice?.outstanding || 0);
  const paid = Number(amount || 0);
  const overpaid = paid > balance;
  const finalMismatch = collectionType === "final" && amount !== "" && paid !== balance;
  if (!invoice) return <div className="collection-no-invoices" role="status"><b>No unpaid invoices</b><p>There are no outstanding invoices available to collect payment for.</p></div>;
  return <fieldset className="collection-fields" disabled={busy}>
    <section className="collection-section"><h3>1. Choose the invoice</h3><label>Outstanding invoice<select name="invoice_id" value={invoiceId} required onChange={event => { setInvoiceId(Number(event.target.value)); setAmount(""); }}>
      {invoices.map((item: any) => <option key={item.id} value={item.id}>{item.number} - {item.customer_name}</option>)}
    </select></label><div className="collection-invoice-summary"><div><small>Customer</small><b>{invoice.customer_name}</b><span>Salesperson: {invoice.rep_name}</span></div><div><small>Balance to collect</small><strong>{money(balance)}</strong></div></div></section>
    <section className="collection-section"><h3>2. Enter the payment</h3><div className="form-row"><label>Amount received (LKR)<input name="amount" type="number" min="0.01" max={balance} step="0.01" value={amount} placeholder="Enter received amount" required aria-describedby="collection-balance-message" ref={node => node?.setCustomValidity(finalMismatch ? "A final settlement must pay the full outstanding balance." : "")} onChange={event => setAmount(event.target.value)} /></label><label>Receipt date<input name="receipt_date" type="date" defaultValue={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" })} required /></label></div>
      <div className="collection-amount-help"><button type="button" onClick={() => { setAmount(balance.toFixed(2)); }}>Use full balance</button><span id="collection-balance-message" role="status">{overpaid ? "Amount exceeds the outstanding balance." : finalMismatch ? "Final settlement must match the full balance." : `Remaining after payment: ${money(Math.max(0, balance - paid))}`}</span></div>
      <div className="form-row"><label>Payment method<select name="payment_method"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="card">Card</option></select></label><label>Payment collected by<select name="collector_sales_rep_id" value={collectorId} required onChange={event => setCollectorId(Number(event.target.value))}><option value="" disabled>Choose collector</option>{reps.map((rep: any) => <option key={rep.id} value={rep.id}>{rep.code} - {rep.name}</option>)}</select></label></div>
      <label>Reference <span className="commission-optional">Optional</span><input name="reference" maxLength={80} placeholder="Bank reference, cheque number or note" /></label>
      <label>Deposit to<select name="payment_account_id" required defaultValue={data.payment_accounts?.[0]?.id || ""}><option value="" disabled>Choose cash / bank account</option>{(data.payment_accounts || []).map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></label>
    </section>
    <details className="collection-options"><summary>Collection type &amp; commission options</summary><div className="form-row"><label>Collection type<select value={collectionType} onChange={event => setCollectionType(event.target.value)}><option value="auto">Automatic: partial / final</option><option value="regular">Regular collection</option><option value="partial">Partial collection</option><option value="final">Final settlement</option><option value="recovery">Overdue debt recovery</option></select><input type="hidden" name="collection_type" value={collectionType === "auto" ? (paid === balance ? "final" : "partial") : collectionType} /></label><label>Commission recipient<select name="commission_decision" defaultValue="invoice_salesperson"><option value="invoice_salesperson">Invoice salesperson</option><option value="collector">Payment collector</option><option value="cancel">No commission</option></select></label></div><p>Commission defaults to the invoice salesperson. The {data.commission_settings?.max_collection_days || 100}-day collection policy applies.</p></details>
  </fieldset>;
}
