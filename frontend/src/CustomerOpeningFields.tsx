import { useState } from "react";
import { financeToday } from "./finance-utils";

export default function CustomerOpeningFields({ accounts = [] }: { accounts?: any[] }) {
  const [amount, setAmount] = useState(0);
  return <fieldset className="opening-balance-fields"><legend>Opening balance (optional)</legend>
    <p>Enter the balance brought forward from your previous records. This is not a new sale or a cash payment.</p>
    <div className="form-row">
      <label>Opening amount (LKR)<input name="opening_balance" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
      <label>Balance type<select name="opening_type"><option value="receivable">Customer owes us</option><option value="credit">Credit held for customer</option></select></label>
      <label>Balance date<input name="opening_date" type="date" defaultValue={financeToday()} required={amount > 0} /></label>
      <label>Original due date (if customer owes us)<input name="opening_due_date" type="date" /><small>Used for aging. Defaults to the balance date.</small></label>
      <label>Opening equity account<select name="opening_account_id" defaultValue={accounts.find(a => a.code === "3990")?.id || ""} required={amount > 0}><option value="">Default: 3990 — Opening Balance Equity</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
    </div><small>The balance is posted once when this customer is created. Posted opening balances cannot be changed through customer contact edits.</small>
  </fieldset>;
}
