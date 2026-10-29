import { useState } from "react";
import { financeToday } from "./finance-utils";
import { WorkflowModal } from "./BusinessWorkflowsPage";

export default function AccountOpeningModal({ accounts, save, close }: { accounts: any[]; save: (id: number, body: any) => Promise<void>; close: () => void }) {
  const [id,setId]=useState(Number(accounts[0]?.id || 0));
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  return <WorkflowModal title="Post account opening balance" busy={busy} close={close}>
    <form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError("");try{await save(id,{amount:Number(f.get('amount')),side:f.get('side'),balance_date:f.get('balance_date'),reason:f.get('reason')});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
      <p>Bring forward an existing balance against 3990 — Opening Balance Equity. Customer balances are entered when creating the customer, so receivables and aging stay linked.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <fieldset disabled={busy} className="finance-fields"><label>Account<select value={id} onChange={e=>setId(Number(e.target.value))} required>{accounts.map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <div className="form-row"><label>Amount (LKR)<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Balance side<select name="side"><option value="debit">Debit balance</option><option value="credit">Credit balance</option></select></label><label>Opening date<input name="balance_date" type="date" defaultValue={financeToday()} required /></label></div>
      <label>Previous records / reason<textarea name="reason" maxLength={500} required /></label>
      <p>The date must be on or before the first transaction, in an open accounting period. Each account can have one opening posting.</p>
      <button className="primary" disabled={busy || !id}>Post opening balance</button></fieldset>
    </form>
  </WorkflowModal>;
}
