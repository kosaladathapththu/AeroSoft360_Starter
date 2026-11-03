import FilteredRecords from "./FilteredRecords";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { financeRequest, financeToday, financeMoney as money, financeCsv } from "./finance-utils";
import { matchesSearch } from "./search";
import { printReport } from "./report-print";
import "./sales-returns.css";

type DraftLine = { quantity: number; condition: string; serial_ids: number[] };
export default function SalesReturnsPage({
  api,
  token,
  permissions,
  search,
  initialInvoiceId,
}: {
  api: string;
  token: string;
  permissions: string[];
  search: string;
  initialInvoiceId?: number;
}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [invoiceId, setInvoiceId] = useState(0);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [draft, setDraft] = useState<Record<number, DraftLine>>({});
  const [date, setDate] = useState(financeToday());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const output = useRef<HTMLDivElement>(null);
  const load = useCallback(
    async () => setData(await financeRequest(api, token, "sales-returns")),
    [api, token],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const consumedInvoice = useRef<number>();
  useEffect(() => {
    if (
      !data ||
      !initialInvoiceId ||
      consumedInvoice.current === initialInvoiceId ||
      !permissions.includes("accounting.manage")
    )
      return;
    if (!data.invoices.some((i: any) => Number(i.id) === initialInvoiceId)) return;
    consumedInvoice.current = initialInvoiceId;
    setInvoiceId(initialInvoiceId);
    setCreating(true);
    setRequestKey(
      crypto.randomUUID
        ? crypto.randomUUID()
        : "return-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    );
  }, [data, initialInvoiceId, permissions]);
  const invoice = data?.invoices.find((i: any) => Number(i.id) === invoiceId);
  const lines = invoice?.lines || [];
  const selectedLines = lines.filter((l: any) => (draft[l.id]?.quantity || 0) > 0);
  const credit = (line: any) => {
    const quantity = draft[line.id]?.quantity || 0;
    return (
      (Math.round(
        (line.credit_share_cents * (Number(line.returned_quantity) + quantity)) /
          Number(line.quantity),
      ) -
        Math.round(
          (line.credit_share_cents * Number(line.returned_quantity)) / Number(line.quantity),
        )) /
      100
    );
  };
  const total = selectedLines.reduce((sum: number, l: any) => sum + credit(l), 0);
  const patch = (id: number, values: Partial<DraftLine>) =>
    setDraft((current) => ({
      ...current,
      [id]: {
        ...(current[id] || { quantity: 0, condition: "sellable", serial_ids: [] }),
        ...values,
      },
    }));
  const filtered = (data?.returns || []).filter((r: any) =>
    matchesSearch(
      [
        r.number,
        r.invoice_number,
        r.customer_name,
        r.reason,
        ...r.lines.map((l: any) =>
          [l.article_code, l.article_name, l.size_label, l.colour, l.condition].join(" "),
        ),
      ],
      search,
    ),
  );
  const csv = () =>
    financeCsv("sales-returns.csv", [
      [
        "Return",
        "Date",
        "Invoice",
        "Customer",
        "Article code",
        "Article name",
        "Size",
        "Colour",
        "Pieces",
        "Condition",
        "Credit",
        "Serials",
        "Reason",
      ],
      ...filtered.flatMap((r: any) =>
        r.lines.map((l: any) => [
          r.number,
          r.return_date,
          r.invoice_number,
          r.customer_name,
          l.article_code,
          l.article_name,
          l.size_label,
          l.colour,
          l.quantity,
          l.condition,
          Number(l.total),
          l.serial_numbers.join(", "),
          r.reason,
        ]),
      ),
    ]);
  const post = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await financeRequest(
        api,
        token,
        "sales-returns",
        {
          sales_invoice_id: invoiceId,
          return_date: date,
          reason,
          request_key: requestKey,
          lines: selectedLines.map((l: any) => ({
            sales_invoice_line_id: l.id,
            ...draft[l.id],
          })),
        },
        "POST",
      );
      setCreating(false);
      setNotice(
        "Return " +
          saved.number +
          " posted. Sellable pieces are back in stock and the customer credit is recorded.",
      );
      try {
        await load();
      } catch {
        setError("The return was saved. Refresh to reload the return history.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="heading">
        <div>
          <span>SALES AFTERCARE</span>
          <h1>Sales Returns</h1>
          <p>Return individual pieces against the exact invoice, article, size and colour.</p>
        </div>
        <div className="actions">
          <button className="return-secondary" disabled={!data} onClick={csv}>
            Download return report
          </button>
          {permissions.includes("accounting.manage") && (
            <button
              className="primary"
              onClick={() => {
                setCreating(true);
                setInvoiceId(0);
                setInvoiceSearch("");
                setDraft({});
                setReason("");
                setDate(financeToday());
                setError("");
                setRequestKey(
                  crypto.randomUUID
                    ? crypto.randomUUID()
                    : "return-" + Date.now() + "-" + Math.random().toString(36).slice(2),
                );
              }}
            >
              <Plus /> Record sales return
            </button>
          )}
        </div>
      </div>
      {notice && (
        <div className="workflow-success" role="status">
          <Check /> {notice}
          <button onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}
      {error && !creating && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <p className="report-note">
        Sellable returns increase finished stock. Damaged pieces remain in the return register and
        are excluded from available stock. Credit exceeding the unpaid invoice balance is held for
        the customer; posting a return does not pay a cash refund. Existing earned commissions are
        retained for management review. Opening AR balances have no item details; use an itemized
        invoice to identify returned pieces.
      </p>
      <FilteredRecords records={filtered} title="sales returns">
        {(filteredRows, filtersActive) => (
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  {[
                    "Return",
                    "Invoice / customer",
                    "Date",
                    "Pieces",
                    "Credit",
                    "Reason",
                    "Details",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.number}</b>
                    </td>
                    <td>
                      {r.invoice_number}
                      <br />
                      <small>{r.customer_name}</small>
                    </td>
                    <td>{r.return_date}</td>
                    <td>{r.lines.reduce((sum: number, l: any) => sum + Number(l.quantity), 0)}</td>
                    <td>{money(r.total)}</td>
                    <td>{r.reason}</td>
                    <td>
                      <button className="return-secondary" onClick={() => setDetail(r)}>
                        View return
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredRows.length && (
                  <tr>
                    <td colSpan={7}>
                      {data ? "No matching sales returns." : "Loading returns..."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </FilteredRecords>
      {creating && (
        <div className="backdrop">
          <form
            className="modal sales-return-modal"
            onSubmit={post}
            aria-label="Record sales return"
          >
            <div className="popup-header">
              <span>PIECE BY PIECE RETURN</span>
              <h2>Record sales return</h2>
              <button
                type="button"
                className="close"
                aria-label="Close return"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                <X />
              </button>
            </div>
            <div className="popup-body">
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <label>
                Find the original invoice
                <input
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Search invoice number or customer"
                />
              </label>
              <label>
                Original invoice
                <select
                  value={invoiceId || ""}
                  required
                  onChange={(e) => {
                    setInvoiceId(Number(e.target.value));
                    setDraft({});
                  }}
                >
                  <option value="">Choose invoice</option>
                  {(data?.invoices || [])
                    .filter(
                      (i: any) =>
                        i.id === invoiceId ||
                        matchesSearch([i.number, i.customer_name], invoiceSearch),
                    )
                    .map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.number} - {i.customer_name} - {i.invoice_date}
                      </option>
                    ))}
                </select>
              </label>
              {invoice && (
                <>
                  <div className="return-invoice-summary">
                    <strong>{invoice.customer_name}</strong>
                    <span>
                      {invoice.number} | Invoice date: {invoice.invoice_date}
                    </span>
                    <span>Unpaid balance: {money(invoice.outstanding)}</span>
                  </div>
                  {!lines.length && (
                    <div className="report-note" role="status">
                      This invoice has no article, size or colour lines. Original item details are
                      required to identify returned pieces; no quantities or stock can be inferred
                      from its balance alone.
                    </div>
                  )}
                  <div className="return-item-list">
                    {lines.map((line: any) => (
                      <article
                        key={line.id}
                        className={
                          (draft[line.id]?.quantity || 0) > 0
                            ? "return-item selected"
                            : "return-item"
                        }
                      >
                        <div>
                          <strong>
                            {line.article_code} - {line.article_name}
                          </strong>
                          <p>
                            Size {line.size_label} | Colour: {line.colour || "Not specified"}
                          </p>
                          <small>
                            Sold: {line.quantity} pcs | Already returned: {line.returned_quantity} |
                            Available to return: {line.remaining_quantity}
                          </small>
                        </div>
                        <div className="return-item-controls">
                          <label>
                            Return pieces
                            <input
                              type="number"
                              min={0}
                              max={Math.floor(Number(line.remaining_quantity))}
                              step={1}
                              value={draft[line.id]?.quantity || 0}
                              onChange={(e) =>
                                patch(line.id, {
                                  quantity: Number(e.target.value),
                                  serial_ids: [],
                                })
                              }
                            />
                          </label>
                          <label>
                            Condition
                            <select
                              value={draft[line.id]?.condition || "sellable"}
                              onChange={(e) =>
                                patch(line.id, {
                                  condition: e.target.value,
                                })
                              }
                            >
                              <option value="sellable">Sellable - add to stock</option>
                              <option value="damaged">Damaged - hold separately</option>
                            </select>
                          </label>
                          <span>
                            Credit: <b>{money(credit(line))}</b>
                          </span>
                        </div>
                        {(draft[line.id]?.quantity || 0) > 0 && line.serials.length > 0 && (
                          <fieldset className="return-serials">
                            <legend>Identify each returned serial</legend>
                            {line.serials.map((serial: any) => (
                              <label key={serial.id}>
                                <input
                                  type="checkbox"
                                  checked={
                                    draft[line.id]?.serial_ids.includes(Number(serial.id)) || false
                                  }
                                  onChange={(e) =>
                                    patch(line.id, {
                                      serial_ids: e.target.checked
                                        ? [...(draft[line.id]?.serial_ids || []), Number(serial.id)]
                                        : (draft[line.id]?.serial_ids || []).filter(
                                            (id) => id !== Number(serial.id),
                                          ),
                                    })
                                  }
                                />
                                {serial.serial_number}
                              </label>
                            ))}
                          </fieldset>
                        )}
                      </article>
                    ))}
                  </div>
                  <p className="report-note">
                    Enter only the pieces physically received. Credit uses the original selling rate
                    and a proportional share of the original invoice discount, charges and tax.
                  </p>
                </>
              )}
              <div className="form-row">
                <label>
                  Return date
                  <input
                    type="date"
                    required
                    min={invoice?.invoice_date}
                    max={financeToday()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label>
                  Reason for return
                  <textarea
                    required
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe why these pieces were returned"
                  />
                </label>
              </div>
              <div className="return-totals">
                <strong>
                  {selectedLines.reduce((sum: number, l: any) => sum + draft[l.id].quantity, 0)}{" "}
                  pieces selected
                </strong>
                <strong>Credit {money(total)}</strong>
                {invoice && total > Number(invoice.outstanding) && (
                  <span>
                    Customer credit to retain: {money(total - Number(invoice.outstanding))}. No cash
                    refund is posted.
                  </span>
                )}
              </div>
            </div>
            <div className="popup-footer">
              <button
                type="button"
                className="return-secondary"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy || !selectedLines.length}>
                {busy ? "Posting return..." : "Post return and update stock"}
              </button>
            </div>
          </form>
        </div>
      )}
      {detail && (
        <div className="backdrop">
          <section
            className="modal sales-return-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Sales return details"
          >
            <div className="popup-header">
              <h2>{detail.number}</h2>
              <button
                className="close"
                aria-label="Close return details"
                onClick={() => setDetail(null)}
              >
                <X />
              </button>
            </div>
            <div className="popup-body" ref={output}>
              <h2>Sales return / credit note {detail.number}</h2>
              <p>
                Customer: {detail.customer_name}
                <br />
                Original invoice: {detail.invoice_number}
                <br />
                Returned on: {detail.return_date}
                <br />
                Reason: {detail.reason}
              </p>
              <table>
                <thead>
                  <tr>
                    {[
                      "Article",
                      "Size / colour",
                      "Pieces",
                      "Condition",
                      "Serial numbers",
                      "Credit",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l: any) => (
                    <tr key={l.id}>
                      <td>
                        {l.article_code}
                        <br />
                        {l.article_name}
                      </td>
                      <td>
                        {l.size_label} / {l.colour || "Not specified"}
                      </td>
                      <td>{l.quantity}</td>
                      <td>{l.condition === "sellable" ? "Restocked" : "Damaged - held"}</td>
                      <td>{l.serial_numbers.join(", ") || "Not serialized"}</td>
                      <td>{money(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                <b>Total credit: {money(detail.total)}</b> (including tax {money(detail.tax)})
              </p>
              <p>
                Sellable pieces are posted to finished-goods stock. Damaged pieces are held
                separately. This document is a credit record, not a cash refund receipt.
              </p>
            </div>
            <div className="popup-footer">
              <button className="return-secondary" onClick={() => setDetail(null)}>
                Close
              </button>
              <button
                className="primary"
                onClick={() =>
                  output.current &&
                  printReport({
                    key: "sales_return",
                    title: "Sales return " + detail.number,
                    group: "Customer returns",
                    from: detail.return_date,
                    to: detail.return_date,
                    source: output.current,
                  })
                }
              >
                Print / Save PDF
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
