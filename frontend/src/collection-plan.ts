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
