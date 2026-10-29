export type WorkflowContext = {
  orderId?: number;
  receiptId?: number;
  action?: "invoice" | "payment";
  query?: string;
  version?: number;
};
export type WorkflowGo = (page: string, context?: WorkflowContext) => void;
export const pageLabel = (page: string) =>
  ({ "Receive Goods": "Goods Received (GRN)", "Supplier Invoices": "Purchase Invoices" })[page] ||
  page;
export const salesSteps = [
  { page: "Quotations", label: "Quotation", detail: "Optional customer offer", optional: true },
  {
    page: "Customer POs",
    label: "Customer PO",
    detail: "Optional customer instruction",
    optional: true,
  },
  { page: "Sales Orders", label: "Sales order", detail: "Confirm items, prices and quantities" },
  { page: "Invoices", label: "Dispatch & invoice", detail: "Supply goods and issue the bill" },
  { page: "Collections", label: "Customer payment", detail: "Collect and settle the balance" },
];
export const purchaseSteps = [
  { page: "Purchase Orders", label: "Purchase order", detail: "Order from supplier and approve" },
  {
    page: "Receive Goods",
    label: "Goods received (GRN)",
    detail: "Record actual delivered quantities",
  },
  {
    page: "Supplier Invoices",
    label: "Purchase invoice",
    detail: "Register the supplier bill against its GRN",
  },
  {
    page: "Payment Vouchers",
    label: "Supplier payment",
    detail: "Pay the outstanding supplier balance",
  },
];
