/** Customer-facing invoice rows; size-level stock records remain unchanged. */
export function invoiceDisplayLines(lines: any[]): any[] {
  const groups = new Map<string, any>();
  for (const [index, line] of lines.entries()) {
    const key = JSON.stringify([
      line.article_id ?? line.article_code ?? line.article_name ?? `line-${index}`,
      String(line.colour ?? "").trim(),
      line.rate == null ? null : Number(line.rate),
      line.fixed_rate == null ? null : Number(line.fixed_rate),
      line.unit_price == null ? null : Number(line.unit_price),
    ]);
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += Number(line.quantity || 0);
      existing.line_total = Math.round((existing.line_total + Number(line.line_total || 0)) * 100) / 100;
    } else {
      const { size_label, ...display } = line;
      groups.set(key, { ...display, quantity: Number(line.quantity || 0), line_total: Number(line.line_total || 0) });
    }
  }
  return [...groups.values()];
}
