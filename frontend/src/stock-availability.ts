/** Select the same stock bucket that invoice posting uses. */
export function stockAvailability(rows: any[], articleId: any, size: any, colour = ""): number {
  const stocks = rows.filter((row) => Number(row.article_id) === Number(articleId));
  const colourMode = stocks.some((row) => String(row.size_label).startsWith("__COLOUR__:"));
  const key = colourMode
    ? (colour ? "__COLOUR__:" + colour : "__ARTICLE_TOTAL__")
    : stocks.some((row) => row.size_label === "__ARTICLE_TOTAL__")
      ? "__ARTICLE_TOTAL__" : String(size);
  return Number(stocks.find((row) => String(row.size_label) === key)?.quantity || 0);
}
