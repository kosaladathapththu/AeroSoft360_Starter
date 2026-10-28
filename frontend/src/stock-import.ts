export function parseStockCsv(text: string): any[] {
  const records: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some(Boolean)) records.push(row);
  const headers = records.shift() || [];
  const expected = ["kind", "code", "batch_number", "size_label", "quantity", "unit_cost"];
  if (headers.join(",") !== expected.join(","))
    throw new Error(`Use these CSV headings: ${expected.join(",")}`);
  if (!records.length || records.length > 500) throw new Error("Upload between 1 and 500 rows.");
  return records.map((values, index) => {
    if (values.length !== expected.length)
      throw new Error(`Row ${index + 2}: expected six columns.`);
    const r: any = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    r.quantity = Number(r.quantity);
    r.unit_cost = r.unit_cost ? Number(r.unit_cost) : null;
    if (
      !["raw", "finished"].includes(r.kind) ||
      !r.code ||
      !Number.isFinite(r.quantity) ||
      r.quantity <= 0
    )
      throw new Error(
        `Row ${index + 2}: choose raw/finished, a product code and positive quantity.`,
      );
    if (r.kind === "raw" && (!r.batch_number || !Number.isFinite(r.unit_cost) || r.unit_cost <= 0))
      throw new Error(`Row ${index + 2}: raw materials need a batch and positive unit cost.`);
    if (r.kind === "finished" && !r.size_label)
      throw new Error(`Row ${index + 2}: finished articles need a size.`);
    return r;
  });
}
