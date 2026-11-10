import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CalendarDays,
  ClipboardList,
  FileText,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { financeMoney as money } from "./finance-utils";
import { WorkflowGo } from "./workflow";
import { matchesSearch } from "./search";
import FilteredRecords from "./FilteredRecords";
import "./dashboard.css";

type Props = {
  data: any;
  days: number;
  setDays: (days: number) => void;
  refresh: () => void;
  busy: boolean;
  go: WorkflowGo;
  createOrder?: () => void;
  search: string;
};
const number = (value: number) => Number(value || 0).toLocaleString("en-LK");
const date = (value: string) =>
  new Date(`${value}T12:00:00+05:30`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

export default function DashboardOverview({
  data,
  days,
  setDays,
  refresh,
  busy,
  go,
  createOrder,
  search,
}: Props) {
  const [activity, setActivity] = useState("invoices");
  const period = `${date(data.period.from)} – ${date(data.period.to)}`;
  const metrics = [
    {
      title: "Accounts receivable",
      value: money(data.outstanding_total),
      detail: `${number(data.open_invoices_count)} open balances · as of today`,
      page: "Debtors Aging",
      icon: Wallet,
      tone: "forest",
    },
    {
      title: "Overdue receivables",
      value: money(data.overdue_total),
      detail: `${number(data.overdue_count)} invoices past their due date`,
      page: "Debtors Aging",
      icon: CalendarDays,
      tone: "wine",
    },
    {
      title: "Collections received",
      value: money(data.collections_total),
      detail: `Posted receipts · ${period}`,
      page: "Collections",
      icon: ArrowDownLeft,
      tone: "teal",
    },
    {
      title: "Sales invoiced",
      value: money(data.period_sales),
      detail: `${number(data.period_invoice_count)} invoices · ${period}`,
      page: "Invoices",
      icon: FileText,
      tone: "ochre",
    },
    {
      title: "Cash and bank",
      value: money(data.cash_balance),
      detail: "Posted ledger balance · as of today",
      page: "Cash Flow",
      icon: Banknote,
      tone: "slate",
    },
    {
      title: "Supplier payables",
      value: money(data.supplier_payables),
      detail: "Unpaid supplier receipt balances · as of today",
      page: "All Payables",
      icon: ClipboardList,
      tone: "plum",
    },
  ];
  const aging = [
    ["current", "Not overdue", "current"],
    ["1_30", "1–30 days", "early"],
    ["31_60", "31–60 days", "mid"],
    ["61_90", "61–90 days", "late"],
    ["90_plus", "Over 90 days", "old"],
    ["terms_not_set", "Terms not set", "unknown"],
  ];
  const activityRows = activity === "invoices" ? data.recent_invoices : data.recent_receipts;
  return (
    <div className="dashboard-overview" aria-busy={busy}>
      <header className="db-header">
        <div>
          <span className="db-eyebrow">YOUR BUSINESS AT A GLANCE</span>
          <h1>Business overview</h1>
          <p>Sales, payments and stock. One clear view.</p>
        </div>
        <div className="db-header-actions">
          <button
            className="db-secondary"
            type="button"
            disabled={busy}
            onClick={refresh}
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={busy ? "db-spin" : ""} />
            Refresh
          </button>
          {createOrder && (
            <button className="db-primary" type="button" onClick={createOrder}>
              <Plus />
              Create sales order
            </button>
          )}
        </div>
      </header>
      <div className="db-period-bar">
        <div className="db-period-options" aria-label="Dashboard activity period">
          {[7, 30, 90].map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={days === value}
              onClick={() => setDays(value)}
            >
              Last {value} days
            </button>
          ))}
        </div>
        <p role="status">
          {busy
            ? "Updating dashboard…"
            : `Updated ${new Date(data.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" })} · Sri Lanka time`}
        </p>
      </div>
      <section className="db-metrics" aria-label="Business balances and performance">
        {metrics.map(({ title, value, detail, page, icon: Icon, tone }) => (
          <button
            type="button"
            className={`db-metric db-${tone}`}
            key={title}
            onClick={() => go(page)}
          >
            <span className="db-metric-top">
              <span>{title}</span>
              <i>
                <Icon />
              </i>
            </span>
            <strong>{value}</strong>
            <span className="db-metric-bottom">
              {detail}
              <ArrowUpRight />
            </span>
          </button>
        ))}
      </section>
      <section className="db-quick-actions" aria-label="Frequently used pages">
        {[
          ["Collections", "Record collection", ArrowDownLeft],
          ["Purchase Orders", "Purchase orders", ClipboardList],
          ["Payment Vouchers", "Payment vouchers", Wallet],
          ["Inventory Overview", "Inventory", Boxes],
        ].map(([page, label, Icon]: any) => (
          <button type="button" key={page} onClick={() => go(page)}>
            <Icon />
            <span>{label}</span>
            <ArrowRight />
          </button>
        ))}
      </section>
      <div className="db-main-grid">
        <section className="db-panel">
          <div className="db-panel-title">
            <div>
              <span className="db-eyebrow">CUSTOMER BALANCES</span>
              <h2>Receivables at a glance</h2>
            </div>
            <button type="button" onClick={() => go("Debtors Aging")}>
              View aging <ArrowRight />
            </button>
          </div>
          <div className="db-aging-visual">
            <ReceivablesChart aging={data.aging} total={data.outstanding_total} />
            <div className="db-receivable-split">
              <span>Opening balances<strong>{money(data.opening_receivables_total)}</strong></span>
              <span>Sales balances<strong>{money(data.sales_receivables_total)}</strong></span>
            </div>
          </div>
          <div className="db-aging-list">
            {aging.map(([key, label, tone]) => (
              <button type="button" onClick={() => go("Debtors Aging")} key={key}>
                <span>
                  <i className={`db-age-${tone}`} />
                  {label}
                </span>
                <strong>{money(data.aging[key])}</strong>
              </button>
            ))}
          </div>
          {data.terms_missing_count > 0 && (
            <p className="db-terms-note">
              {number(data.terms_missing_count)} balances have no due date. They are shown as “Terms
              not set”, not overdue.
            </p>
          )}
        </section>
        <section className="db-panel">
          <div className="db-panel-title">
            <div>
              <span className="db-eyebrow">COLLECTION PRIORITIES</span>
              <h2>Largest customer balances</h2>
            </div>
            <button type="button" onClick={() => go("Customer Ledgers")}>
              Ledgers <ArrowRight />
            </button>
          </div>
          <div className="db-balance-bars" aria-label="Largest customer balances chart">
            {data.top_customers.filter((row: any) => matchesSearch(row, search)).map((customer: any, index: number) => (
              <button type="button" key={customer.id} onClick={() => go("Customers", { query: customer.code })}>
                <span className="db-balance-heading"><strong>{customer.customer}</strong><b>{money(customer.outstanding)}</b></span>
                <span className="db-balance-track"><i style={{width: Math.max(0, Math.min(100, customer.outstanding / Math.max(1, ...data.top_customers.map((c: any) => Number(c.outstanding))) * 100)) + "%", background: ["#7350a2", "#21866c", "#d18a32", "#b8536e", "#52818b"][index % 5]}} /></span>
                <small>{customer.invoices} open invoices{customer.overdue > 0 ? " / " + money(customer.overdue) + " overdue" : ""}</small>
              </button>
            ))}
            {!data.top_customers.filter((row: any) => matchesSearch(row, search)).length && <p className="db-note">No matching customer balances.</p>}
          </div>
          <p className="db-note">
            Top five by outstanding amount. {number(data.customers_count)} active customer accounts
            in the system.
          </p>
        </section>
      </div>
      <section className="db-panel db-activity">
        <div className="db-panel-title">
          <div>
            <span className="db-eyebrow">LATEST DOCUMENTS</span>
            <h2>Recent activity</h2>
          </div>
          <div className="db-period-options">
            <button
              type="button"
              aria-pressed={activity === "invoices"}
              onClick={() => setActivity("invoices")}
            >
              Invoices
            </button>
            <button
              type="button"
              aria-pressed={activity === "collections"}
              onClick={() => setActivity("collections")}
            >
              Collections
            </button>
          </div>
        </div>
        <FilteredRecords
          key={activity}
          records={activityRows.filter((row: any) => matchesSearch(row, search))}
          title="recent documents"
          fields={
            activity === "invoices"
              ? [
                  { key: "number", label: "Invoice" },
                  { key: "customer_name", label: "Customer" },
                  { key: "invoice_date", label: "Date", kind: "date" },
                  { key: "total", label: "Total", kind: "number" },
                  { key: "outstanding", label: "Outstanding", kind: "number" },
                ]
              : [
                  { key: "number", label: "Receipt" },
                  { key: "customer_name", label: "Customer" },
                  { key: "receipt_date", label: "Date", kind: "date" },
                  { key: "amount", label: "Received", kind: "number" },
                ]
          }
        >
          {(rows) => (
            <div className="db-activity-grid">
              {rows.map((row: any) => (
                <button
                  type="button"
                  className="db-document"
                  key={row.id}
                  onClick={() =>
                    go(activity === "invoices" ? "Invoices" : "Collections", { query: row.number })
                  }
                >
                  <i>{activity === "invoices" ? <FileText /> : <ArrowDownLeft />}</i>
                  <span>
                    <strong>{row.number}</strong>
                    <small>{row.customer_name}</small>
                    <small>{date(row.invoice_date || row.receipt_date)}</small>
                  </span>
                  <b>{money(activity === "invoices" ? row.total : row.amount)}</b>
                  <ArrowUpRight />
                </button>
              ))}
              {!rows.length && (
                <p className="db-note">No {activity} recorded for this period and search.</p>
              )}
            </div>
          )}
        </FilteredRecords>
        <p className="db-note">
          Latest eight documents in the selected period. Opening balance documents are excluded.
        </p>
      </section>
    </div>
  );
}

