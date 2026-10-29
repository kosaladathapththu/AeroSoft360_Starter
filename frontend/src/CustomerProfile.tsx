import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { financeCsv, financeMoney as money, financeRequest, financeToday } from "./finance-utils";
import { WorkflowTable } from "./BusinessWorkflowsPage";
import { printReport } from "./report-print";
import InvoiceBill from "./InvoiceBill";
import "./customer-profile.css";

type Column = [string, string, "money"?];
const invoiceColumns: Column[] = [
  ["number", "Invoice"],
  ["document_kind", "Document type"],
  ["invoice_date", "Date"],
  ["due_date", "Due date"],
  ["total", "Total", "money"],
  ["received_as_of", "Paid", "money"],
  ["outstanding_as_of", "Outstanding", "money"],
  ["days_overdue", "Days overdue"],
  ["status_as_of", "Status"],
];
const paymentColumns: Column[] = [
  ["number", "Receipt"],
  ["document_kind", "Document type"],
  ["receipt_date", "Date"],
  ["amount", "Received", "money"],
  ["payment_method", "Method"],
  ["reference", "Reference"],
  ["collector", "Collector"],
  ["invoice_references", "Invoices"],
];
const lineColumns: Column[] = [
  ["article_code", "Article"],
  ["article_name", "Description"],
  ["colour", "Colour"],
  ["size_label", "Size"],
  ["quantity", "Quantity"],
  ["fixed_rate_display", "Fixed rate"],
  ["rate", "Rate", "money"],
  ["line_total", "Amount", "money"],
];
const ledgerColumns: Column[] = [
  ["date", "Date"],
  ["reference", "Document"],
  ["journal", "Journal"],
  ["description", "Description"],
  ["debit", "Debit", "money"],
  ["credit", "Credit", "money"],
  ["balance", "Balance", "money"],
];
const tabs = [
  "Overview",
  "Aging",
  "Invoices",
  "Payments",
  "Orders",
  "Quotations",
  "Account ledger",
  "Serials & warranties",
];
const agingNames: Record<string, string> = {
  current: "Not overdue",
  days_1_30: "1–30 days overdue",
  days_31_60: "31–60 days overdue",
  days_61_90: "61–90 days overdue",
  days_90_plus: "Over 90 days overdue",
};

