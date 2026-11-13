/** Allocate in displayed invoice order, using cents so the receipt always reconciles. */
export function collectionPlan(invoices: any[], selected: number[], amount: number) {
  let remaining = Math.max(0, Math.round((Number.isFinite(amount) ? amount : 0) * 100));
  const allocations = invoices.filter((row) => selected.includes(Number(row.id)))
    .map((row) => {
      const due = Math.max(0, Math.round(Number(row.outstanding || 0) * 100));
      const applied = Math.min(due, remaining);
      remaining -= applied;
      return { invoice_id: Number(row.id), amount: applied / 100, remaining: (due - applied) / 100 };
    });
  return { allocations, unallocated: remaining / 100 };
}

/** Available funds for one invoice, retaining amounts already assigned to other invoices. */
export function availableInvoicePayment(id: number, due: number, selected: number[], amount: number, entered: Record<number, string>) {
  const cents = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0;
  const used = selected.filter(value => value !== id).reduce((sum, value) => sum + cents(Number(entered[value] || 0)), 0);
  return Math.min(cents(due), Math.max(0, cents(amount) - used)) / 100;
}

/** Manual entries are preserved; invalid amounts are reported rather than silently capped. */
export function manualCollectionPlan(
  invoices: any[],
  selected: number[],
  amount: number,
  entered: Record<number, string>,
) {
  const invalid: number[] = [];
  const allocations = invoices.filter((row) => selected.includes(Number(row.id))).map((row) => {
    const id = Number(row.id);
    const value = Number(entered[id] || 0);
    const due = Math.round(Number(row.outstanding || 0) * 100);
    const cents = Number.isFinite(value) ? Math.round(value * 100) : 0;
    if (!Number.isFinite(value) || cents <= 0 || cents > due) invalid.push(id);
    return { invoice_id: id, amount: cents / 100, remaining: Math.max(0, due - cents) / 100 };
  });
  const total = allocations.reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
  const collected = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  return { allocations, total: total / 100, unallocated: (collected - total) / 100, invalid };
}
