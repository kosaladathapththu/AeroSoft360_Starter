import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { financeToday } from "./finance-utils";

export default function ManualOpeningModal({ data, save, close }: {
  data: any; save: (body: any) => Promise<void>; close: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    try { await save({ ...body, opening_due_date: body.opening_due_date || null, sales_rep_id: body.sales_rep_id || null }); close(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="backdrop"><form className="modal wide" role="dialog" aria-modal="true" aria-labelledby="manual-opening-title" onSubmit={submit}>
    <div className="popup-header"><button type="button" className="close" disabled={busy} onClick={close} aria-label="Close"><X /></button><span>CUSTOMER RECEIVABLES</span><h2 id="manual-opening-title">New opening balance</h2></div>
    <div className="popup-body">
      <p>Enter a customer's unpaid balance from before system use. This posts a receivable and its opening journal without creating sales or moving stock.</p>
      {error && <div className="error" role="alert">{error}</div>}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <div className="form-row">
          <label>Customer<select name="customer_id" required><option value="">Choose customer</option>{data.customers.map((c: any) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}</select></label>
          <label>Original invoice / opening reference<input name="opening_reference" required maxLength={60} placeholder="e.g. 25225 or OB-2026-001" /></label>
          <label>Unpaid amount (LKR)<input name="opening_balance" type="number" required min="0.01" step="0.01" /></label>
          <label>Original invoice date<input name="invoice_date" type="date" required max={financeToday()} /></label>
          <label>Opening posting date<input name="opening_date" type="date" required defaultValue={financeToday()} max={financeToday()} /><small>Must belong to an open accounting period.</small></label>
          <label>Due date (optional)<input name="opening_due_date" type="date" /><small>Leave blank when credit terms are unknown.</small></label>
          <label>Salesperson (optional)<select name="sales_rep_id"><option value="">Not assigned</option>{data.reps.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label>Opening offset account<select name="opening_account_id" required defaultValue={data.opening_accounts?.find((a: any) => a.code === "3990")?.id || ""}><option value="">Choose equity account</option>{data.opening_accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select></label>
        </div>
        <label>Source / reason<textarea name="reason" required maxLength={1000} rows={3} placeholder="Source invoice, statement or approved opening balance reference" /></label>
      </fieldset>
    </div>
    <div className="popup-footer"><div className="actions"><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Posting..." : "Post opening balance"}</button></div></div>
  </form></div>;
}
