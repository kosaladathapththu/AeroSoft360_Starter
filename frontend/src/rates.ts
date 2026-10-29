export function fixedItemRate(line: any, item: any): number {
  const prices = typeof line.fixed_rates === "string" ? JSON.parse(line.fixed_rates || "{}") : line.fixed_rates || {};
  return Number(prices[item.id] ?? item.unit_price ?? 0);
}
export function givenItemRate(line: any, item: any): number {
  return Number(line.custom_rate ?? fixedItemRate(line, item));
}
