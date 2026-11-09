import { useEffect, useState } from "react";
import { invoiceReference } from "./invoice-reference";
import { matchesSearch } from "./search";
import "./customer-collections.css";
import CollectionReceipt from "./CollectionReceipt";
import CollectionFields from "./CollectionFields";

const money = (value: unknown) => `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CollectionRegister({ data, canManage, post, savedId }: {
  data: any; savedId?: number | null; canManage: boolean; post: (path: string, body: any) => Promise<any>;
}) {
  const [viewId, setViewId] = useState<number | null>(savedId || null);
  useEffect(() => { if (savedId) setViewId(savedId); }, [savedId]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [action, setAction] = useState<{ id: number; type: string } | null>(null);
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }));
  const [bank, setBank] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const rows = (data.customer_collections || []).filter((row: any) => (!status || row.status === status) && matchesSearch(row, query));
  const selected = (data.customer_collections || []).find((row: any) => Number(row.id) === action?.id);
  const act = async () => {
    if (!action) return;
    setBusy(true); setMessage("");
    try {
      await post(`customer-collections/${action.id}/${action.type === "void" ? "void" : "cheque"}`, { action: action.type, date, bank_account_id: bank ? Number(bank) : null, reason });
      setMessage(action.type === "void" ? "Collection reversed. Invoice balances restored; original receipt retained." : action.type === "clear" ? "Cheque cleared into the selected account." : "Cheque returned. Invoice balances restored and commission reversed.");
      setAction(null);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const viewed = (data.customer_collections || []).find((row: any) => Number(row.id) === viewId);
  if (viewed) return <CollectionReceipt data={data} collection={viewed} close={() => setViewId(null)} />;
  if (action?.type === "edit" && selected) {
    const allocations = (data.collection_allocations || []).filter((line: any) => Number(line.collection_id) === action.id);
    const adjusted = { ...data, customers: (data.customers || []).filter((row: any) => Number(row.id) === Number(selected.customer_id)), invoices: (data.invoices || []).map((invoice: any) => {
      const old = allocations.find((line: any) => Number(line.invoice_id) === Number(invoice.id));
      return old ? { ...invoice, outstanding: Number(invoice.outstanding) + Number(old.amount) } : invoice;
    }) };
    return <section className="collection-section"><h2>Edit collection {selected.number}</h2><p>This correction reverses the original payment and records a replacement today. Nothing changes until you save.</p>
      {message && <p role="alert">{message}</p>}
      <form onSubmit={async (event) => {
        event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setMessage("");
        try {
          const result = await post(`customer-collections/${action.id}/correct`, {
            request_key: fields.get("request_key"), customer_id: Number(fields.get("customer_id")),
            collector_sales_rep_id: Number(fields.get("collector_sales_rep_id")) || null,
            payment_account_id: Number(fields.get("payment_account_id")) || null,
            receipt_date: fields.get("receipt_date"), payment_method: fields.get("payment_method"),
            amount: Number(fields.get("amount")), reference: fields.get("reference"),
            cheque_number: fields.get("cheque_number"), cheque_bank: fields.get("cheque_bank"), cheque_date: fields.get("cheque_date"),
            deduct_card_charge: fields.get("deduct_card_charge") === "on", allocations: JSON.parse(String(fields.get("allocations") || "[]")), reason: fields.get("reason"),
          });
          setAction(null); setViewId(Number(result.id));
        } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
      }}>
        <CollectionFields data={adjusted} busy={busy} correction={{ ...selected, allocations }} />
        <label className="collection-correction-reason">Reason for edit<textarea name="reason" required minLength={3} maxLength={500} /></label>
        <div className="collection-register-actions"><button className="primary" disabled={busy}>Save correction & view receipt</button><button type="button" className="secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</button></div>
      </form></section>;
  }
  return <section className="collection-register collection-section">
    <div className="collection-invoice-toolbar"><h3>Collections &amp; cheque register</h3>
      <input type="search" aria-label="Search collection register" placeholder="Customer, collection or cheque number" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Collection status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="held">Cheques awaiting clearance</option><option value="cleared">Cleared cheques</option><option value="returned">Returned cheques</option><option value="received">Cash / bank collections</option><option value="void">Deleted / reversed</option><option value="">All collections</option></select>
    </div>
    <p className="collection-search-status">Dated cheques stay in Cheques in Hand until cleared. Returned cheques restore the customer's unpaid invoices. Details and dated journal entries are retained.</p>
    {message && <p role="status" className="collection-action-message">{message}</p>}
    {action && selected && <div className="collection-cheque-panel collection-action-panel">
      <b>{action.type === "void" ? "Delete / reverse collection" : action.type === "clear" ? "Clear cheque" : "Return cheque"}: {selected.number} · {selected.customer_name} · {money(selected.amount)}</b>
      <div className="collection-input-grid">
        <label>Action date<input type="date" value={date} max={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" })} min={action.type === "clear" ? [selected.cheque_date, selected.receipt_date].sort()[1] : selected.cleared_date || selected.receipt_date} onChange={(event) => setDate(event.target.value)} /></label>
        {action.type === "clear" ? <label>Cleared into<select value={bank} onChange={(event) => setBank(event.target.value)}><option value="">Choose cash / bank account</option>{(data.payment_accounts || []).map((row: any) => <option key={row.id} value={row.id}>{row.code} - {row.name}</option>)}</select></label> : <label>Reason for deletion / return<input value={reason} maxLength={500} placeholder="Bank return reason" onChange={(event) => setReason(event.target.value)} /></label>}
      </div>
      <div className="collection-invoice-toolbar"><button type="button" className="primary" disabled={busy || !date || (action.type === "clear" ? !bank : reason.trim().length < 3)} onClick={act}>{busy ? "Posting..." : action.type === "void" ? "Confirm deletion & reverse payment" : action.type === "clear" ? "Confirm bank clearance" : "Confirm return & restore balances"}</button><button type="button" className="secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</button></div>
    </div>}
    <div className="collection-table-scroll collection-register-rows"><table><thead><tr><th>Collection / customer</th><th>Date / collector</th><th>Method / cheque</th><th>Amount</th><th>Status / bank</th><th>Allocated invoices</th><th>Actions</th></tr></thead><tbody>
      {rows.map((row: any) => <tr key={row.id}><td><b>{row.number}</b><small>{row.customer_name}</small></td><td>{row.receipt_date}<small>{row.collector_name || "Not assigned"}</small></td><td>{row.payment_method}<small>{row.cheque_number || row.reference}</small><small>{row.cheque_bank}</small>{row.cheque_date && <small>Due {row.cheque_date}</small>}</td><td>{money(row.amount)}{Number(row.bank_charge_amount) > 0 && <small>Bank charge (3%): {money(row.bank_charge_amount)}<br />Net received: {money(Number(row.amount) - Number(row.bank_charge_amount))}</small>}</td><td><b>{row.status === "held" ? "Pending clearance" : row.status}</b><small>{row.cleared_account_name}</small><small>{row.return_reason}</small><small>{row.returned_date ? `Returned ${row.returned_date}` : row.cleared_date ? `Cleared ${row.cleared_date}` : ""}</small></td><td>{(data.collection_allocations || []).filter((line: any) => Number(line.collection_id) === Number(row.id)).map((line: any) => <small key={line.id}>{invoiceReference({ number: line.invoice_number })} · {money(line.amount)}{row.status === "returned" ? " (reopened)" : row.status === "held" ? " (pending clearance)" : line.settlement_type === "final" ? " (fully settled)" : " (part payment)"}{Number(line.planned_commission) > 0 && <small>Commission: {money(row.status === "held" ? line.planned_commission : line.commission_amount)} {row.status === "held" ? "pending clearance" : row.status === "returned" ? "reversed" : "earned"} / {line.commission_payee_name}</small>}</small>)}</td><td><div className="collection-register-actions"><button type="button" className="collection-view-button" onClick={() => setViewId(Number(row.id))}>View / Print</button>{canManage && ["received", "held", "cleared"].includes(row.status) && <><button type="button" className="collection-edit-button" onClick={() => { setAction({id: Number(row.id), type: "edit"}); setMessage(""); }}>Edit</button><button type="button" className="danger" onClick={() => { setAction({id: Number(row.id), type: "void"}); setReason(""); setMessage(""); }}>Delete</button></>}</div>{canManage && row.payment_method === "cheque" && ["held", "cleared"].includes(row.status) && <div className="collection-register-actions">{row.status === "held" && <button type="button" className="primary" onClick={() => { setAction({id: Number(row.id), type: "clear"}); setBank(""); setReason(""); setMessage(""); }}>Clear</button>}<button type="button" className="danger" onClick={() => { setAction({id: Number(row.id), type: "return"}); setReason(""); setMessage(""); }}>Return</button></div>}</td></tr>)}
      {!rows.length && <tr><td colSpan={7}>No collections match this selection.</td></tr>}
    </tbody></table></div>
  </section>;
}
