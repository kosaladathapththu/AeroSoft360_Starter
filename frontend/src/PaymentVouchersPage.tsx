import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import "./invoice-bill.css";
import "./payment-vouchers.css";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
const money = (value: unknown) =>
  `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const totalOf = (lines: any[]) =>
  lines.reduce((sum, line) => sum + Math.round(Number(line.amount || 0) * 100) / 100, 0);

export default function PaymentVouchersPage({
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
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<any>(undefined);
  const [view, setView] = useState<any>(null);
  const [cancelling, setCancelling] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const load = useCallback(async () => {
    const response = await fetch(`${api}/payment-vouchers`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to load payment vouchers.");
    setData(result);
    return result;
  }, [api, token]);
  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);
  const mutate = async (path: string, body: any, method = "POST") => {
    const response = await fetch(`${api}/payment-vouchers${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        Object.values(result.errors || {})
          .flat()
          .join(" ") ||
          result.message ||
          "Unable to save payment voucher.",
      );
    const next = await load();
    onChanged();
    return next.vouchers.find((v: any) => Number(v.id) === Number(result.id));
  };
  const post = async (voucher: any) => {
    setBusy(true);
    setError("");
    try {
      setView(await mutate(`/${voucher.id}/post`, {}));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <>
        {error ? (
          <div className="error" role="alert">
            {error}
            <button
              type="button"
              onClick={() => {
                setError("");
                load().catch((err) => setError(err.message));
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="loading">
            <Loader2 /> Loading payment vouchers…
          </div>
        )}
      </>
    );
  const rows = data.vouchers.filter(
    (v: any) =>
      (filter === "all" || v.status === filter) &&
      `${v.number} ${v.payee} ${v.reference || ""} ${v.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="heading">
        <div>
          <span>FINANCE &amp; REPORTS</span>
          <h1>Payment Vouchers</h1>
          <p>
            Record outgoing payments, settle supplier receipts and keep a signed payment record.
          </p>
        </div>
        {canManage && (
          <button
            className="primary"
            onClick={() => {
              setError("");
              setEditor(null);
            }}
          >
            <Plus /> New payment voucher
          </button>
        )}
      </div>
      {error && !view && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="voucher-summary">
        <article>
          <span>Drafts to review</span>
          <b>{data.vouchers.filter((v: any) => v.status === "draft").length}</b>
        </article>
        <article>
          <span>Total posted payments</span>
          <b>
            {money(
              totalOf(
                data.vouchers
                  .filter((v: any) => v.status === "posted")
                  .map((v: any) => ({ amount: v.total })),
              ),
            )}
          </b>
        </article>
        <article>
          <span>Cancelled vouchers</span>
          <b>{data.vouchers.filter((v: any) => v.status === "void").length}</b>
        </article>
      </div>
      <div className="voucher-toolbar">
        <label>
          Status
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All vouchers</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="void">Cancelled</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary-action"
          onClick={() => load().catch((err) => setError(err.message))}
        >
          <RefreshCw /> Refresh
        </button>
      </div>
      <div className="table-card voucher-table">
        <table>
          <thead>
            <tr>
              <th>Voucher</th>
              <th>Date</th>
              <th>Payee / purpose</th>
              <th>Paid from</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty">
                    <FileText />
                    <b>No payment vouchers found</b>
                    <span>
                      {canManage
                        ? "Create a draft voucher to get started."
                        : "Vouchers will appear here when recorded."}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((v: any) => (
                <tr key={v.id}>
                  <td>
                    <b>{v.number}</b>
                    <small>
                      {v.kind === "supplier" ? `Supplier · ${v.receipt_number}` : "Expense payment"}
                    </small>
                  </td>
                  <td>{v.payment_date}</td>
                  <td>
                    <b>{v.payee}</b>
                    <small>{v.description}</small>
                  </td>
                  <td>
                    {v.payment_account_name}
                    <small>{v.payment_method.replace(/_/g, " ")}</small>
                  </td>
                  <td>
                    <b>{money(v.total)}</b>
                  </td>
                  <td>
                    <span className={`status ${v.status}`}>
                      {v.status === "void" ? "Cancelled" : v.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-action view"
                        aria-label={`View or print ${v.number}`}
                        title="View / print voucher"
                        onClick={() => {
                          setView(v);
                          setError("");
                        }}
                      >
                        <Eye />
                      </button>
                      {canManage && v.status === "draft" && (
                        <button
                          type="button"
                          className="icon-action edit"
                          aria-label={`Edit ${v.number}`}
                          onClick={() => setEditor(v)}
                        >
                          <Pencil />
                        </button>
                      )}
                      {canManage && v.status !== "void" && (
                        <button
                          type="button"
                          className="icon-action delete"
                          aria-label={`Cancel ${v.number}`}
                          onClick={() => setCancelling(v)}
                        >
                          <X />
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
      {editor !== undefined && (
        <VoucherEditor
          data={data}
          voucher={editor}
          close={() => setEditor(undefined)}
          save={async (body) => {
            const voucher = await mutate(
              editor ? `/${editor.id}` : "",
              body,
              editor ? "PUT" : "POST",
            );
            setEditor(undefined);
            setView(voucher);
            setError("");
          }}
        />
      )}
      {view && (
        <VoucherDocument
          voucher={view}
          busy={busy}
          error={error}
          canManage={canManage}
          close={() => {
            if (!busy) {
              setView(null);
              setError("");
            }
          }}
          post={() => post(view)}
        />
      )}
      {cancelling && (
        <CancelVoucher
          voucher={cancelling}
          close={() => setCancelling(null)}
          save={async (body) => {
            const updated = await mutate(`/${cancelling.id}/cancel`, body);
            setCancelling(null);
            if (view?.id === updated.id) setView(updated);
          }}
        />
      )}
    </>
  );
}

function VoucherEditor({
  data,
  voucher,
  close,
  save,
}: {
  data: any;
  voucher: any;
  close: () => void;
  save: (body: any) => Promise<void>;
}) {
  const [kind, setKind] = useState(voucher?.kind || "expense");
  const [receiptId, setReceiptId] = useState(voucher?.goods_receipt_id || "");
  const [lines, setLines] = useState<any[]>(
    voucher?.lines?.length
      ? voucher.lines.map((line: any) => ({ ...line }))
      : [{ account_id: data.expense_accounts[0]?.id || "", description: "", amount: "" }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const receipt = data.receipts.find((r: any) => Number(r.id) === Number(receiptId));
  const total = kind === "supplier" ? Number(lines[0]?.amount || 0) : totalOf(lines);
  return (
    <div
      className="backdrop"
      onMouseDown={() => {
        if (!busy) close();
      }}
    >
      <form
        className="modal voucher-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await save({
              kind,
              payee: kind === "supplier" ? receipt?.supplier_name : form.get("payee"),
              goods_receipt_id: kind === "supplier" ? Number(receiptId) : null,
              payment_date: form.get("payment_date"),
              payment_method: form.get("payment_method"),
              payment_account_id: Number(form.get("payment_account_id")),
              reference: form.get("reference"),
              description: form.get("description"),
              reason: form.get("reason"),
              lines: (kind === "supplier" ? [lines[0]] : lines).map((line) => ({
                account_id: kind === "supplier" ? null : Number(line.account_id),
                description:
                  kind === "supplier" ? `Payment against ${receipt?.number}` : line.description,
                amount: line.amount,
              })),
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
            aria-label="Close voucher"
            onClick={close}
          >
            <X />
          </button>
          <span>OUTGOING PAYMENTS</span>
          <h2 id="voucher-editor-title">
            {voucher ? `Edit ${voucher.number}` : "New payment voucher"}
          </h2>
        </div>
        <div className="popup-body">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <fieldset disabled={busy} className="voucher-fields">
            <section className="collection-section">
              <h3>1. Payment details</h3>
              <div className="form-row">
                <label>
                  Payment for
                  <select
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value);
                      setLines([
                        {
                          account_id: data.expense_accounts[0]?.id || "",
                          description: "",
                          amount: "",
                        },
                      ]);
                    }}
                  >
                    <option value="expense">Expense payment</option>
                    <option value="supplier">Supplier payment</option>
                  </select>
                </label>
                <label>
                  Payment date
                  <input
                    name="payment_date"
                    type="date"
                    defaultValue={voucher?.payment_date || today()}
                    required
                  />
                </label>
              </div>
              {kind === "supplier" ? (
                <>
                  <label>
                    Supplier receipt
                    <select
                      value={receiptId}
                      required
                      onChange={(event) => {
                        setReceiptId(event.target.value);
                        setLines((current) => [{ ...current[0], amount: "" }]);
                      }}
                    >
                      <option value="">Choose supplier and receipt</option>
                      {data.receipts
                        .filter(
                          (r: any) =>
                            Number(r.outstanding) > 0 || Number(r.id) === Number(receiptId),
                        )
                        .map((r: any) => (
                          <option key={r.id} value={r.id}>
                            {r.supplier_name} · {r.number} · {money(r.outstanding)}
                          </option>
                        ))}
                    </select>
                  </label>
                  {receipt && (
                    <p className="report-note">
                      {receipt.supplier_name} · {receipt.supplier_invoice || receipt.number} ·
                      Balance: <b>{money(receipt.outstanding)}</b>
                    </p>
                  )}
                </>
              ) : (
                <label>
                  Payee
                  <input
                    name="payee"
                    defaultValue={voucher?.payee}
                    maxLength={160}
                    placeholder="Person or company receiving the payment"
                    required
                  />
                </label>
              )}
              <label>
                Payment purpose
                <input
                  name="description"
                  defaultValue={voucher?.description}
                  maxLength={500}
                  placeholder="e.g. Delivery charges or supplier settlement"
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  Pay from
                  <select
                    name="payment_account_id"
                    defaultValue={voucher?.payment_account_id || data.payment_accounts[0]?.id || ""}
                    required
                  >
                    <option value="" disabled>
                      Choose cash / bank account
                    </option>
                    {data.payment_accounts.map((account: any) => (
                      <option value={account.id} key={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Payment method
                  <select name="payment_method" defaultValue={voucher?.payment_method || "cash"}>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                  </select>
                </label>
              </div>
              <label>
                Reference <small>Optional</small>
                <input
                  name="reference"
                  maxLength={100}
                  defaultValue={voucher?.reference}
                  placeholder="Cheque number, bank reference or supporting document"
                />
              </label>
            </section>
            <section className="collection-section">
              <h3>2. Amount &amp; allocation</h3>
              {(kind === "supplier" ? [lines[0]] : lines).map((line, index) => (
                <div className="voucher-line" key={index}>
                  {kind === "expense" && (
                    <>
                      <label>
                        Expense account
                        <select
                          value={line.account_id}
                          required
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, account_id: event.target.value } : item,
                              ),
                            )
                          }
                        >
                          <option value="">Choose account</option>
                          {data.expense_accounts.map((account: any) => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Description
                        <input
                          value={line.description}
                          maxLength={255}
                          required
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, description: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                  <label>
                    Amount (LKR)
                    <input
                      type="number"
                      min="0.01"
                      max={kind === "supplier" ? Number(receipt?.outstanding || 0) : 999999999999}
                      step="0.01"
                      value={line.amount}
                      required
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, amount: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  {kind === "expense" && lines.length > 1 && (
                    <button
                      type="button"
                      className="icon-action delete"
                      aria-label={`Remove payment line ${index + 1}`}
                      onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 />
                    </button>
                  )}
                </div>
              ))}
              {kind === "expense" && (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() =>
                    setLines((current) => [
                      ...current,
                      {
                        account_id: data.expense_accounts[0]?.id || "",
                        description: "",
                        amount: "",
                      },
                    ])
                  }
                >
                  <Plus /> Add expense line
                </button>
              )}
            </section>
            {voucher && (
              <label>
                Reason for editing
                <input
                  name="reason"
                  required
                  pattern=".*\S.*"
                  maxLength={500}
                  placeholder="Explain this change"
                />
              </label>
            )}
            <p className="report-note">
              Save a draft first. Review and post it to update the ledger and supplier balance.
            </p>
          </fieldset>
        </div>
        <div className="popup-footer">
          <div className="actions">
            <div className="easy-order-footer-total">
              <small>Voucher total</small>
              <strong>{money(total)}</strong>
            </div>
            <button type="button" disabled={busy} onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy || total <= 0}>
              {busy ? <Loader2 /> : <Check />} Save draft
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function VoucherPaper({ voucher: v }: { voucher: any }) {
  return (
    <article className="bill-document">
      <div className="bill-brand">
        <div>
          <span>SUPUN AEROSOFT (PVT) LTD</span>
          <p>Payment voucher · {v.status === "void" ? "CANCELLED" : v.status.toUpperCase()}</p>
        </div>
        <div>
          <h1>PAYMENT VOUCHER</h1>
          <strong>{v.number}</strong>
        </div>
      </div>
      <div className="bill-parties">
        <div>
          <small>PAY TO</small>
          <h2>{v.payee}</h2>
          <p>{v.description}</p>
          {v.receipt_number && (
            <p>
              Supplier receipt: {v.receipt_number}
              <br />
              Supplier invoice: {v.supplier_invoice || "—"}
            </p>
          )}
        </div>
        <dl>
          <div>
            <dt>Date</dt>
            <dd>{v.payment_date}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{v.payment_method.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt>Paid from</dt>
            <dd>{v.payment_account_name}</dd>
          </div>
          {v.reference && (
            <div>
              <dt>Reference</dt>
              <dd>{v.reference}</dd>
            </div>
          )}
          {v.journal_number && (
            <div>
              <dt>Journal</dt>
              <dd>{v.journal_number}</dd>
            </div>
          )}
        </dl>
      </div>
      <table className="bill-items voucher-print-lines">
        <thead>
          <tr>
            <th>Description</th>
            <th>Account</th>
            <th>Amount (LKR)</th>
          </tr>
        </thead>
        <tbody>
          {v.lines.map((line: any) => (
            <tr key={line.id}>
              <td>{line.description}</td>
              <td>
                {line.account_code} - {line.account_name}
              </td>
              <td>{money(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bill-summary">
        <div className="bill-note">
          {v.status === "draft"
            ? "DRAFT — not posted to the ledger."
            : v.status === "void"
              ? `CANCELLED on ${v.void_date}. Reason: ${v.void_reason}`
              : "Posted payment voucher."}
        </div>
        <dl>
          <div className="bill-total">
            <dt>Total payment</dt>
            <dd>{money(v.total)}</dd>
          </div>
        </dl>
      </div>
      <div className="bill-signatures">
        <span>Prepared by</span>
        <span>Authorized by</span>
        <span>Received by / signature</span>
      </div>
    </article>
  );
}

function VoucherDocument({
  voucher: v,
  close,
  post,
  canManage,
  busy,
  error,
}: {
  voucher: any;
  close: () => void;
  post: () => void;
  canManage: boolean;
  busy: boolean;
  error: string;
}) {
  return createPortal(
    <div className="backdrop invoice-bill-overlay" onMouseDown={close}>
      <section
        className="modal invoice-bill-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-view-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="popup-header">
          <button className="close" disabled={busy} onClick={close} aria-label="Close voucher">
            <X />
          </button>
          <span>PAYMENT RECORD</span>
          <h2 id="voucher-view-title">{v.number}</h2>
        </div>
        <div className="popup-body bill-preview">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <VoucherPaper voucher={v} />
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button disabled={busy} onClick={close}>
              Close
            </button>
            <button type="button" disabled={busy} onClick={() => window.print()}>
              <Printer /> Print / Save PDF
            </button>
            {canManage && v.status === "draft" && (
              <button className="primary" disabled={busy} onClick={post}>
                {busy ? <Loader2 /> : <Check />} Post payment
              </button>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function CancelVoucher({
  voucher,
  close,
  save,
}: {
  voucher: any;
  close: () => void;
  save: (body: any) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return createPortal(
    <div className="backdrop voucher-cancel-overlay">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-voucher-title"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          try {
            await save({ reason: String(form.get("reason") || "").trim(), date: form.get("date") });
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
            onClick={close}
            aria-label="Close cancellation"
          >
            <X />
          </button>
          <span>CANCEL PAYMENT VOUCHER</span>
          <h2 id="cancel-voucher-title">Cancel {voucher.number}</h2>
        </div>
        <div className="popup-body">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <p>
            {voucher.status === "posted"
              ? "This creates a reversal journal and restores the supplier balance where applicable."
              : "This cancels the draft without posting a journal."}
          </p>
          <label>
            Cancellation date
            <input
              name="date"
              type="date"
              min={voucher.payment_date}
              defaultValue={today() < voucher.payment_date ? voucher.payment_date : today()}
              required
            />
          </label>
          <label>
            Reason
            <input
              name="reason"
              required
              pattern=".*\S.*"
              maxLength={500}
              placeholder="Explain why this voucher is being cancelled"
            />
          </label>
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" disabled={busy} onClick={close}>
              Keep voucher
            </button>
            <button className="primary" disabled={busy}>
              {busy ? <Loader2 /> : <X />} Cancel voucher
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
