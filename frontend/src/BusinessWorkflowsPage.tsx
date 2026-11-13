import ItemSearchSelect from "./ItemSearchSelect";
import InventoryCountImport from "./InventoryCountImport";
import { displayCode, displayReferenceValue } from "./representative-reference";
import { createPortal } from "react-dom";
import OrderCustomerPicker from "./OrderCustomerPicker";
import FilteredRecords from "./FilteredRecords";
import { recordFields } from "./record-filters";
import { matchesSearch } from "./search";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, FileDown, Plus, Printer, RefreshCw, Trash2, X } from "lucide-react";
import {
  financeCsv,
  financeMoney as money,
  financeRequest,
  financeToday as today,
} from "./finance-utils";
import { printReport } from "./report-print";
import "./business-workflows.css";
import { parseStockCsv } from "./stock-import";
import { WorkflowContext, WorkflowGo, pageLabel } from "./workflow";

export const workflowPages = [
  "Head Office Salaries",
  "Head Office Expenses",
  "Quotations",
  "Supplier Invoices",
  "Purchase Returns",
  "Customer Ledgers",
  "Supplier Ledgers",
  "All Payables",
  "Stock Ledgers",
  "Cashier Closing",
  "Recurring Journals",
  "Bulk Inventory Import",
  "Inventory Operations",
  "Categories",
  "Brands",
  "Units",
];
type Props = {
  api: string;
  token: string;
  page: string;
  permissions: string[];
  search: string;
  go: WorkflowGo;
  context?: WorkflowContext;
  onChanged: () => void;
  user: any;
};
type Column = [string, string, "money"?];

