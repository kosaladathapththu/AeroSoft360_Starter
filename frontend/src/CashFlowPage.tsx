import { displayCode } from "./representative-reference";
import { matchesSearch } from "./search";
import FilteredRecords from "./FilteredRecords";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileDown, Loader2, RefreshCw } from "lucide-react";
import {
  activityLabel,
  financeCsv,
  financeMoney as money,
  financeRequest,
  financeToday,
} from "./finance-utils";
import "./finance-management.css";

export default function CashFlowPage({
  api,
  token,
  search,
  go,
}: {
  api: string;
  token: string;
  search: string;
  go: (page: string) => void;
}) {
  const [from, setFrom] = useState(financeToday().slice(0, 7) + "-01");
  const [to, setTo] = useState(financeToday());
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("all");
  const [accountId, setAccountId] = useState("");
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!from || !to || from > to) {
      setError("Choose a valid date range.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await financeRequest(api, token, `cash-flow?from=${from}&to=${to}${accountId ? `&account_id=${accountId}` : ""}`);
      if (version === requestVersion.current) setData(result);
    } catch (err) {
      if (version === requestVersion.current) setError((err as Error).message);
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }, [api, token, from, to, accountId]);
  useEffect(() => {
    load();
  }, [load]);
  const rows = (data?.movements || []).filter(
    (m: any) =>
      (activity === "all" ||
        m.allocations.some((a: any) => a.activity === activity && a.amount !== 0)) &&
      matchesSearch(m, search),
  );
  return (
    <>
      <div className="heading">
        <div>
          <span>FINANCE &amp; REPORTS</span>
          <h1>Cash Flow</h1>
          <p>Actual posted cash and bank movements, reconciled to the ledger.</p>
        </div>
        <button className="secondary-action" onClick={() => go("Chart of Accounts")}>
          Manage accounts
        </button>
      </div>
      <div className="finance-toolbar">
        <label>
          Cash / bank account
          <select value={accountId} onChange={event => { setAccountId(event.target.value); setActivity("all"); }}>
            <option value="">All cash and bank accounts</option>
            {(data?.available_accounts || data?.accounts || []).map((account: any) =>
              <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            min={from}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <button className="secondary-action" disabled={busy} onClick={load}>
          {busy ? <Loader2 /> : <RefreshCw />} Refresh
        </button>
        <button
          className="secondary-action"
          disabled={!data || busy || data.period.from !== from || data.period.to !== to || String(data.account_id ?? "") !== accountId}
          onClick={() =>
            financeCsv(`Cash_Flow_${accountId || "All"}_${from}_to_${to}.csv`, [
              ["Cash flow report", from, to],
              ["Account", accountId ? `${data.accounts[0]?.code} - ${data.accounts[0]?.name}` : "All cash and bank accounts"],
              ["Basis", accountId ? "Includes transfers into/out of selected account; same-period cancelled vouchers excluded" : "Internal cash/bank transfers excluded"],
              ["Opening cash / bank", data.opening_balance],
              ["Operating", data.operating],
              ["Investing", data.investing],
              ["Financing", data.financing],
              ["Needs classification", data.unclassified],
              ["Net change", data.net_change],
              ["Closing cash / bank", data.closing_balance],
              ["Reconciliation difference", data.reconciliation_difference],
              [],
              [
                "Date",
                "Journal",
                "Description",
                "Source",
                "Inflow",
                "Outflow",
                "Net",
                "Classification",
              ],
              ...data.movements.map((m: any) => [
                m.date,
                m.number,
                m.description,
                m.source_type,
                m.inflow,
                m.outflow,
                m.net,
                m.allocations
                  .map((a: any) => `${activityLabel(a.activity)}: ${a.amount}`)
                  .join("; "),
              ]),
              [],
              [
                "Cash / bank account",
                "Opening",
                "Receipts including transfers",
                "Payments including transfers",
                "Closing",
              ],
              ...data.accounts.map((a: any) => [
                `${displayCode(a)} - ${a.name}`,
                a.opening,
                a.receipts,
                a.payments,
                a.closing,
              ]),
            ])
          }
        >
          <FileDown /> Download full cash flow
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <div className="loading">
          <Loader2 /> Calculating posted movements…
        </div>
      )}
      {data && !busy && !error && String(data.account_id ?? "") === accountId && (
        <>
          <p className="finance-period">
            {data.period.from} to {data.period.to}
            {accountId && <> · {data.accounts[0]?.code} — {data.accounts[0]?.name}</>}
          </p>
          <p className="report-note">{accountId
            ? "Selected account: receipts include money transferred from banks and other cash accounts. Cancelled vouchers and their reversals within this period are excluded from receipts and payments."
            : "Combined company cash flow: transfers between cash and bank accounts are excluded. Select an account to view its receipts and payments including transfers."}</p>
          <div className="cash-flow-kpis">
            <article>
              <span>Opening cash &amp; bank</span>
              <b>{money(data.opening_balance)}</b>
            </article>
            <article>
              <span>Cash received</span>
              <b>{money(data.inflows)}</b>
            </article>
            <article>
              <span>Cash paid</span>
              <b>{money(data.outflows)}</b>
            </article>
            <article>
              <span>Closing cash &amp; bank</span>
              <b>{money(data.closing_balance)}</b>
            </article>
          </div>
          {Number(data.reconciliation_difference) !== 0 && (
            <div className="error" role="alert">
              Cash does not reconcile: {money(data.reconciliation_difference)}. Review the journals
              before using this report.
            </div>
          )}
          <div className="cash-flow-panels">
            <section>
              <h2>{accountId ? "Account receipts and payments" : "Cash-flow statement"}</h2>
              <dl>
                {["operating", "investing", "financing", "unclassified"].map((key) => (
                  <div key={key}>
                    <dt>{activityLabel(key)}</dt>
                    <dd>{money(data[key])}</dd>
                  </div>
                ))}
                <div className="cash-flow-net">
                  <dt>Net change in cash</dt>
                  <dd>{money(data.net_change)}</dd>
                </div>
                <div>
                  <dt>Opening + net change</dt>
                  <dd>{money(Number(data.opening_balance) + Number(data.net_change))}</dd>
                </div>
                <div>
                  <dt>Ledger closing balance</dt>
                  <dd>{money(data.closing_balance)}</dd>
                </div>
              </dl>
            </section>
            <section>
              <h2>Cash &amp; bank accounts</h2>
              <p>
                {accountId ? "This account balance includes transfers received and payments made."
                  : "Balances include internal transfers; the statement excludes transfers between these accounts."}
              </p>
              {data.accounts.length === 0 && (
                <p>No accounts are marked as cash/bank. Set them up in the Chart of Accounts.</p>
              )}
              {data.accounts.map((a: any) => (
                <div className="cash-account-balance" key={a.id}>
                  <span>
                    <b>
                      {displayCode(a)} · {a.name}
                    </b>
                    <small>Opening {money(a.opening)}</small>
                  </span>
                  <strong>{money(a.closing)}</strong>
                </div>
              ))}
            </section>
          </div>
          <div className="finance-toolbar">
            <h2 className="finance-subtitle">Cash movements</h2>
            <label>
              Activity
              <select value={activity} onChange={(event) => setActivity(event.target.value)}>
                <option value="all">All activities</option>
                {["operating", "investing", "financing", "unclassified"].map((key) => (
                  <option key={key} value={key}>
                    {activityLabel(key)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FilteredRecords records={rows} title="cash movements">
            {(filteredRows, filtersActive) => (
              <div className="table-card finance-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date / journal</th>
                      <th>Description / source</th>
                      <th>Classification</th>
                      <th>Cash in</th>
                      <th>Cash out</th>
                      <th>Net change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((m: any) => (
                      <tr key={m.journal_id}>
                        <td>
                          {m.date}
                          <small>{m.number}</small>
                        </td>
                        <td>
                          {m.description}
                          <small>{m.source_type.replace(/_/g, " ")}</small>
                        </td>
                        <td>
                          {m.allocations
                            .filter((a: any) => a.amount !== 0)
                            .map((a: any, i: number) => (
                              <small key={i}>
                                {activityLabel(a.activity)}: {money(a.amount)}
                              </small>
                            ))}
                        </td>
                        <td>{money(m.inflow)}</td>
                        <td>{money(m.outflow)}</td>
                        <td>
                          <b>{money(m.net)}</b>
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={6}>No cash movements match this period or filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </FilteredRecords>
          <details className="finance-transfers">
            <summary>Internal cash/bank transfers ({data.transfers.length})</summary>
            {data.transfers.map((t: any) => (
              <div key={t.journal_id}>
                <span>
                  {t.date} · {t.number} · {t.description}
                </span>
                <b>{money(t.amount)}</b>
              </div>
            ))}
          </details>
          <p className="report-note">
            {data.method} Unclassified amounts stay included in the cash reconciliation; assign
            their counterpart accounts to an activity in the Chart of Accounts. Unpaid invoices and
            draft vouchers do not create cash movements.
          </p>
        </>
      )}
    </>
  );
}
