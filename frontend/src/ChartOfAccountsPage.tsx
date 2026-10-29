import { useCallback, useEffect, useState } from "react";
import { Check, Eye, FileDown, Loader2, Pencil, Plus, RefreshCw, X } from "lucide-react";
import {
  activityLabel,
  financeCsv,
  financeMoney as money,
  financeRequest,
  financeToday,
} from "./finance-utils";
import "./finance-management.css";
import AccountOpeningModal from "./AccountOpeningModal";

export default function ChartOfAccountsPage({
  api,
  token,
  canManage,
  search,
  onChanged,
}: {
  api: string;
  token: string;
  canManage: boolean;
  search: string;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(financeToday());
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [type, setType] = useState("all");
  const [editor, setEditor] = useState<any>(undefined);
  const [ledger, setLedger] = useState<any>(null);
  const [opening, setOpening] = useState(false);
  const load = useCallback(async () => {
    const result = await financeRequest(api, token, `accounts?as_of=${date}`);
    setData(result);
    setError("");
  }, [api, token, date]);
  useEffect(() => {
    if (date) load().catch((err) => setError(err.message));
  }, [load, date]);
  const rows = (data?.accounts || []).filter(
    (a: any) =>
      (type === "all" || (type === "cash" ? a.is_cash_account : a.type === type)) &&
      `${a.code} ${a.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="heading">
        <div>
          <span>FINANCE FOUNDATION</span>
          <h1>Chart of Accounts</h1>
          <p>Manage ledger accounts, cash/bank accounts and cash-flow classifications.</p>
        </div>
        {canManage && (
          <div className="report-downloads">
          <button onClick={() => setOpening(true)} disabled={!data}>Opening balances</button>
          <button className="primary" onClick={() => setEditor(null)}>
            <Plus /> New account
          </button>
          </div>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="finance-toolbar">
        <label>
          Balances as of
          <input
            type="date"
            value={date}
            required
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Account group
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {["all", "cash", "asset", "liability", "equity", "income", "expense"].map((value) => (
              <option key={value} value={value}>
                {value === "all"
                  ? "All accounts"
                  : value === "cash"
                    ? "Cash & bank"
                    : value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-action"
          onClick={() => load().catch((err) => setError(err.message))}
        >
          <RefreshCw /> Refresh
        </button>
        <button
          className="secondary-action"
          disabled={!data || data.as_of !== date}
          onClick={() =>
            financeCsv(`Chart_of_Accounts_${date}.csv`, [
              [
                "Code",
                "Account",
                "Type",
                "Cash / bank",
                "Cash flow",
                "Active",
                "Debit",
                "Credit",
                "Normal-side balance",
              ],
              ...rows.map((a: any) => [
                a.code,
                a.name,
                a.type,
                a.is_cash_account ? "Yes" : "No",
                a.cash_flow_activity,
                a.is_active ? "Yes" : "No",
                Number(a.debit),
                Number(a.credit),
                Number(a.balance),
              ]),
            ])
          }
        >
          <FileDown /> Download accounts
        </button>
      </div>
      {!data ? (
        <div className="loading">
          <Loader2 /> Loading accounts…
        </div>
      ) : (
        <div className="table-card finance-table">
          <table>
            <thead>
              <tr>
                <th>Code / account</th>
                <th>Type</th>
                <th>Role</th>
                <th>Cash flow</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>No accounts match your search.</td>
                </tr>
              ) : (
                rows.map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <b>{a.code}</b>
                      <small>{a.name}</small>
                    </td>
                    <td className="finance-capitalize">{a.type}</td>
                    <td>
                      {a.is_cash_account
                        ? "Cash / bank"
                        : a.is_postable
                          ? "Posting account"
                          : "Group account"}
                      {!!a.is_system && <small>System account</small>}
                    </td>
                    <td>
                      {a.is_cash_account ? "Cash balance" : activityLabel(a.cash_flow_activity)}
                    </td>
                    <td>
                      <b>{money(a.balance)}</b>
                      <small>
                        {["liability", "equity", "income"].includes(a.type) ? "Credit" : "Debit"}{" "}
                        normal side
                      </small>
                    </td>
                    <td>
                      <span className={`status ${a.is_active ? "posted" : "void"}`}>
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-action view"
                          title="View account ledger"
                          aria-label={`Ledger for ${a.code}`}
                          onClick={() => setLedger(a)}
                        >
                          <Eye />
                        </button>
                        {canManage && (
                          <button
                            className="icon-action edit"
                            aria-label={`Edit account ${a.code}`}
                            onClick={() => setEditor(a)}
                          >
                            <Pencil />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="report-note">
        Balances come from posted journals through the selected date. Positive balances follow each
        account’s normal debit or credit side. Existing transactions are preserved when an account
        is made inactive.
      </p>
      {editor !== undefined && (
        <AccountEditor
          account={editor}
          close={() => setEditor(undefined)}
          save={async (body) => {
            await financeRequest(
              api,
              token,
              editor ? `accounts/${editor.id}` : "accounts",
              body,
              editor ? "PUT" : "POST",
            );
            await load();
            onChanged();
            setEditor(undefined);
          }}
        />
      )}
      {opening && <AccountOpeningModal accounts={(data?.accounts || []).filter((a:any)=>a.is_active && a.is_postable && ['asset','liability','equity'].includes(a.type) && !['1100','2100','3990'].includes(a.code))} close={()=>setOpening(false)} save={async(id,body)=>{await financeRequest(api,token,`accounts/${id}/opening-balance`,body,'POST');await load();onChanged();setOpening(false);}} />}
      {ledger && (
        <AccountLedger
          api={api}
          token={token}
          account={ledger}
          date={date}
          close={() => setLedger(null)}
        />
      )}
    </>
  );
}

function AccountEditor({
  account: a,
  close,
  save,
}: {
  account: any;
  close: () => void;
  save: (body: any) => Promise<void>;
}) {
  const [type, setType] = useState(a?.type || "expense");
  const [cash, setCash] = useState(Boolean(a?.is_cash_account));
  const [postable, setPostable] = useState(a ? Boolean(a.is_postable) : true);
  const [active, setActive] = useState(a ? Boolean(a.is_active) : true);
  const [activity, setActivity] = useState(a?.cash_flow_activity || "operating");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = Boolean(a?.is_system || a?.has_transactions);
  return (
    <div
      className="backdrop"
      onMouseDown={() => {
        if (!busy) close();
      }}
    >
      <form
        className="modal finance-account-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          try {
            await save({
              code: locked ? a.code : form.get("code"),
              name: form.get("name"),
              type,
              is_cash_account: cash,
              is_postable: postable,
              is_active: active,
              cash_flow_activity: activity,
              description: form.get("description"),
              reason: form.get("reason"),
            });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="popup-header">
          <button
            type="button"
            className="close"
            disabled={busy}
            aria-label="Close account"
            onClick={close}
          >
            <X />
          </button>
          <span>CHART OF ACCOUNTS</span>
          <h2 id="account-editor-title">{a ? `Edit ${a.code}` : "New account"}</h2>
        </div>
        <div className="popup-body">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <fieldset className="finance-fields" disabled={busy}>
            <div className="form-row">
              <label>
                Account code
                <input
                  name="code"
                  maxLength={20}
                  pattern="[A-Za-z0-9_-]+"
                  defaultValue={a?.code}
                  required
                  disabled={locked}
                  placeholder="e.g. 1010 or 5410"
                />
              </label>
              <label>
                Account type
                <select
                  value={type}
                  disabled={locked}
                  onChange={(event) => {
                    setType(event.target.value);
                    setCash(false);
                    setActivity(
                      ["income", "expense"].includes(event.target.value)
                        ? "operating"
                        : "unclassified",
                    );
                  }}
                >
                  {["asset", "liability", "equity", "income", "expense"].map((value) => (
                    <option key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Account name
              <input
                name="name"
                defaultValue={a?.name}
                maxLength={255}
                required
                placeholder="e.g. Main bank account or Office rent"
              />
            </label>
            <div className="finance-checks">
              <label>
                <input
                  type="checkbox"
                  checked={postable}
                  disabled={locked}
                  onChange={(event) => {
                    setPostable(event.target.checked);
                    if (!event.target.checked) setCash(false);
                  }}
                />{" "}
                Allow journal posting
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={cash}
                  disabled={locked || type !== "asset" || !postable}
                  onChange={(event) => setCash(event.target.checked)}
                />{" "}
                Cash / bank account
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={active}
                  disabled={a?.is_system}
                  onChange={(event) => setActive(event.target.checked)}
                />{" "}
                Active
              </label>
            </div>
            <label>
              Cash-flow activity
              <select
                value={activity}
                onChange={(event) => setActivity(event.target.value)}
                disabled={cash}
              >
                {["operating", "investing", "financing", "unclassified"].map((value) => (
                  <option key={value} value={value}>
                    {activityLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <p className="report-note">
              Cash/bank accounts are the money sources used by collections and payment vouchers.
              Other accounts classify their cash movements. For example, equipment purchases are
              investing and loans are financing.
            </p>
            <label>
              Description <small>Optional</small>
              <input name="description" maxLength={500} defaultValue={a?.description} />
            </label>
            {a && (
              <label>
                Reason for change
                <input
                  name="reason"
                  maxLength={500}
                  required
                  pattern=".*\S.*"
                  placeholder="Explain this account change"
                />
              </label>
            )}
            {locked && (
              <p className="report-note">
                Structural fields are locked for system accounts and accounts with transactions.
              </p>
            )}
          </fieldset>
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" disabled={busy} onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? <Loader2 /> : <Check />} Save account
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AccountLedger({
  api,
  token,
  account,
  date,
  close,
}: {
  api: string;
  token: string;
  account: any;
  date: string;
  close: () => void;
}) {
  const [from, setFrom] = useState(date.slice(0, 7) + "-01");
  const [to, setTo] = useState(date);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setData(null);
    if (from && to && from <= to)
      financeRequest(api, token, `accounts/${account.id}/ledger?from=${from}&to=${to}`)
        .then((result) => {
          setData(result);
          setError("");
        })
        .catch((err) => setError(err.message));
  }, [api, token, account.id, from, to]);
  return (
    <div className="backdrop" onMouseDown={close}>
      <section
        className="modal finance-ledger-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-ledger-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="popup-header">
          <button className="close" onClick={close} aria-label="Close ledger">
            <X />
          </button>
          <span>POSTED ACCOUNT LEDGER</span>
          <h2 id="account-ledger-title">
            {account.code} · {account.name}
          </h2>
        </div>
        <div className="popup-body">
          <div className="finance-toolbar">
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
          </div>
          {error && <div className="error">{error}</div>}
          {data && (
            <>
              <div className="finance-balance-pair">
                <span>
                  Opening <b>{money(data.opening)}</b>
                </span>
                <span>
                  Closing <b>{money(data.closing)}</b>
                </span>
              </div>
              <div className="table-card finance-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date / journal</th>
                      <th>Description</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Running balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((line: any) => (
                      <tr key={line.id}>
                        <td>
                          {line.posting_date}
                          <small>{line.number}</small>
                        </td>
                        <td>{line.description || line.journal_description}</td>
                        <td>{money(line.debit)}</td>
                        <td>{money(line.credit)}</td>
                        <td>{money(line.running_balance)}</td>
                      </tr>
                    ))}
                    {!data.lines.length && (
                      <tr>
                        <td colSpan={5}>No posted movements in this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="report-note">{data.balance_basis}</p>
            </>
          )}
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button onClick={close}>Close</button>
            <button
              disabled={!data}
              className="primary"
              onClick={() =>
                financeCsv(`Ledger_${account.code}_${to}.csv`, [
                  [
                    "Date",
                    "Journal",
                    "Description",
                    "Debit",
                    "Credit",
                    "Running debit-minus-credit balance",
                  ],
                  [from, "Opening", "", "", "", data.opening],
                  ...data.lines.map((l: any) => [
                    l.posting_date,
                    l.number,
                    l.description,
                    Number(l.debit),
                    Number(l.credit),
                    l.running_balance,
                  ]),
                ])
              }
            >
              <FileDown /> Download ledger
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
