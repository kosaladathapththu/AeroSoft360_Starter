export function fixedItemRate(line: any, item: any): number {
  const prices =
    typeof line.fixed_rates === "string"
      ? JSON.parse(line.fixed_rates || "{}")
      : line.fixed_rates || {};
  return Number(prices[item.id] ?? item.fixed_rate ?? item.unit_price ?? 0);
}
export function givenItemRate(line: any, item: any): number {
  return Number(
    line.order_mode === "custom"
      ? (line.given_rates?.[item.id] ??
          line.custom_rate ??
          fixedItemRate(line, item))
      : (line.custom_rate ??
          line.given_rates?.[item.id] ??
          fixedItemRate(line, item)),
  );
}

export function setPricing(line: any, items: any[]) {
  const pieces = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const fixed = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * fixedItemRate(line, item),
    0,
  );
  const given = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * givenItemRate(line, item),
    0,
  );
  return {
    pieces,
    fixed: Math.round(fixed * 100) / 100,
    given: Math.round(given * 100) / 100,
  };
}