export default function CustomerProfile({
  id,
  api,
  token,
  close,
}: {
  id: number;
  api: string;
  token: string;
  close: () => void;
}) {
  const [date, setDate] = useState(financeToday());
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Overview");
  const [bill, setBill] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    setDetail(null);
    if (!date) return;
    financeRequest(api, token, `customers/${id}/profile?as_of=${encodeURIComponent(date)}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, token, id, date, reload]);
  const table = (values: any[], columns: Column[], actions?: (row: any) => React.ReactNode) => (
    <WorkflowTable
      values={values.map((row) => ({
        ...row,
        fixed_rate_display: row.fixed_rate == null ? "Not recorded" : money(row.fixed_rate),
      }))}
      columns={columns}
      actions={actions}
    />
  );
  const cards = (entries: [string, any][]) => (
    <div className="customer-profile-cards">
      {entries.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
  const sections = (printing = false) => {
    if (!data) return null;
    const c = data.customer,
      s = data.summary;
    const show = (name: string) => printing || tab === name;
    return (
      <>
        {show("Overview") && (
          <section>
            <h3>Customer details</h3>
            <dl className="customer-profile-details">
              {[
                ["Customer code", c.code],
                ["Name", c.name],
                ["Phone", c.phone],
                ["Address", c.address],
                ["Tax identification", c.tin],
                ["Status", c.status],
                ["Credit terms", `${c.credit_days} days`],
                [
                  "Credit limit",
                  s.credit_limit_configured ? money(c.credit_limit) : "Not configured",
                ],
                ["Last invoice", s.last_invoice_date],
                ["Last payment", s.last_payment_date],
                ["Created", c.created_at],
                ["Updated", c.updated_at],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <h3>Account summary</h3>
            {cards([
              ["Total invoiced", money(s.total_invoiced)],
              ["Opening receivable", money(s.opening_receivable)],
              ["Opening customer credit", money(s.opening_customer_credit)],
              ["Payments received", money(s.total_received)],
              ["Net amount due", money(s.net_balance)],
              ["Customer credit / unapplied payments", money(s.customer_credit)],
              [
                "Available credit",
                s.available_credit === null ? "Not configured" : money(s.available_credit),
              ],
              ["Over credit limit", money(s.over_credit_limit)],
              ["Open invoices", s.open_invoices],
              ["Oldest overdue invoice", `${s.oldest_overdue_days} days`],
            ])}
            <p>
              Customer credit is separate from invoice balances. A negative net amount due means
              credit is held for this customer.
            </p>
          </section>
        )}
        {show("Aging") && (
          <section>
            <h3>Receivables aging as of {data.as_of}</h3>
            <p>Aging is measured from the invoice due date. Invoices due today are not overdue.</p>
            {cards(
              Object.entries(agingNames).map(
                ([key, label]) => [label, money(data.aging[key])] as [string, string],
              ),
            )}
            {cards([
              ["Due today", money(s.due_today)],
              ["Total outstanding", money(s.outstanding)],
              ["Total overdue", money(s.overdue)],
            ])}
            {table(
              data.invoices.filter((i: any) => i.outstanding_as_of > 0),
              invoiceColumns,
            )}
          </section>
        )}
        {show("Invoices") && (
          <section>
            <h3>Invoices ({data.invoices.length})</h3>
            <p>
              Balances use the selected date. Invoice bills display the current saved invoice and
              payment details.
            </p>
            {table(
              data.invoices,
              invoiceColumns,
              printing
                ? undefined
                : (row) => (
                    <>
                      <button onClick={() => setDetail(row)}>Details</button>
                      <button onClick={() => setBill(Number(row.id))}>View bill</button>
                    </>
                  ),
            )}
            {printing &&
              data.invoices.map((i: any) => (
                <div key={i.id}>
                  <h4>{i.number} — items</h4>
                  {table(i.lines, lineColumns)}
                </div>
              ))}
          </section>
        )}
        {show("Payments") && (
          <section>
            <h3>Posted payments ({data.payments.length})</h3>
            {table(
              data.payments,
              paymentColumns,
              printing
                ? undefined
                : (row) => <button onClick={() => setDetail(row)}>Allocations</button>,
            )}
            {printing &&
              data.payments.map((p: any) => (
                <div key={p.id}>
                  <h4>{p.number} — allocations</h4>
                  {table(p.allocations, [
                    ["invoice_number", "Invoice"],
                    ["amount", "Allocated", "money"],
                  ])}
                </div>
              ))}
          </section>
        )}
        {show("Orders") && (
          <section>
            <h3>Customer purchase orders ({data.customer_pos.length})</h3>
            {table(
              data.customer_pos,
              [
                ["number", "Customer PO"],
                ["customer_po_reference", "Reference"],
                ["po_date", "Date"],
                ["salesperson", "Salesperson"],
                ["total", "Total", "money"],
                ["status", "Status"],
              ],
              printing ? undefined : (row) => <button onClick={() => setDetail(row)}>Items</button>,
            )}
            <h3>Sales orders ({data.sales_orders.length})</h3>
            <p>
              Customer POs and sales orders are linked stages; their totals are not added together.
            </p>
            {table(
              data.sales_orders.map((o: any) => ({
                ...o,
                invoice_numbers: o.invoices.map((i: any) => i.number).join(", "),
              })),
              [
                ["number", "Sales order"],
                ["po_number", "Customer PO"],
                ["order_date", "Date"],
                ["total", "Total", "money"],
                ["status", "Status"],
                ["invoice_numbers", "Invoices"],
              ],
              printing ? undefined : (row) => <button onClick={() => setDetail(row)}>Items</button>,
            )}
            {printing &&
              [...data.customer_pos, ...data.sales_orders].map((o: any) => (
                <div key={o.number}>
                  <h4>{o.number} — items</h4>
                  {table(o.lines, lineColumns)}
                </div>
              ))}
          </section>
        )}
        {show("Quotations") && (
          <section>
            <h3>Quotations ({data.quotations.length})</h3>
            {table(
              data.quotations,
              [
                ["number", "Quotation"],
                ["quotation_date", "Date"],
                ["valid_until", "Valid until"],
                ["total", "Total", "money"],
                ["status", "Status"],
                ["customer_po_id", "Converted customer PO ID"],
              ],
              printing ? undefined : (row) => <button onClick={() => setDetail(row)}>Items</button>,
            )}
            {printing &&
              data.quotations.map((q: any) => (
                <div key={q.id}>
                  <h4>{q.number} — items</h4>
                  {table(q.lines || [], lineColumns)}
                </div>
              ))}
          </section>
        )}
        {show("Account ledger") && (
          <section>
            <h3>Posted customer account ledger</h3>
            <p>{data.ledger.note}</p>
            {cards([
              ["Ledger closing balance", money(s.ledger_balance)],
              ["Document balance", money(s.net_balance)],
              ["Reconciliation difference", money(s.ledger_difference)],
            ])}
            {s.ledger_difference !== 0 && (
              <p role="status" className="customer-profile-warning">
                The posted ledger and document balance differ. Review the related journals in
                General Ledger.
              </p>
            )}
            {table(data.ledger.rows, ledgerColumns)}
          </section>
        )}
        {show("Serials & warranties") && (
          <section>
            <h3>Issued serial numbers and warranty coverage</h3>
            {table(
              data.serials.map((p: any) => ({
                ...p,
                coverage: p.warranty_ends_on
                  ? p.warranty_ends_on >= data.as_of
                    ? "Within warranty period"
                    : "Warranty period ended"
                  : "No warranty end date",
              })),
              [
                ["serial_number", "Serial"],
                ["article_code", "Article"],
                ["article_name", "Description"],
                ["invoice_number", "Invoice"],
                ["warranty_starts_on", "Starts"],
                ["warranty_ends_on", "Ends"],
                ["coverage", "Coverage as of date"],
              ],
            )}
            <h3>Warranty claims</h3>
            {table(data.warranty_claims, [
              ["id", "Claim ID"],
              ["serial_number", "Serial"],
              ["claim_date", "Date"],
              ["issue", "Issue"],
              ["status", "Current status"],
              ["resolution", "Resolution"],
            ])}
          </section>
        )}
      </>
    );
  };
  const exportCsv = () => {
    const rows: any[][] = [
      ["Customer profile", data.customer.code, data.customer.name],
      ["As of", data.as_of],
      [data.basis],
      [],
      ["Customer details"],
      ...Object.entries(data.customer),
      [],
      ["Summary"],
      ...Object.entries(data.summary),
      [],
      ["Aging"],
      ...Object.entries(data.aging).map(([key, value]) => [agingNames[key], value]),
    ];
    const add = (name: string, values: any[], columns: Column[]) =>
      rows.push(
        [],
        [name],
        columns.map((c) => c[1]),
        ...values.map((v) => columns.map((c) => v[c[0]])),
      );
    add("Invoices", data.invoices, invoiceColumns);
    add("Payments", data.payments, paymentColumns);
    add("Account ledger", data.ledger.rows, ledgerColumns);
    financeCsv(`${data.customer.code}-statement-${data.as_of}.csv`, rows);
  };
  return createPortal(
    <>
      <div
        className="backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !bill) close();
        }}
      >
        <div
          className="modal customer-profile-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-profile-title"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !bill) close();
          }}
        >
          <header className="popup-header">
            <div>
              <span className="eyebrow">Customer account</span>
              <h2 id="customer-profile-title">{data ? data.customer.name : "Customer profile"}</h2>
              <p>
                {data
                  ? `${data.customer.code} · ${data.customer.status}`
                  : "Details, balances and account history"}
              </p>
            </div>
            <button
              aria-label="Close customer profile"
              className="icon-btn"
              onClick={close}
              autoFocus
            >
              <X size={20} />
            </button>
          </header>
          <div className="customer-profile-toolbar">
            <label>
              As of date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <button onClick={() => setReload((v) => v + 1)}>Refresh</button>
            <button
              disabled={!data}
              onClick={() => {
                if (data && printRef.current)
                  printReport({
                    key: "customer_profile",
                    title: `Customer profile — ${data.customer.code} — ${data.customer.name}`,
                    group: "Customer account statement",
                    from: data.as_of,
                    to: data.as_of,
                    source: printRef.current,
                  });
              }}
            >
              Print / Save PDF
            </button>
            <button disabled={!data} onClick={exportCsv}>
              Download statement CSV
            </button>
          </div>
          {data && (
            <nav className="customer-profile-tabs" aria-label="Customer profile sections">
              {tabs.map((name) => (
                <button
                  key={name}
                  aria-pressed={tab === name}
                  onClick={() => {
                    setTab(name);
                    setDetail(null);
                  }}
                >
                  {name}
                </button>
              ))}
            </nav>
          )}
          <div className="popup-body customer-profile-body">
            {error ? (
              <p role="alert">{error}</p>
            ) : !data ? (
              <p role="status">{date ? "Loading customer account…" : "Select an as of date."}</p>
            ) : (
              <>
                {cards([
                  ["Outstanding invoices", money(data.summary.outstanding)],
                  ["Overdue balance", money(data.summary.overdue)],
                  ["Customer credit", money(data.summary.customer_credit)],
                ])}
                {sections()}
                {detail && (
                  <section className="customer-profile-detail">
                    <button onClick={() => setDetail(null)}>Close details</button>
                    <h3>{detail.number}</h3>
                    {detail.lines && table(detail.lines, lineColumns)}
                    {detail.allocations &&
                      table(detail.allocations, [
                        ["invoice_number", "Invoice"],
                        ["amount", "Allocated", "money"],
                      ])}
                    {detail.payments &&
                      table(detail.payments, [
                        ["receipt_number", "Receipt"],
                        ["receipt_date", "Date"],
                        ["amount", "Allocated", "money"],
                      ])}
                  </section>
                )}
                <p className="customer-profile-basis">{data.basis}</p>
              </>
            )}
          </div>
          <footer className="popup-footer">
            <button onClick={close}>Close</button>
          </footer>
          <div hidden ref={printRef}>
            {data && (
              <>
                <p>{data.basis}</p>
                {sections(true)}
              </>
            )}
          </div>
        </div>
      </div>
      {bill !== null && (
        <InvoiceBill id={bill} api={api} token={token} close={() => setBill(null)} />
      )}
    </>,
    document.body,
  );
}
