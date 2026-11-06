/** User-facing invoice label; internal numbers and foreign keys are untouched. */
export function invoiceReference(record: { number?: string; original_invoice_number?: string | null }): string {
  if (record.original_invoice_number) return `Invoice ${record.original_invoice_number}`;
  const imported = /^AR-(.+)-[a-f0-9]{12}$/i.exec(record.number || "");
  return imported ? `Invoice ${imported[1]}` : record.number || "Not recorded";
}
