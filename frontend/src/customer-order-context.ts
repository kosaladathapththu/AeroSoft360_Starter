type Row = Record<string, any>;
export type PendingOrderLine = {
  key: string;
  document: string;
  date: string;
  stage: string;
  articleId: number;
  articleCode: string;
  articleName: string;
  size: string;
  colour: string;
  ordered: number;
  supplied: number;
  pending: number;
};
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const cancelled = (row: Row) => ["cancelled", "canceled", "void", "voided"].includes(String(row.status).toLowerCase());

// A converted PO and its sales order describe the same commitment. Count the order once.
// Dispatch and invoice are a combined operation in the current system, so invoiced_quantity
// is the recorded supplied quantity. Returns do not reopen the original order commitment.
export function pendingCustomerOrders(data: Row, customerId: number, exclude: { poId?: number; orderId?: number } = {}): PendingOrderLine[] {
  if (!customerId) return [];
  const orders: Row[] = (data.orders || []).filter((row: Row) => number(row.customer_id) === customerId);
  const linkedPos = new Set(orders.map((row) => number(row.customer_po_id)).filter(Boolean));
  const result: PendingOrderLine[] = [];
  for (const order of orders) {
    if (cancelled(order) || number(order.id) === exclude.orderId || number(order.customer_po_id) === exclude.poId) continue;
    for (const line of order.lines || []) {
      const ordered = Math.max(0, number(line.quantity));
      const supplied = Math.max(0, number(line.invoiced_quantity));
      const pending = Math.max(0, ordered - supplied);
      if (!pending) continue;
      result.push({ key: `so-${order.id}-${line.id}`, document: order.number, date: order.order_date,
        stage: "Confirmed order", articleId: number(line.article_id), articleCode: line.article_code || "",
        articleName: line.article_name || "", size: line.size_label || "Not specified", colour: line.colour || "Not specified",
        ordered, supplied, pending });
    }
  }
  for (const po of data.pos || []) {
    if (number(po.customer_id) !== customerId || cancelled(po) || linkedPos.has(number(po.id)) || number(po.id) === exclude.poId) continue;
    // Unconverted requests are visible separately; they are not confirmed dispatch commitments.
    if (!["draft", "pending"].includes(String(po.status).toLowerCase())) continue;
    for (const line of po.lines || []) {
      const pending = Math.max(0, number(line.pieces));
      if (!pending) continue;
      result.push({ key: `po-${po.id}-${line.id}`, document: po.number, date: po.po_date,
        stage: "Unconfirmed PO", articleId: number(line.article_id), articleCode: line.article_code || "",
        articleName: line.article_name || "", size: line.size_label || "Complete set", colour: line.colour || "Not specified",
        ordered: pending, supplied: 0, pending });
    }
  }
  return result.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.document.localeCompare(b.document));
}
