/** Display imported references as short stable codes without changing database keys. */
export function representativeReference(rep: { id?: number | string; code?: string | null }): string {
  if (!/^AR-R-[a-f0-9]{12}$/i.test(rep.code || "")) return rep.code || "Not assigned";
  return rep.id != null ? `REP-${String(rep.id).padStart(3, "0")}` : "Representative";
}

/** Only imported machine references are shortened; meaningful business codes stay intact. */
export function displayCode(record: { id?: number | string; code?: string | null }): string {
  const code = record.code || "";
  const imported = /^AR-([CR])-[a-f0-9]{12}$/i.exec(code);
  if (!imported) return code || "Not assigned";
  const prefix = imported[1].toUpperCase() === "C" ? "CUS" : "REP";
  return record.id != null ? `${prefix}-${String(record.id).padStart(3, "0")}` : prefix === "CUS" ? "Customer" : "Representative";
}

export function displayReferenceValue(value: unknown, row: Record<string, any>, field: string): unknown {
  if (typeof value !== "string") return value;
  const master = /^AR-([CR])-[a-f0-9]{12}$/i.exec(value);
  if (master) {
    const isCustomer = master[1].toUpperCase() === "C";
    const id = field === "code" ? row.id : isCustomer ? row.customer_id : row.sales_rep_id ?? row.rep_id;
    return displayCode({ code: value, id });
  }
  const invoice = /^AR-(.+)-[a-f0-9]{12}$/i.exec(value);
  return invoice && /number|invoice|document|reference/.test(field) ? `Invoice ${invoice[1]}` : value;
}
