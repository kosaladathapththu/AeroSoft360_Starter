import { Plus, Trash2 } from "lucide-react";
import ItemSearchSelect from "./ItemSearchSelect";
import { emptyJournalLine, journalTotals, JournalDraftLine } from "./journal-draft";
import "./journal-entry.css";

export default function JournalEntryLines({ accounts, lines, change }: {
  accounts: { id: number; code: string; name: string }[];
  lines: JournalDraftLine[];
  change: (lines: JournalDraftLine[]) => void;
}) {
  const totals = journalTotals(lines);
  const amount = (value: number) => value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const update = (index: number, field: keyof JournalDraftLine, value: string) =>
    change(lines.map((line, i) => i === index ? { ...line, [field]: value } : line));
  return <section className="journal-entry-lines" aria-label="Journal lines">
    <div className="journal-entry-banner">
      <div><strong>General journal</strong><p>Enter one debit or credit per line. Total debits must equal total credits.</p></div>
      <span role="status">{totals.debit > 0 && totals.difference === 0 ? "Balanced" : `Difference: LKR ${amount(totals.difference)}`}</span>
    </div>
    <div className="journal-entry-scroll"><table>
      <thead><tr><th scope="col">#</th><th scope="col">Account</th><th scope="col">Debit (LKR)</th><th scope="col">Credit (LKR)</th><th scope="col">Memo</th><th scope="col">Action</th></tr></thead>
      <tbody>{lines.map((line, index) => <tr key={line.rowKey}>
        <td>{index + 1}</td>
        <td><ItemSearchSelect searchLabel={`Search accounts for line ${index + 1}`} searchPlaceholder="Search account name or code" value={line.account_code} onChange={event => update(index, "account_code", event.target.value)} required aria-label={`Account for line ${index + 1}`}>
          <option value="">Select account</option>
          {accounts.map(account => <option key={account.id} value={account.code}>{account.code} — {account.name}</option>)}
        </ItemSearchSelect></td>
        <td><input aria-label={`Debit for line ${index + 1}`} type="number" min="0" step="0.01" placeholder="0.00" value={line.debit} onChange={event => update(index, "debit", event.target.value)} /></td>
        <td><input aria-label={`Credit for line ${index + 1}`} type="number" min="0" step="0.01" placeholder="0.00" value={line.credit} onChange={event => update(index, "credit", event.target.value)} /></td>
        <td><input aria-label={`Memo for line ${index + 1}`} maxLength={255} placeholder="Optional memo" value={line.description} onChange={event => update(index, "description", event.target.value)} /></td>
        <td><button type="button" className="icon-action delete" disabled={lines.length <= 2} aria-label={`Remove line ${index + 1}`} onClick={() => change(lines.filter((_, i) => i !== index))}><Trash2 size={17} /></button></td>
      </tr>)}</tbody>
      <tfoot><tr><th colSpan={2} scope="row">Totals</th><td>{amount(totals.debit)}</td><td>{amount(totals.credit)}</td><td colSpan={2}>LKR</td></tr></tfoot>
    </table></div>
    <button type="button" className="secondary-action" onClick={() => change([...lines, emptyJournalLine()])}><Plus size={17} /> Add line</button>
  </section>;
}