function ReceivablesChart({ aging, total }: { aging: Record<string, number>; total: number }) {
  const segments = ["current", "1_30", "31_60", "61_90", "90_plus", "terms_not_set"];
  const colours = ["#25826b", "#a9be59", "#d09a3b", "#ce6d42", "#aa4565", "#8973ad"];
  let offset = 0;
  return <div className="db-donut" role="img" aria-label={"Receivables distribution by age. Total " + money(total)}>
    <svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="68" fill="none" stroke="#edf0ed" strokeWidth="20" />
      {segments.map((key, index) => {
        const share = total > 0 ? Math.max(0, Number(aging[key] || 0)) / total * 100 : 0;
        const start = offset; offset += share;
        return <circle key={key} cx="90" cy="90" r="68" pathLength="100" fill="none" stroke={colours[index]} strokeWidth="20" strokeDasharray={share + " " + (100 - share)} strokeDashoffset={-start} transform="rotate(-90 90 90)"><title>{key.replace(/_/g, " ") + ": " + money(aging[key])}</title></circle>;
      })}
      <text x="90" y="86" textAnchor="middle" className="db-donut-label">RECEIVABLES</text>
      <text x="90" y="108" textAnchor="middle" className="db-donut-total">{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(total || 0)}</text>
    </svg>
  </div>;
}