export default function BusinessWorkflowsPage({
  api,
  token,
  page,
  permissions,
  search,
  go,
  onChanged,
  user,
  context,
}: Props) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [modal, setModal] = useState<any>(null);
  const [asOf, setAsOf] = useState(today());
  const [nextReceipt, setNextReceipt] = useState<number>();
  const [department, setDepartment] = useState("");
  const output = useRef<HTMLDivElement>(null);
  const quotes = page === "Quotations";
  const can = (permission: string) => permissions.includes(permission);
  const request = useCallback(
    (path: string, body?: any, method = "GET") => financeRequest(api, token, path, body, method),
    [api, token],
  );
  const load = useCallback(async () => {
    setData(await request(quotes ? "quotations" : `business-workflows?as_of=${asOf}`));
  }, [request, quotes, asOf]);
  useEffect(() => {
    setData(null);
    setError("");
    setNotice("");
    setModal(null);
    load().catch((e) => setError(e.message));
  }, [load, page]);
  const consumedContext = useRef<number>();
  useEffect(() => {
    if (
      data &&
      page === "Supplier Invoices" &&
      context?.action === "invoice" &&
      context.version !== consumedContext.current &&
      can("purchases.manage")
    ) {
      consumedContext.current = context.version;
      const receipt = data.receipts.find((r: any) => Number(r.id) === Number(context.receiptId));
      if (
        receipt &&
        !data.supplier_invoices.some((i: any) => Number(i.goods_receipt_id) === Number(receipt.id))
      )
        setModal({ kind: "invoice", row: receipt });
    }
  }, [data, page, context]);
  const mutate = async (path: string, body: any, method = "POST") => {
    setBusy(true);
    setError("");
    try {
      const result = await request(path, body, method);
      if (path === "supplier-invoices") setNextReceipt(Number(body.goods_receipt_id));
      await load();
      onChanged();
      setModal(null);
      setNotice(
        result.already_imported
          ? "This import was already applied; stock was not added twice."
          : "Saved successfully.",
      );
      return result;
    } finally {
      setBusy(false);
    }
  };
  const run = (path: string, body: any) => mutate(path, body).catch((e) => setError(e.message));
  const match = (row: any) => matchesSearch(row, search);
  const rows = (values: any[] = []) => values.filter(match);
  const print = () => {
    if (
      output.current &&
      !printReport({
        key: page.toLowerCase().replace(/ /g, "_"),
        title: page,
        group: "Business operations",
        from: asOf,
        to: asOf,
        source: output.current,
      })
    )
      setError("Allow pop-ups to print this report.");
  };
  const links: Record<string, string[]> = {
    "Head Office Salaries": [
      "Payroll",
      "Employees",
      "Chart of Accounts",
      "Cash Flow",
      "General Ledger",
    ],
    "Head Office Expenses": [
      "Payment Vouchers",
      "Chart of Accounts",
      "Cash Flow",
      "General Ledger",
    ],
    Quotations: ["Customers", "Pricing List", "Customer POs", "Sales Orders", "Invoices"],
    "Supplier Invoices": [
      "Purchase Orders",
      "Receive Goods",
      "Supplier Ledgers",
      "Payment Vouchers",
    ],
    "Purchase Returns": [
      "Receive Goods",
      "Raw Material Stock",
      "Supplier Ledgers",
      "General Ledger",
    ],
    "All Payables": [
      "Supplier Invoices",
      "Purchase Returns",
      "Supplier Ledgers",
      "Payment Vouchers",
    ],
    "Cashier Closing": ["Collections", "Payment Vouchers", "Cash Flow", "Chart of Accounts"],
    "Recurring Journals": ["Chart of Accounts", "General Ledger", "Cash Flow"],
    "Bulk Inventory Import": ["Raw Material Stock", "Finished Goods Stock", "Stock Ledgers"],
    "Inventory Operations": [
      "Raw Material Stock",
      "Finished Goods Stock",
      "Receive Goods",
      "Purchase Returns",
      "Bulk Inventory Import",
      "Stock Ledgers",
    ],
  };
  if (["Customer Ledgers", "Supplier Ledgers", "Stock Ledgers"].includes(page))
    return <Subledger {...{ api, token, page, search, go }} />;
  return (
    <>
      <div className="heading">
        <div>
          <span>CONNECTED BUSINESS WORKFLOWS</span>
          <h1>{pageLabel(page)}</h1>
          <p>
            {quotes
              ? "Offer product sizes and prices, then convert once into a linked customer PO and sales order."
              : "Trace each transaction through its original stock and accounting records."}
          </p>
        </div>
        <button
          className="secondary-action"
          onClick={() => load().catch((e) => setError(e.message))}
        >
          <RefreshCw /> Refresh
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="workflow-success" role="status">
          {notice}
          {page === "Supplier Invoices" && nextReceipt && (
            <button
              onClick={() => go("Payment Vouchers", { receiptId: nextReceipt, action: "payment" })}
            >
              Next: prepare supplier payment →
            </button>
          )}
        </div>
      )}
      <div className="workflow-links">
        {(links[page] || ["Pricing List", "Categories", "Brands", "Units"]).map((name) => (
          <button key={name} onClick={() => go(name)}>
            {name} →
          </button>
        ))}
      </div>
      {!data ? (
        <div className="loading">
          {error
            ? "Unable to load this workspace. Use Refresh to retry."
            : "Loading connected records..."}
        </div>
      ) : (
        <>
          <div className="finance-toolbar">
            {page === "All Payables" && (
              <label>
                As of
                <input
                  type="date"
                  value={asOf}
                  required
                  onChange={(e) => {
                    if (e.target.value) setAsOf(e.target.value);
                  }}
                />
              </label>
            )}
            {quotes && can("accounting.manage") && (
              <button className="primary" onClick={() => setModal({ kind: "quote" })}>
                <Plus /> New quotation
              </button>
            )}
            {page === "Supplier Invoices" && can("purchases.manage") && (
              <button className="primary" onClick={() => setModal({ kind: "invoice" })}>
                <Plus /> Register supplier invoice
              </button>
            )}
            {page === "Purchase Returns" && can("purchases.manage") && (
              <button className="primary" onClick={() => setModal({ kind: "return" })}>
                <Plus /> Return received goods
              </button>
            )}
            {page === "Cashier Closing" && can("accounting.manage") && (
              <button className="primary" onClick={() => setModal({ kind: "closing" })}>
                <Plus /> Close cash / bank day
              </button>
            )}
            {page === "Recurring Journals" && can("accounting.manage") && (
              <button className="primary" onClick={() => setModal({ kind: "recurring" })}>
                <Plus /> New recurring journal
              </button>
            )}
            <button className="secondary-action" onClick={print}>
              <Printer /> Print / PDF
            </button>
          </div>
          <div ref={output}>
            {quotes && (
              <WorkflowTable
                values={rows(data.quotations)}
                columns={[
                  ["number", "Quotation"],
                  ["customer", "Customer"],
                  ["quotation_date", "Date"],
                  ["valid_until", "Valid until"],
                  ["total", "Total", "money"],
                  ["status", "Status"],
                  ["sales_order", "Sales order"],
                ]}
                actions={(q) => (
                  <>
                    <button onClick={() => setModal({ kind: "quote-view", row: q })}>
                      <Eye /> Review
                    </button>
                    {q.status === "open" && can("accounting.manage") && (
                      <>
                        <button onClick={() => setModal({ kind: "quote", row: q })}>Edit</button>
                        <button onClick={() => setModal({ kind: "convert", row: q })}>
                          Convert to order
                        </button>
                        <button onClick={() => setModal({ kind: "quote-cancel", row: q })}>
                          Cancel
                        </button>
                        <button
                          className="workflow-delete"
                          disabled={busy}
                          title="Delete quotation"
                          aria-label={`Delete quotation ${q.number}`}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Delete quotation ${q.number}? This cannot be undone.`,
                              )
                            )
                              return;
                            try {
                              await mutate(`quotations/${q.id}`, undefined, "DELETE");
                              setNotice(`${q.number} deleted.`);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </>
                    )}
                    {q.sales_order_id && (
                      <button onClick={() => go("Sales Orders")}>Open orders</button>
                    )}
                  </>
                )}
              />
            )}
            {page === "Supplier Invoices" && (
              <>
                <p className="report-note">
                  Step 3: select the received goods, check the supplier bill and register its
                  invoice number and due date. Next, prepare a supplier payment.
                </p>
                <WorkflowTable
                  values={rows(data.supplier_invoices)}
                  columns={[
                    ["invoice_number", "Supplier invoice"],
                    ["supplier", "Supplier"],
                    ["receipt", "Goods receipt"],
                    ["invoice_date", "Invoice date"],
                    ["due_date", "Due date"],
                    ["total", "GRN amount", "money"],
                  ]}
                  actions={(invoice) => (
                    <button
                      onClick={() =>
                        go("Payment Vouchers", {
                          receiptId: invoice.goods_receipt_id,
                          action: "payment",
                        })
                      }
                    >
                      Prepare supplier payment →
                    </button>
                  )}
                />
              </>
            )}
            {page === "Purchase Returns" && (
              <>
                <p className="report-note">
                  Posted returns reduce the original batch and debit supplier liability. A
                  cancellation restores both through a dated reversal. Paid returns require a
                  supplier refund and cannot be processed as unpaid returns.
                </p>
                <WorkflowTable
                  values={rows(data.purchase_returns)}
                  columns={[
                    ["number", "Return"],
                    ["receipt", "Goods receipt"],
                    ["supplier", "Supplier"],
                    ["return_date", "Date"],
                    ["reason", "Reason"],
                    ["total", "Amount", "money"],
                    ["status", "Status"],
                  ]}
                  actions={(r) =>
                    r.status === "posted" && can("purchases.manage") ? (
                      <button onClick={() => setModal({ kind: "return-cancel", row: r })}>
                        Reverse with reason
                      </button>
                    ) : (
                      <span>
                        {r.void_date} {r.void_reason}
                      </span>
                    )
                  }
                />
              </>
            )}
            {page === "All Payables" && (
              <>
                <h2>All liability accounts as of {asOf}</h2>
                <WorkflowTable
                  values={data.liability_balances}
                  columns={[
                    ["code", "Account"],
                    ["name", "Liability"],
                    ["balance", "Balance", "money"],
                  ]}
                  actions={() => (
                    <button onClick={() => go("Chart of Accounts")}>Open account ledgers →</button>
                  )}
                />
                <h2>Supplier balances by document</h2>
                <div className="workflow-summary">
                  <span>Supplier invoices outstanding as of {asOf}</span>
                  <strong>{money(data.payables.totals.total)}</strong>
                </div>
                <WorkflowTable
                  values={rows(data.payables.rows)}
                  columns={[
                    ["supplier", "Supplier"],
                    ["receipt", "GRN"],
                    ["invoice", "Invoice"],
                    ["due_date", "Due date"],
                    ["days_overdue", "Days overdue"],
                    ["outstanding", "Outstanding", "money"],
                  ]}
                />
                <p className="report-note">
                  Trade payables from goods receipts, less supplier vouchers and returns through the
                  selected date. Salaries, tax and other liabilities are shown separately in Chart
                  of Accounts and General Ledger.
                </p>
              </>
            )}
            {page === "Cashier Closing" && (
              <>
                <p className="report-note">
                  Reconcile each cash/bank account against its posted ledger. Closing records a
                  physical count; it does not create an adjustment journal. Backdated ledger changes
                  are flagged for review.
                </p>
                <WorkflowTable
                  values={rows(data.cash_closings)}
                  columns={[
                    ["closing_date", "Date"],
                    ["name", "Account"],
                    ["opening", "Opening", "money"],
                    ["receipts", "Receipts", "money"],
                    ["payments", "Payments", "money"],
                    ["expected", "Expected", "money"],
                    ["counted", "Counted", "money"],
                    ["difference", "Difference", "money"],
                    ["status", "Status"],
                  ]}
                  actions={(r) => (
                    <>
                      {!!r.ledger_changed && (
                        <strong className="workflow-warning">
                          Ledger changed: now {money(r.current_expected)}
                        </strong>
                      )}
                      {r.status === "closed" && can("accounting.manage") && (
                        <button onClick={() => setModal({ kind: "reopen", row: r })}>
                          Reopen with reason
                        </button>
                      )}
                    </>
                  )}
                />
              </>
            )}
            {page === "Recurring Journals" && (
              <>
                <p className="report-note">
                  Templates do not post automatically. Review and post each due date once. Posting
                  uses active accounts and an open accounting period; the next date advances only
                  after a successful balanced journal.
                </p>
                <WorkflowTable
                  values={rows(data.recurring)}
                  columns={[
                    ["description", "Description"],
                    ["next_date", "Next due"],
                    ["interval_months", "Months"],
                    ["status", "Status"],
                  ]}
                  actions={(r) => (
                    <>
                      <button onClick={() => setModal({ kind: "recurring-view", row: r })}>
                        Lines / posted runs
                      </button>
                      {r.status === "active" && can("accounting.manage") && (
                        <>
                          <button
                            disabled={busy || r.next_date > today()}
                            onClick={() => setModal({ kind: "recurring-post", row: r })}
                          >
                            Review due posting
                          </button>
                          <button onClick={() => setModal({ kind: "recurring-stop", row: r })}>
                            Stop
                          </button>
                        </>
                      )}
                    </>
                  )}
                />
              </>
            )}
            {page === "Head Office Salaries" && (
              <>
                <p className="report-note">
                  Salaries come from the existing payroll runs. Select the Head Office department
                  below to isolate office staff. Only posted, unpaid payroll can be paid; payments
                  debit salaries payable (2250) and credit the selected cash/bank account.
                  Historical paid flags are preserved without charging cash again.
                </p>
                <label>
                  Department
                  <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="">All departments</option>
                    {[...new Set<string>(data.salary_items.map((r: any) => r.department))].map(
                      (name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <WorkflowTable
                  values={rows(
                    data.salary_items.filter(
                      (r: any) => !department || r.department === department,
                    ),
                  )}
                  columns={[
                    ["name", "Employee"],
                    ["department", "Department"],
                    ["payroll_number", "Payroll"],
                    ["period_end", "Period end"],
                    ["payroll_status", "Payroll status"],
                    ["net_salary", "Net salary", "money"],
                    ["payment_status", "Payment status"],
                  ]}
                  actions={(r) => (
                    <>
                      {r.linked_payment && (
                        <small>
                          Journal #{r.linked_payment.journal_id} ? {r.linked_payment.payment_date}
                        </small>
                      )}
                      {can("accounting.manage") &&
                        (r.linked_payment ? (
                          <button onClick={() => setModal({ kind: "salary-reverse", row: r })}>
                            Reverse payment
                          </button>
                        ) : r.payment_status !== "paid" && r.payroll_status === "posted" ? (
                          <button onClick={() => setModal({ kind: "salary-pay", row: r })}>
                            Pay salary
                          </button>
                        ) : (
                          <span>
                            {r.payment_status === "paid"
                              ? "Historical paid status"
                              : "Post payroll first"}
                          </span>
                        ))}
                    </>
                  )}
                />
              </>
            )}
            {page === "Head Office Expenses" && (
              <>
                <p className="report-note">
                  Administrative expenses are linked to account 5400 and the existing payment
                  vouchers. Record a voucher using Administrative Expenses (5400) to show its posted
                  expense, cash movement and payment document here.
                </p>
                <button className="primary" onClick={() => go("Payment Vouchers")}>
                  Record / manage expense voucher ?
                </button>
                <WorkflowTable
                  values={rows(data.expenses)}
                  columns={[
                    ["number", "Voucher"],
                    ["payment_date", "Date"],
                    ["payee", "Payee"],
                    ["description", "Expense"],
                    ["amount", "Amount", "money"],
                    ["status", "Status"],
                  ]}
                  actions={() => (
                    <button onClick={() => go("Payment Vouchers")}>Open voucher module ?</button>
                  )}
                />
              </>
            )}
            {page === "Bulk Inventory Import" && (
              <BulkImport
                api={api} token={token} canManage={can("stock.manage")}
                busy={busy}
                save={(body: any) => mutate("bulk-stock-import", body)}
              />
            )}
            {page === "Inventory Operations" && (
              <>
                <div className="workflow-summary">
                  <span>
                    Raw material batches and finished sizes share the existing stock movements.
                  </span>
                  <strong>
                    {data.materials.length} materials · {data.articles.length} articles
                  </strong>
                </div>
                <div className="workflow-operation-grid">
                  {(links[page] || []).map((name) => (
                    <button key={name} onClick={() => go(name)}>
                      <h2>{name}</h2>
                      <p>
                        {name === "Stock Ledgers"
                          ? "Trace receipts, returns, adjustments and sales by batch or size."
                          : `Open the connected ${name.toLowerCase()} workflow.`}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            )}
            {["Categories", "Brands", "Units"].includes(page) && (
              <MasterData
                page={page}
                data={data}
                canManage={can("accounting.manage")}
                busy={busy}
                save={mutate}
              />
            )}
          </div>
        </>
      )}
      {modal && (
        <WorkflowModal
          pageMode={quotes}
          title={
            modal.kind === "quote"
              ? modal.row
                ? `Edit ${modal.row.number}`
                : "New quotation"
              : modal.kind === "invoice"
                ? "Register purchase invoice"
                : modal.kind.replace(/-/g, " ")
          }
          busy={busy}
          close={() => setModal(null)}
        >
          {modal.kind === "salary-pay" && (
            <SimpleForm
              busy={busy}
              label="Post salary payment"
              submit={(f) =>
                mutate("salary-payments", {
                  payroll_item_id: modal.row.id,
                  payment_account_id: Number(f.get("payment_account_id")),
                  payment_date: f.get("payment_date"),
                })
              }
            >
              <p>
                {modal.row.name} ? {modal.row.payroll_number} ? {money(modal.row.net_salary)}
              </p>
              <label>
                Pay from
                <select name="payment_account_id" required>
                  <option value="">Choose cash/bank account</option>
                  {data.accounts
                    .filter((a: any) => a.is_cash_account)
                    .map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {displayCode(a)} ? {a.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Payment date
                <input
                  name="payment_date"
                  type="date"
                  min={modal.row.period_end}
                  defaultValue={today()}
                  required
                />
              </label>
            </SimpleForm>
          )}
          {modal.kind === "salary-reverse" && (
            <SimpleForm
              busy={busy}
              label="Reverse salary payment"
              submit={(f) =>
                mutate(`salary-payments/${modal.row.linked_payment.id}/reverse`, {
                  void_date: f.get("void_date"),
                  reason: f.get("reason"),
                })
              }
            >
              <p>
                {modal.row.name} ? {money(modal.row.linked_payment.amount)}
              </p>
              <label>
                Reversal date
                <input
                  name="void_date"
                  type="date"
                  min={modal.row.linked_payment.payment_date}
                  defaultValue={today()}
                  required
                />
              </label>
              <label>
                Reason
                <textarea name="reason" required maxLength={500} />
              </label>
            </SimpleForm>
          )}
          {modal.kind === "quote" && (
            <QuoteForm
              data={data}
              initial={modal.row}
              user={user}
              busy={busy}
              save={(body: any) =>
                mutate(
                  modal.row ? `quotations/${modal.row.id}` : "quotations",
                  body,
                  modal.row ? "PUT" : "POST",
                )
              }
            />
          )}
          {modal.kind === "quote-view" && (
            <>
              <h3>
                {modal.row.number} · {modal.row.customer}
              </h3>
              <p>
                Valid {modal.row.quotation_date} to {modal.row.valid_until} · {modal.row.sale_type}
              </p>
              <div className="quote-customer-details">
                <span>{[data.customers?.find((c: any) => Number(c.id) === Number(modal.row.customer_id))?.address, data.customers?.find((c: any) => Number(c.id) === Number(modal.row.customer_id))?.phone, data.customers?.find((c: any) => Number(c.id) === Number(modal.row.customer_id))?.email].filter(Boolean).join(" | ")}</span>
                <span>Salesperson: {data.reps?.find((r: any) => Number(r.id) === Number(modal.row.sales_rep_id))?.name || "Not assigned"}</span>
              </div>
              <WorkflowTable
                values={modal.row.lines}
                columns={[
                  ["code", "Article"],
                  ["name", "Product"],
                  ["colour", "Colour"],
                  ["quantity", "Pieces"],
                  ["fixed_rate", "Fixed price / piece", "money"],
                  ["rate", "Quoted price / piece", "money"],
                  ["total", "Amount", "money"],
                ]}
              />
              <div className="workflow-summary">
                <span>Quotation total</span>
                <strong>{money(modal.row.total)}</strong>
              </div>
              <p style={{ whiteSpace: "pre-wrap" }}>{modal.row.notes}</p>
              {modal.row.sales_order && (
                <button onClick={() => go("Sales Orders")}>
                  Sales order {modal.row.sales_order} →
                </button>
              )}
              <button
                onClick={() => {
                  const source = document.querySelector<HTMLElement>(".workflow-modal-content");
                  if (source)
                    printReport({
                      key: "quotation",
                      title: `Quotation ${modal.row.number}`,
                      group: "Customer offer",
                      from: modal.row.quotation_date,
                      to: modal.row.valid_until,
                      source,
                    });
                }}
              >
                <Printer /> Print quotation
              </button>
            </>
          )}
          {modal.kind === "convert" && (
            <SimpleForm
              busy={busy}
              label="Create linked sales order"
              submit={(f) =>
                mutate(`quotations/${modal.row.id}/convert`, { order_date: f.get("order_date") })
              }
            >
              <p>
                {modal.row.number} · {money(modal.row.total)}. Quoted quantities and prices are
                preserved. No stock or accounting is posted until invoicing.
              </p>
              <label>
                Order date
                <input
                  name="order_date"
                  type="date"
                  min={modal.row.quotation_date}
                  max={modal.row.valid_until}
                  defaultValue={today()}
                  required
                />
              </label>
            </SimpleForm>
          )}
          {modal.kind === "invoice" && (
            <SupplierInvoiceForm
              key={modal.row?.id || "new"}
              initialReceiptId={modal.row?.id}
              data={data}
              busy={busy}
              save={(body: any) => mutate("supplier-invoices", body)}
            />
          )}
          {modal.kind === "return" && (
            <PurchaseReturnForm
              data={data}
              busy={busy}
              save={(body: any) => mutate("purchase-returns", body)}
            />
          )}
          {modal.kind === "closing" && (
            <CashClosingForm
              {...{ data, request, busy }}
              save={(body: any) => mutate("cash-closings", body)}
            />
          )}
          {modal.kind === "recurring" && (
            <RecurringForm
              data={data}
              busy={busy}
              save={(body: any) => mutate("recurring-journals", body)}
            />
          )}
          {modal.kind === "recurring-view" && (
            <>
              <h3>{modal.row.description}</h3>
              <WorkflowTable
                values={modal.row.lines}
                columns={[
                  ["account_code", "Account"],
                  ["debit", "Debit", "money"],
                  ["credit", "Credit", "money"],
                ]}
              />
              <WorkflowTable
                values={modal.row.runs}
                columns={[
                  ["posting_date", "Posting date"],
                  ["number", "Journal"],
                ]}
              />
              <button onClick={() => go("General Ledger")}>Open General Ledger</button>
            </>
          )}
          {modal.kind === "recurring-post" && (
            <SimpleForm
              busy={busy}
              label="Post balanced journal"
              submit={() =>
                mutate(`recurring-journals/${modal.row.id}/post`, {
                  posting_date: modal.row.next_date,
                })
              }
            >
              <p>
                Post {modal.row.description} on {modal.row.next_date}?
              </p>
              <WorkflowTable
                values={modal.row.lines}
                columns={[
                  ["account_code", "Account"],
                  ["debit", "Debit", "money"],
                  ["credit", "Credit", "money"],
                ]}
              />
            </SimpleForm>
          )}
          {["quote-cancel", "return-cancel", "reopen", "recurring-stop"].includes(modal.kind) && (
            <SimpleForm
              busy={busy}
              label={modal.kind === "return-cancel" ? "Post reversal" : "Save with reason"}
              submit={(f) => {
                const paths: Record<string, string> = {
                  "quote-cancel": `quotations/${modal.row.id}/cancel`,
                  "return-cancel": `purchase-returns/${modal.row.id}/cancel`,
                  reopen: `cash-closings/${modal.row.id}/reopen`,
                  "recurring-stop": `recurring-journals/${modal.row.id}/stop`,
                };
                return mutate(paths[modal.kind], {
                  reason: f.get("reason"),
                  void_date: f.get("void_date"),
                });
              }}
            >
              <p>
                {modal.row.number ||
                  modal.row.description ||
                  `${modal.row.name} · ${modal.row.closing_date}`}
              </p>
              {modal.kind === "return-cancel" && (
                <label>
                  Reversal date
                  <input
                    name="void_date"
                    type="date"
                    min={modal.row.return_date}
                    defaultValue={today()}
                    required
                  />
                </label>
              )}
              <label>
                Reason
                <textarea name="reason" required maxLength={500} />
              </label>
            </SimpleForm>
          )}
        </WorkflowModal>
      )}
    </>
  );
}

export function WorkflowTable({
  values,
  columns,
  actions,
  minimumRows = 1,
  paginate = false,
}: {
  values: any[];
  columns: Column[];
  actions?: (row: any) => ReactNode;
  minimumRows?: number;
  paginate?: boolean;
}) {
  const availableFields = recordFields(values);
  return (
    <FilteredRecords
      records={values}
      paginate={paginate}
      minimumRows={minimumRows}
      title="records"
      key={columns.map(([key]) => key).join(",")}
      fields={columns.map(([key, label, type]) => ({
        key,
        label,
        kind: type === "money" ? "number" : availableFields.find((f) => f.key === key)?.kind,
      }))}
    >
      {(filteredRows, filtersActive) => (
        <div className="table-card workflow-table">
          <table>
            <thead>
              <tr>
                {columns.map(([key, name, type]) => (
                  <th
                    key={key}
                    className={
                      type === "money"
                        ? "report-number"
                        : /description|name|reason|note|address|issue|resolution|customer|supplier/.test(
                              key,
                            )
                          ? "workflow-cell-text"
                          : /reference|number|journal|code/.test(key)
                            ? "workflow-cell-reference"
                            : undefined
                    }
                  >
                    {name}
                  </th>
                ))}
                {actions && <th className="workflow-actions-cell">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={row.id ?? index}>
                  {columns.map(([key, , type]) => (
                    <td key={key} className={type === "money" ? "report-number" : undefined}>
                      {type === "money" ? money(row[key]) : String(displayReferenceValue(row[key], row, key) ?? "—")}
                    </td>
                  ))}
                  {actions && (
                    <td className="workflow-actions-cell">
                      <div className="workflow-actions">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)}>
                    No records match this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </FilteredRecords>
  );
}

export function WorkflowModal({
  title,
  children,
  busy,
  close,
  pageMode = false,
}: {
  title: string;
  children: ReactNode;
  busy: boolean;
  close: () => void;
  pageMode?: boolean;
}) {
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pageMode) { heading.current?.focus(); window.scrollTo({ top: 0 }); }
  }, [pageMode]);
  if (pageMode) {
    const content = <div className="record-workspace-page" ref={heading} tabIndex={-1}>
      <section className="modal workflow-modal quotation-workspace" aria-label={title}>
        <div className="popup-header">
          <button type="button" className="workspace-entry-back secondary" disabled={busy} onClick={close}>Back to quotations</button>
          <h2>{title}</h2>
        </div>
        <div className="popup-body workflow-modal-content">{children}</div>
      </section>
    </div>;
    const target = document.getElementById("workspace-entry-root");
    return target ? createPortal(content, target) : content;
  }
  return (
    <div
      className="backdrop"
      onMouseDown={() => {
        if (!busy) close();
      }}
    >
      <section
        className="modal workflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="popup-header">
          <button className="close" disabled={busy} aria-label="Close" onClick={close}>
            <X />
          </button>
          <span>CONNECTED OPERATIONS</span>
          <h2 id="workflow-modal-title">{title}</h2>
        </div>
        <div className="popup-body workflow-modal-content">{children}</div>
      </section>
    </div>
  );
}

export function SimpleForm({
  children,
  busy,
  submit,
  label = "Save",
  submitDisabled = false,
}: {
  children: ReactNode;
  busy: boolean;
  submit: (f: FormData) => Promise<any>;
  label?: string;
  submitDisabled?: boolean;
}) {
  const [error, setError] = useState("");
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await submit(new FormData(event.currentTarget));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <form className="workflow-form" onSubmit={save}>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <fieldset disabled={busy}>{children}</fieldset>
      <div className="workflow-form-footer">
        <button className="primary" disabled={busy || submitDisabled}>
          <Check />
          {busy ? "Saving..." : label}
        </button>
      </div>
    </form>
  );
}

function QuoteForm({ data, initial, user, busy, save }: any) {
  const [customerId, setCustomerId] = useState(Number(initial?.customer_id || 0));
  const [lines, setLines] = useState<any[]>(
    initial?.lines || [{ article_id: "", quantity: 1, rate: 0, colour: "" }],
  );
  const change = (index: number, patch: any) =>
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const customer = (data.customers || []).find((c: any) => Number(c.id) === customerId);
  const [quoteDate, setQuoteDate] = useState(initial?.quotation_date || today());
  const defaultValidity = new Date();
  defaultValidity.setDate(defaultValidity.getDate() + 14);
  const [validUntil, setValidUntil] = useState(initial?.valid_until || defaultValidity.toISOString().slice(0, 10));
  const totalPieces = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  return (
    <SimpleForm
      busy={busy}
      label="Save quotation"
      submitDisabled={!customerId || !lines.length || lines.some((line) => !line.article_id && !line.set_item_id)}
      submit={(f) =>
        save({
          customer_id: customerId,
          sales_rep_id: Number(f.get("sales_rep_id")),
          quotation_date: f.get("quotation_date"),
          valid_until: f.get("valid_until"),
          sale_type: f.get("sale_type"),
          notes: f.get("notes"),
          reason: f.get("reason"),
          lines,
        })
      }
    >
      <h3 className="quote-section-title">Customer and quotation details</h3>
      <div className="form-row">
        <OrderCustomerPicker customers={data.customers || []} selectedId={customerId}
          select={setCustomerId} help="Search by customer name, code or phone, then choose a customer." />
        <label>
          Salesperson
          <select
            name="sales_rep_id"
            required
            defaultValue={initial?.sales_rep_id || user?.sales_rep_id || ""}
          >
            {!user?.sales_rep_id && (
              <option value="" disabled>
                Choose salesperson
              </option>
            )}
            {data.reps
              .filter((r: any) => !user?.sales_rep_id || r.id === user.sales_rep_id)
              .map((r: any) => (
                <option key={r.id} value={r.id}>
                  {displayCode(r)} — {r.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {customer && <div className="quote-customer-details">
        <strong>{customer.name}</strong>
        <span>{[customer.address, customer.phone, customer.email].filter(Boolean).join(" | ") || "No contact details recorded"}</span>
        <span>Credit terms: {customer.credit_days == null ? "Not set" : customer.credit_days + " days"}</span>
      </div>}
      <div className="form-row">
        <label>
          Quotation date
          <input
            name="quotation_date"
            type="date"
            required
            value={quoteDate}
            onChange={(e) => { setQuoteDate(e.target.value); if (validUntil < e.target.value) setValidUntil(e.target.value); }}
          />
        </label>
        <label>
          Valid until
          <input
            name="valid_until"
            type="date"
            required
            min={quoteDate}
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </label>
      </div>
      <label>
        Sale type
        <select name="sale_type" defaultValue={initial?.sale_type || "credit"}>
          <option value="credit">Credit</option>
          <option value="cash">Cash</option>
        </select>
      </label>
      <h3 className="quote-section-title">Articles, quantities and prices</h3>
      <p className="quote-help">Choose each article, enter pieces, then adjust the quoted price if needed. Fixed prices remain visible; your price list is unchanged.</p>
      {lines.map((line, index) => {
        const articleId = Number(line.article_id || data.items.find((i: any) => Number(i.id) === Number(line.set_item_id))?.article_id || 0);
        const article = data.articles.find((i: any) => Number(i.id) === articleId);
        const colours = Array.from(new Set<string>((data.items || [])
          .filter((i: any) => Number(i.article_id) === articleId)
          .flatMap((i: any) => String(i.colours || "").split(/[,;\n]+/).map((c: string) => c.trim()).filter(Boolean))));
        return (
        <div className="workflow-quote-line" key={index}>
          <label>
            Article
            <ItemSearchSelect
              required
              value={line.article_id || data.items.find((i: any) => Number(i.id) === Number(line.set_item_id))?.article_id || ""}
              onChange={(e) => {
                const item = data.articles.find((i: any) => i.id === Number(e.target.value));
                change(index, {
                  article_id: Number(e.target.value),
                  set_item_id: null,
                  colour: "",
                  rate: Number(item?.selling_price || 0),
                  fixed_rate: Number(item?.selling_price || 0),
                });
              }}
            >
              <option value="" disabled>
                Choose article
              </option>
              {data.articles.map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.code}
                </option>
              ))}
            </ItemSearchSelect>
            {article && <span className="quote-article-meta">{article.category || article.name}{Number(article.pieces_per_set) > 0 ? " / " + article.pieces_per_set + " pieces per set" : ""}</span>}
          </label>
          <label>
            Colour / variant
            {colours.length > 0 ? <select value={line.colour || ""} onChange={(e) => change(index, { colour: e.target.value })}>
              <option value="">Choose colour (optional)</option>
              {line.colour && !colours.includes(line.colour) && <option value={line.colour}>{line.colour}</option>}
              {colours.map((colour) => <option key={colour} value={colour}>{colour}</option>)}
            </select> : <input placeholder={article ? "Enter colour (optional)" : "Choose article first"} disabled={!article} maxLength={80} value={line.colour || ""} onChange={(e) => change(index, { colour: e.target.value })} />}
          </label>
          <label>
            Pieces
            <input
              type="number"
              required
              min="1"
              step="1"
              value={line.quantity}
              onChange={(e) => change(index, { quantity: Number(e.target.value) })}
            />
          </label>
          <div className="quote-fixed-price"><span>Fixed price / piece</span><strong>{(line.article_id || line.set_item_id) ? money(line.fixed_rate ?? data.articles.find((i: any) => Number(i.id) === Number(line.article_id))?.selling_price ?? 0) : "Choose an article"}</strong></div>
          <label>
            Given price / piece
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={line.rate}
              onChange={(e) => change(index, { rate: Number(e.target.value) })}
            />
          </label>
          <div className="quote-line-total"><span>Line total</span><strong>{money(Number(line.quantity || 0) * Number(line.rate || 0))}</strong></div>
          <button
            type="button"
            disabled={lines.length === 1}
            onClick={() => setLines(lines.filter((_, i) => i !== index))}
          >
            Remove line
          </button>
        </div>
      ); })}
      <button
        type="button"
        onClick={() => setLines([...lines, { article_id: "", quantity: 1, rate: 0, colour: "" }])}
      >
        <Plus /> Add article
      </button>
      <div className="workflow-summary">
        <span>{lines.length} lines / {totalPieces} pieces - Quotation total (LKR)</span>
        <strong>
          {money(
            lines.reduce((sum, line) => sum + Math.round(line.quantity * line.rate * 100) / 100, 0),
          )}
        </strong>
      </div>
      <label>
        Terms and notes
        <textarea name="notes" rows={4} maxLength={2000} placeholder="Payment terms, delivery lead time, delivery location, exclusions and special conditions for this offer." defaultValue={initial?.notes} />
      </label>
      {initial && (
        <label>
          Reason for change
          <textarea name="reason" required maxLength={500} />
        </label>
      )}
    </SimpleForm>
  );
}

function SupplierInvoiceForm({ data, busy, save, initialReceiptId }: any) {
  const [id, setId] = useState(String(initialReceiptId || ""));
  const receipt = data.receipts.find((r: any) => r.id === Number(id));
  return (
    <SimpleForm
      busy={busy}
      label="Register invoice"
      submit={(f) =>
        save({
          goods_receipt_id: Number(id),
          invoice_number: f.get("invoice_number"),
          invoice_date: f.get("invoice_date"),
          due_date: f.get("due_date"),
          notes: f.get("notes"),
        })
      }
    >
      <label>
        Posted goods receipt
        <select required value={id} onChange={(e) => setId(e.target.value)}>
          <option value="" disabled>
            Choose GRN
          </option>
          {data.receipts
            .filter(
              (r: any) =>
                r.status === "posted" &&
                !data.supplier_invoices.some((i: any) => i.goods_receipt_id === r.id),
            )
            .map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.number} · {r.supplier} · {money(r.total)}
              </option>
            ))}
        </select>
      </label>
      {receipt && (
        <p>
          GRN total {money(receipt.total)} · Unpaid after returns/payments{" "}
          {money(receipt.outstanding)}
        </p>
      )}
      <label>
        Supplier invoice number
        <input name="invoice_number" required maxLength={80} />
      </label>
      <div className="form-row">
        <label>
          Invoice date
          <input name="invoice_date" type="date" required defaultValue={today()} />
        </label>
        <label>
          Due date
          <input name="due_date" type="date" required defaultValue={today()} />
        </label>
      </div>
      <label>
        Notes
        <textarea name="notes" maxLength={1000} />
      </label>
      <p className="report-note">
        This registers the document against the original receipt value. Use purchase returns for
        returned quantities and payment vouchers for settlement.
      </p>
    </SimpleForm>
  );
}

function PurchaseReturnForm({ data, busy, save }: any) {
  const [id, setId] = useState(""),
    [quantities, setQuantities] = useState<Record<string, number>>({});
  const receipt = data.receipts.find((r: any) => r.id === Number(id));
  return (
    <SimpleForm
      busy={busy}
      label="Post stock and payable return"
      submit={(f) =>
        save({
          goods_receipt_id: Number(id),
          return_date: f.get("return_date"),
          reason: f.get("reason"),
          lines: Object.entries(quantities)
            .filter(([, q]) => q > 0)
            .map(([line, quantity]) => ({ goods_receipt_line_id: Number(line), quantity })),
        })
      }
    >
      <label>
        Original goods receipt
        <select
          required
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setQuantities({});
          }}
        >
          <option value="" disabled>
            Choose receipt
          </option>
          {data.receipts
            .filter((r: any) => r.status === "posted" && r.outstanding > 0)
            .map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.number} · {r.supplier} · Unpaid {money(r.outstanding)}
              </option>
            ))}
        </select>
      </label>
      <label>
        Return date
        <input
          name="return_date"
          type="date"
          min={receipt?.received_on}
          defaultValue={today()}
          required
        />
      </label>
      {receipt?.lines.map((l: any) => (
        <div className="workflow-return-line" key={l.id}>
          <div>
            <b>
              {displayCode(l)} · {l.name}
            </b>
            <small>
              Batch {l.batch_number} · Returnable {l.returnable} · {money(l.unit_cost)} / unit
            </small>
          </div>
          <label>
            Return quantity
            <input
              type="number"
              min="0"
              max={l.returnable}
              step="0.0001"
              value={quantities[l.id] || 0}
              onChange={(e) => setQuantities({ ...quantities, [l.id]: Number(e.target.value) })}
            />
          </label>
        </div>
      ))}
      <label>
        Reason
        <textarea name="reason" maxLength={500} required />
      </label>
    </SimpleForm>
  );
}

function CashClosingForm({ data, request, busy, save }: any) {
  const cash = data.accounts.filter((a: any) => a.is_cash_account);
  const [id, setId] = useState(String(cash[0]?.id || "")),
    [date, setDate] = useState(today()),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(""),
    [counted, setCounted] = useState("");
  useEffect(() => {
    let active = true;
    setPreview(null);
    setError("");
    if (id && date)
      request(`cash-closing-preview?account_id=${id}&closing_date=${date}`)
        .then((r: any) => {
          if (active) setPreview(r);
        })
        .catch((e: Error) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [id, date, request]);
  return (
    <SimpleForm
      busy={busy}
      submitDisabled={!preview}
      label="Record cash count"
      submit={(f) =>
        save({
          account_id: Number(id),
          closing_date: date,
          counted: Number(counted),
          notes: f.get("notes"),
        })
      }
    >
      <div className="form-row">
        <label>
          Cash / bank account
          <select required value={id} onChange={(e) => setId(e.target.value)}>
            {!cash.length && <option value="">Set up a cash account first</option>}
            {cash.map((a: any) => (
              <option key={a.id} value={a.id}>
                {displayCode(a)} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Closing date
          <input
            type="date"
            required
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      {preview && (
        <div className="workflow-summary">
          <span>
            Opening {money(preview.opening)} + receipts {money(preview.receipts)} − payments{" "}
            {money(preview.payments)}
          </span>
          <strong>Expected {money(preview.expected)}</strong>
        </div>
      )}
      <label>
        Actual counted / reconciled amount
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
      </label>
      {preview && counted !== "" && <p>Difference: {money(Number(counted) - preview.expected)}</p>}
      <label>
        Count notes / reason for difference
        <textarea
          name="notes"
          maxLength={500}
          required={
            preview && counted !== "" && Math.abs(Number(counted) - preview.expected) > 0.001
          }
        />
      </label>
    </SimpleForm>
  );
}

function RecurringForm({ data, busy, save }: any) {
  const [lines, setLines] = useState<any[]>([
    { account_code: "", debit: 0, credit: 0 },
    { account_code: "", debit: 0, credit: 0 },
  ]);
  return (
    <SimpleForm
      busy={busy}
      label="Save recurring template"
      submit={(f) =>
        save({
          description: f.get("description"),
          starts_on: f.get("starts_on"),
          interval_months: Number(f.get("interval_months")),
          lines,
        })
      }
    >
      <label>
        Description
        <input
          name="description"
          maxLength={255}
          required
          placeholder="e.g. Monthly rent accrual"
        />
      </label>
      <div className="form-row">
        <label>
          First posting date
          <input name="starts_on" type="date" required defaultValue={today()} />
        </label>
        <label>
          Repeat every
          <select name="interval_months">
            <option value="1">Month</option>
            <option value="3">Quarter</option>
            <option value="12">Year</option>
          </select>
        </label>
      </div>
      {lines.map((line, index) => (
        <div className="workflow-journal-line" key={index}>
          <label>
            Account
            <select
              required
              value={line.account_code}
              onChange={(e) =>
                setLines(
                  lines.map((l, i) => (i === index ? { ...l, account_code: e.target.value } : l)),
                )
              }
            >
              <option value="" disabled>
                Choose account
              </option>
              {data.accounts.map((a: any) => (
                <option key={a.id} value={a.code}>
                  {displayCode(a)} · {a.name}
                </option>
              ))}
            </select>
          </label>
          {["debit", "credit"].map((side) => (
            <label key={side}>
              {side}
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={line[side]}
                onChange={(e) =>
                  setLines(
                    lines.map((l, i) =>
                      i === index ? { ...l, [side]: Number(e.target.value) } : l,
                    ),
                  )
                }
              />
            </label>
          ))}
          <button
            type="button"
            disabled={lines.length <= 2}
            onClick={() => setLines(lines.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setLines([...lines, { account_code: "", debit: 0, credit: 0 }])}
      >
        Add journal line
      </button>
      <p>
        Debits {money(lines.reduce((s, l) => s + l.debit, 0))} · Credits{" "}
        {money(lines.reduce((s, l) => s + l.credit, 0))}
      </p>
    </SimpleForm>
  );
}

function MasterData({ page, data, canManage, busy, save }: any) {
  const kind = (
    { Categories: "category", Brands: "brand", Units: "unit" } as Record<string, string>
  )[page];
  const [article, setArticle] = useState("");
  const selected = data.articles.find((a: any) => a.id === Number(article));
  return (
    <div className="simple-master-data">
      {canManage && <section className="master-create-bar">
        <SimpleForm busy={busy} label={`Add ${kind}`} submit={async f => {
          await save("catalog-terms", { kind, name: f.get("name") });
        }}>
          <label>{page === "Categories" ? "Category name" : `New ${kind}`}
            <input name="name" required maxLength={kind === "unit" ? 20 : 80} placeholder={`Enter ${kind} name`} />
          </label>
        </SimpleForm>
      </section>}
      <WorkflowTable
        minimumRows={5}
        values={data.terms.filter((t: any) => t.kind === kind).map((t: any) => ({...t, status: Number(t.active) ? "Active" : "Inactive"}))}
        columns={[
          ["name", page],
          ["status", "Status"],
        ]}
      />
      {canManage && (
        <details className="master-link-details">
          <summary>Assign classifications to an article</summary>
          <section className="master-data-panel">
            <h2>Link classifications to an article</h2>
            <label>
              Article
              <ItemSearchSelect value={article} onChange={(e) => setArticle(e.target.value)}>
                <option value="">Select article</option>
                {data.articles.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {displayCode(a)} · {a.name}
                  </option>
                ))}
              </ItemSearchSelect>
            </label>
            {selected && (
              <SimpleForm
                key={selected.id}
                busy={busy}
                label="Save product classification"
                submit={(f) =>
                  save("product-classification", {
                    article_id: selected.id,
                    track_serials: f.get("track_serials") === "on",
                    category: f.get("category"),
                    brand: f.get("brand"),
                    unit: f.get("unit"),
                    reason: f.get("reason"),
                  })
                }
              >
                {["category", "brand", "unit"].map((type) => (
                  <label key={type}>
                    {type}
                    <select
                      name={type}
                      required={type !== "brand"}
                      defaultValue={selected[type] || ""}
                    >
                      <option value="">{type === "brand" ? "Not assigned" : "Choose value"}</option>
                      {data.terms
                        .filter((t: any) => t.kind === type && t.active)
                        .map((t: any) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
                <label className="workflow-inline-check">
                  <input
                    name="track_serials"
                    type="checkbox"
                    defaultChecked={!!selected.track_serials}
                  />{" "}
                  Require serials when invoicing this article
                </label>
                <label>
                  Reason for change
                  <textarea name="reason" required maxLength={500} />
                </label>
              </SimpleForm>
            )}
          </section>
        </details>
      )}
    </div>
  );
}

function BulkImport({ api, token, canManage, busy, save }: any) {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [key, setKey] = useState("");
  return (
    <>
      {canManage && <InventoryCountImport api={api} token={token} />}
      <details className="stock-import-advanced"><summary>Advanced: add stock using CSV</summary><h2>Stock additions (CSV)</h2>
      <p className="report-note">
        Import positive stock additions by existing material or article code. Raw additions post the
        existing inventory adjustment journal; finished additions use the existing size-based stock
        movements. The entire file rolls back if any row fails. Re-uploading as a new import adds
        stock again, so import each opening balance file once.
      </p>
      <button
        onClick={() =>
          financeCsv("Stock_Import_Template.csv", [
            ["kind", "code", "batch_number", "size_label", "quantity", "unit_cost"],
          ])
        }
      >
        <FileDown /> Download CSV template
      </button>
      {canManage && (
        <SimpleForm
          busy={busy}
          label={`Import ${rows.length} reviewed rows`}
          submit={async (f) => {
            if (!rows.length) throw new Error("Upload and review a CSV first.");
            await save({
              import_key: key,
              adjustment_date: f.get("adjustment_date"),
              reason: f.get("reason"),
              rows,
            });
            setRows([]);
          }}
        >
          <label>
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                setRows([]);
                setError("");
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1024 * 1024) {
                  setError("Choose a CSV smaller than 1 MB.");
                  return;
                }
                try {
                  setRows(parseStockCsv(await file.text()));
                  setKey(crypto.randomUUID());
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          </label>
          {error && <div className="error">{error}</div>}
          <label>
            Adjustment date
            <input name="adjustment_date" type="date" defaultValue={today()} required />
          </label>
          <label>
            Import reason
            <input
              name="reason"
              required
              maxLength={255}
              placeholder="e.g. Verified opening stock count"
            />
          </label>
          {!!rows.length && (
            <WorkflowTable
              values={rows}
              columns={[
                ["kind", "Stock type"],
                ["code", "Existing code"],
                ["batch_number", "Batch"],
                ["size_label", "Size"],
                ["quantity", "Addition"],
                ["unit_cost", "Raw unit cost", "money"],
              ]}
            />
          )}
        </SimpleForm>
      )}
      </details>
    </>
  );
}

function Subledger({
  api,
  token,
  page,
  search,
  go,
}: {
  api: string;
  token: string;
  page: string;
  search: string;
  go: (page: string) => void;
}) {
  const [metadata, setMetadata] = useState<any>(null),
    [kind, setKind] = useState(
      page === "Customer Ledgers" ? "customer" : page === "Supplier Ledgers" ? "supplier" : "raw",
    ),
    [id, setId] = useState(""),
    [variant, setVariant] = useState("");
  const [from, setFrom] = useState(today().slice(0, 4) + "-01-01"),
    [to, setTo] = useState(today()),
    [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  const output = useRef<HTMLDivElement>(null);
  const [partySearch, setPartySearch] = useState("");
  useEffect(() => {
    setKind(page === "Customer Ledgers" ? "customer" : page === "Supplier Ledgers" ? "supplier" : "raw");
    setId("");
    setVariant("");
    setPartySearch("");
  }, [page]);
  useEffect(() => {
    let active = true;
    financeRequest(api, token, `business-workflows?as_of=${today()}`)
      .then((r) => {
        if (active) setMetadata(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, token]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    if (id && from && to && from <= to)
      financeRequest(
        api,
        token,
        `subledger?kind=${kind}&id=${id}&from=${from}&to=${to}&variant=${encodeURIComponent(variant)}`,
      )
        .then((r) => {
          if (active) setData(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [api, token, kind, id, from, to, variant]);
  const options =
    metadata?.[
      kind === "customer"
        ? "customers"
        : kind === "supplier"
          ? "suppliers"
          : kind === "raw"
            ? "materials"
            : "articles"
    ] || [];
  const stock = kind === "raw" || kind === "finished";
  const matchingParties = options.filter((option: any) => matchesSearch([displayCode(option), ...Object.values(option)], partySearch));
  const columns: Column[] = stock
    ? [
        ["date", "Date"],
        ["reference", "Source"],
        ["variant", "Batch / size"],
        ["movement", "Movement"],
        ["received", "Received"],
        ["issued", "Issued"],
        ["balance", "Balance"],
      ]
    : [
        ["date", "Date"],
        ["reference", "Document"],
        ["journal", "Journal"],
        ["description", "Description"],
        ["debit", "Debit", "money"],
        ["credit", "Credit", "money"],
        ["balance", "Balance", "money"],
      ];
  return (
    <>
      <div className="heading">
        <div>
          <span>CONNECTED SUBLEDGER</span>
          <h1>{page}</h1>
          <p>
            Opening balance, dated movements and closing balance from the original posted sources.
          </p>
        </div>
      </div>
      <div className="finance-toolbar subledger-toolbar">
        {page === "Stock Ledgers" && (
          <label>
            Stock type
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setId("");
                setVariant("");
              }}
            >
              <option value="raw">Raw materials</option>
              <option value="finished">Finished goods</option>
            </select>
          </label>
        )}
        <div className="ledger-party-field">
          <label htmlFor="ledger-party-search">
          {stock ? "Product" : "Party"}
          <input id="ledger-party-search" type="search" value={partySearch}
            placeholder={`Search ${stock ? "product" : kind} name or code`}
            onChange={event => setPartySearch(event.target.value)} />
          </label>
          <div className="ledger-party-results" aria-label={`Choose ${stock ? "product" : kind}`}>
            {!metadata ? <p role="status">{error ? "Could not load the list." : "Loading records…"}</p> :
              matchingParties.length ? matchingParties.map((option: any) => <button
                key={option.id} type="button" aria-pressed={id === String(option.id)}
                onClick={() => { setId(String(option.id)); setVariant(""); }}>
                <strong>{displayCode(option)}</strong><span>{option.name}</span>
                {id === String(option.id) && <Check size={16} aria-label="Selected" />}
              </button>) : <p role="status">No matching {stock ? "products" : `${kind}s`} in this database. Try another name or code.</p>}
          </div>
        </div>
        {stock && (
          <label>
            Batch / size (optional)
            <input
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              placeholder="All variants"
            />
          </label>
        )}
        <label>
          From
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button
          className="secondary-action"
          disabled={!data}
          onClick={() => {
            if (output.current)
              printReport({
                key: "subledger",
                title: `${page} - ${data.party.name}`,
                group: "Finance and inventory",
                from,
                to,
                source: output.current,
              });
          }}
        >
          <Printer /> Print / PDF
        </button>
        <button
          disabled={!data}
          onClick={() =>
            financeCsv(`${page}_${displayCode(data.party)}_${to}.csv`, [
              [page, data.party.name, from, to],
              ["Opening", data.opening],
              columns.map((c) => c[1]),
              ...data.rows.map((r: any) => columns.map((c) => displayReferenceValue(r[c[0]], r, c[0]))),
              ["Closing", data.closing],
            ])
          }
        >
          <FileDown /> Download ledger
        </button>
      </div>
      {from > to && <div className="error">Choose a valid date range.</div>}
      {error && <div className="error">{error}</div>}
      {!id && (
        <p>Choose a {stock ? "product" : "customer/supplier"} to view its linked movements.</p>
      )}
      {id && !data && !error && from <= to && <p role="status">Loading ledger movements…</p>}
      {data && (
        <div ref={output} className="subledger-output">
          <h2>
            {displayCode(data.party)} · {data.party.name}
          </h2>
          <div className="workflow-summary">
            <span>Opening {stock ? data.opening : money(data.opening)}</span>
            <strong>Closing {stock ? data.closing : money(data.closing)}</strong>
          </div>
          <WorkflowTable
            values={data.rows.filter((r: any) => matchesSearch(r, search))}
            paginate={false}
            columns={columns}
            actions={(r) => <button onClick={() => go(r.source_page)}>Open source module →</button>}
          />
          <p className="report-note">{data.note}</p>
          {!!search && (
            <p>
              Search filters the visible movements. Balances and the CSV cover the complete selected
              ledger.
            </p>
          )}
        </div>
      )}
    </>
  );
}
