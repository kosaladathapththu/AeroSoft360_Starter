import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, FileDown, Plus, Printer, RefreshCw, X } from "lucide-react";
import {
  financeCsv,
  financeMoney as money,
  financeRequest,
  financeToday as today,
} from "./finance-utils";
import { printReport } from "./report-print";
import "./business-workflows.css";
import { parseStockCsv } from "./stock-import";

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
  go: (page: string) => void;
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
}: Props) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [modal, setModal] = useState<any>(null);
  const [asOf, setAsOf] = useState(today());
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
  const mutate = async (path: string, body: any, method = "POST") => {
    setBusy(true);
    setError("");
    try {
      const result = await request(path, body, method);
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
  const match = (row: any) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase());
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
    "Head Office Salaries": ["Payroll", "Employees", "Chart of Accounts", "Cash Flow", "General Ledger"],
    "Head Office Expenses": ["Payment Vouchers", "Chart of Accounts", "Cash Flow", "General Ledger"],
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
          <h1>{page}</h1>
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
                  Register the supplier document against a posted GRN. Stock and account 2100 were
                  posted at receipt; registration does not duplicate that liability. The registered
                  due date feeds supplier aging.
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
                  actions={() => (
                    <button onClick={() => go("Payment Vouchers")}>Pay through voucher</button>
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
            {page === "Head Office Salaries" && <>
              <p className="report-note">Salaries come from the existing payroll runs. Select the Head Office department below to isolate office staff. Only posted, unpaid payroll can be paid; payments debit salaries payable (2250) and credit the selected cash/bank account. Historical paid flags are preserved without charging cash again.</p>
              <label>Department<select value={department} onChange={e => setDepartment(e.target.value)}><option value="">All departments</option>{[...new Set<string>(data.salary_items.map((r: any) => r.department))].map(name => <option key={name} value={name}>{name}</option>)}</select></label>
              <WorkflowTable values={rows(data.salary_items.filter((r: any) => !department || r.department === department))} columns={[["name", "Employee"], ["department", "Department"], ["payroll_number", "Payroll"], ["period_end", "Period end"], ["payroll_status", "Payroll status"], ["net_salary", "Net salary", "money"], ["payment_status", "Payment status"]]} actions={r => <>{r.linked_payment && <small>Journal #{r.linked_payment.journal_id} ? {r.linked_payment.payment_date}</small>}{can("accounting.manage") && (r.linked_payment ? <button onClick={() => setModal({kind:"salary-reverse",row:r})}>Reverse payment</button> : r.payment_status !== "paid" && r.payroll_status === "posted" ? <button onClick={() => setModal({kind:"salary-pay",row:r})}>Pay salary</button> : <span>{r.payment_status === "paid" ? "Historical paid status" : "Post payroll first"}</span>)}</>} />
            </>}
            {page === "Head Office Expenses" && <><p className="report-note">Administrative expenses are linked to account 5400 and the existing payment vouchers. Record a voucher using Administrative Expenses (5400) to show its posted expense, cash movement and payment document here.</p><button className="primary" onClick={() => go("Payment Vouchers")}>Record / manage expense voucher ?</button><WorkflowTable values={rows(data.expenses)} columns={[["number", "Voucher"], ["payment_date", "Date"], ["payee", "Payee"], ["description", "Expense"], ["amount", "Amount", "money"], ["status", "Status"]]} actions={() => <button onClick={() => go("Payment Vouchers")}>Open voucher module ?</button>} /></>}
            {page === "Bulk Inventory Import" && (
              <BulkImport
                canManage={can("stock.manage")}
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
          title={
            modal.kind === "quote"
              ? modal.row
                ? `Edit ${modal.row.number}`
                : "New quotation"
              : modal.kind.replace(/-/g, " ")
          }
          busy={busy}
          close={() => setModal(null)}
        >
          {modal.kind === "salary-pay" && <SimpleForm busy={busy} label="Post salary payment" submit={f => mutate("salary-payments",{payroll_item_id:modal.row.id,payment_account_id:Number(f.get("payment_account_id")),payment_date:f.get("payment_date")})}><p>{modal.row.name} ? {modal.row.payroll_number} ? {money(modal.row.net_salary)}</p><label>Pay from<select name="payment_account_id" required><option value="">Choose cash/bank account</option>{data.accounts.filter((a:any)=>a.is_cash_account).map((a:any)=><option key={a.id} value={a.id}>{a.code} ? {a.name}</option>)}</select></label><label>Payment date<input name="payment_date" type="date" min={modal.row.period_end} defaultValue={today()} required /></label></SimpleForm>}
          {modal.kind === "salary-reverse" && <SimpleForm busy={busy} label="Reverse salary payment" submit={f => mutate(`salary-payments/${modal.row.linked_payment.id}/reverse`,{void_date:f.get("void_date"),reason:f.get("reason")})}><p>{modal.row.name} ? {money(modal.row.linked_payment.amount)}</p><label>Reversal date<input name="void_date" type="date" min={modal.row.linked_payment.payment_date} defaultValue={today()} required /></label><label>Reason<textarea name="reason" required maxLength={500} /></label></SimpleForm>}
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
              <WorkflowTable
                values={modal.row.lines}
                columns={[
                  ["code", "Article"],
                  ["name", "Product"],
                  ["size_label", "Size"],
                  ["colour", "Colour"],
                  ["quantity", "Pieces"],
                  ["rate", "Unit price", "money"],
                  ["total", "Amount", "money"],
                ]}
              />
              <div className="workflow-summary">
                <span>Quotation total</span>
                <strong>{money(modal.row.total)}</strong>
              </div>
              <p>{modal.row.notes}</p>
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

function WorkflowTable({
  values,
  columns,
  actions,
}: {
  values: any[];
  columns: Column[];
  actions?: (row: any) => ReactNode;
}) {
  return (
    <div className="table-card workflow-table">
      <table>
        <thead>
          <tr>
            {columns.map(([key, name, type]) => (
              <th key={key} className={type === "money" ? "report-number" : undefined}>
                {name}
              </th>
            ))}
            {actions && <th className="workflow-actions-cell">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {values.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map(([key, , type]) => (
                <td key={key} className={type === "money" ? "report-number" : undefined}>
                  {type === "money" ? money(row[key]) : String(row[key] ?? "—")}
                </td>
              ))}
              {actions && (
                <td className="workflow-actions-cell">
                  <div className="workflow-actions">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
          {!values.length && (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)}>No records match this selection.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowModal({
  title,
  children,
  busy,
  close,
}: {
  title: string;
  children: ReactNode;
  busy: boolean;
  close: () => void;
}) {
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

function SimpleForm({
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
  const [lines, setLines] = useState<any[]>(
    initial?.lines || [{ set_item_id: "", quantity: 1, rate: 0, colour: "" }],
  );
  const change = (index: number, patch: any) =>
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  return (
    <SimpleForm
      busy={busy}
      label="Save quotation"
      submit={(f) =>
        save({
          customer_id: Number(f.get("customer_id")),
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
      <div className="form-row">
        <label>
          Customer
          <select name="customer_id" required defaultValue={initial?.customer_id || ""}>
            <option value="" disabled>
              Choose customer
            </option>
            {data.customers.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>
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
                  {r.code} — {r.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          Quotation date
          <input
            name="quotation_date"
            type="date"
            required
            defaultValue={initial?.quotation_date || today()}
          />
        </label>
        <label>
          Valid until
          <input
            name="valid_until"
            type="date"
            required
            defaultValue={initial?.valid_until || today()}
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
      <h3>Quoted products and sizes</h3>
      {lines.map((line, index) => (
        <div className="workflow-quote-line" key={index}>
          <label>
            Article / size
            <select
              required
              value={line.set_item_id}
              onChange={(e) => {
                const item = data.items.find((i: any) => i.id === Number(e.target.value));
                change(index, {
                  set_item_id: Number(e.target.value),
                  rate: Number(item?.unit_price || 0),
                });
              }}
            >
              <option value="" disabled>
                Choose size
              </option>
              {data.items.map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.code} · {i.name} · Size {i.size_label} · {money(i.unit_price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Colour
            <input
              maxLength={80}
              value={line.colour || ""}
              onChange={(e) => change(index, { colour: e.target.value })}
            />
          </label>
          <label>
            Pieces
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={line.quantity}
              onChange={(e) => change(index, { quantity: Number(e.target.value) })}
            />
          </label>
          <label>
            Price / piece
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={line.rate}
              onChange={(e) => change(index, { rate: Number(e.target.value) })}
            />
          </label>
          <button
            type="button"
            disabled={lines.length === 1}
            onClick={() => setLines(lines.filter((_, i) => i !== index))}
          >
            Remove line
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setLines([...lines, { set_item_id: "", quantity: 1, rate: 0, colour: "" }])}
      >
        <Plus /> Add size
      </button>
      <div className="workflow-summary">
        <span>Offer total</span>
        <strong>
          {money(
            lines.reduce((sum, line) => sum + Math.round(line.quantity * line.rate * 100) / 100, 0),
          )}
        </strong>
      </div>
      <label>
        Notes
        <textarea name="notes" maxLength={2000} defaultValue={initial?.notes} />
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

function SupplierInvoiceForm({ data, busy, save }: any) {
  const [id, setId] = useState("");
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
              {l.code} · {l.name}
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
                {a.code} · {a.name}
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
                  {a.code} · {a.name}
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
    <>
      <p className="report-note">
        Shared product classifications are used by the existing article/pricing records. Existing
        category and unit values are retained. Assign classifications below without changing prices
        or stock.
      </p>
      <WorkflowTable
        values={data.terms.filter((t: any) => t.kind === kind)}
        columns={[
          ["name", page],
          ["active", "Active"],
        ]}
      />
      {canManage && (
        <>
          <SimpleForm
            busy={busy}
            label={`Add ${kind}`}
            submit={(f) => save("catalog-terms", { kind, name: f.get("name") })}
          >
            <label>
              New {kind}
              <input name="name" required maxLength={kind === "unit" ? 20 : 80} />
            </label>
          </SimpleForm>
          <h2>Link classifications to an article</h2>
          <label>
            Article
            <select value={article} onChange={(e) => setArticle(e.target.value)}>
              <option value="">Select article</option>
              {data.articles.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <SimpleForm
              key={selected.id}
              busy={busy}
              label="Save product classification"
              submit={(f) =>
                save("product-classification", {
                  article_id: selected.id,
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
              <label>
                Reason for change
                <textarea name="reason" required maxLength={500} />
              </label>
            </SimpleForm>
          )}
        </>
      )}
    </>
  );
}


function BulkImport({ canManage, busy, save }: any) {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [key, setKey] = useState("");
  return (
    <>
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
      <div className="finance-toolbar">
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
        <label>
          {stock ? "Product" : "Party"}
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setVariant("");
            }}
          >
            <option value="">Choose {stock ? "product" : "party"}</option>
            {options.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.code} · {o.name}
              </option>
            ))}
          </select>
        </label>
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
            financeCsv(`${page}_${data.party.code}_${to}.csv`, [
              [page, data.party.name, from, to],
              ["Opening", data.opening],
              columns.map((c) => c[1]),
              ...data.rows.map((r: any) => columns.map((c) => r[c[0]])),
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
      {data && (
        <div ref={output}>
          <h2>
            {data.party.code} · {data.party.name}
          </h2>
          <div className="workflow-summary">
            <span>Opening {stock ? data.opening : money(data.opening)}</span>
            <strong>Closing {stock ? data.closing : money(data.closing)}</strong>
          </div>
          <WorkflowTable
            values={data.rows.filter((r: any) =>
              JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
            )}
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
