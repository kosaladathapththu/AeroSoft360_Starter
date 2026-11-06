/** Complete packs require original sizes and quantities; prices are never invented. */
export function orderPacks(article: any): any[] {
  return (article?.sets || []).filter((pack: any) => pack.status !== "inactive" && Number(pack.id) > 0 &&
    (pack.items || []).some((item: any) => Number(item.quantity) > 0));
}
export function packDescription(pack: any): string {
  if (!pack) return "Size breakdown not configured";
  const sizes = [...new Set((pack.items || []).map((item: any) => String(item.size_label)))];
  const pieces = (pack.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
  const total = (pack.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  return `Sizes ${sizes.join(", ")} · ${pieces} pieces / set · LKR ${total.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
