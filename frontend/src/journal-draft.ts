export type JournalDraftLine = { rowKey: number; account_code: string; debit: string; credit: string; description: string };
let nextRowKey = 0;
export const emptyJournalLine = (): JournalDraftLine => ({ rowKey: nextRowKey++, account_code: "", debit: "", credit: "", description: "" });
export function journalTotals(lines: JournalDraftLine[]) {
  const debit = lines.reduce((sum, line) => sum + Math.round(Number(line.debit || 0) * 100), 0);
  const credit = lines.reduce((sum, line) => sum + Math.round(Number(line.credit || 0) * 100), 0);
  return { debit: debit / 100, credit: credit / 100, difference: (debit - credit) / 100 };
}
export function journalPayload(lines: JournalDraftLine[]) {
  if (lines.length < 2) throw new Error("Enter at least two journal lines.");
  const payload = lines.map((line, index) => {
    const debit = Number(line.debit || 0), credit = Number(line.credit || 0);
    if (!line.account_code || !Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 ||
      (debit > 0) === (credit > 0)) throw new Error(`Line ${index + 1}: select an account and enter either a debit or a credit.`);
    if (Math.abs(debit * 100 - Math.round(debit * 100)) > 0.00001 || Math.abs(credit * 100 - Math.round(credit * 100)) > 0.00001)
      throw new Error(`Line ${index + 1}: amounts must have at most two decimal places.`);
    return { account_code: line.account_code, debit, credit, description: line.description.trim() || undefined };
  });
  if (journalTotals(lines).difference !== 0) throw new Error("Total debits and credits must match before posting.");
  return payload;
}
