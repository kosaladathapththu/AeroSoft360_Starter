import { stockAvailability } from "./stock-availability";
import { displayCode } from "./representative-reference";
import FilteredRecords from "./FilteredRecords";
import { matchesSearch } from "./search";
import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  RefreshCw,
  ShoppingBag,
  Package,
  Trash2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import {
  financeMoney as money,
  financeRequest,
  financeToday as today,
} from "./finance-utils";
import { SimpleForm } from "./BusinessWorkflowsPage";
import InvoiceBill from "./InvoiceBill";
import "./point-of-sale.css";

export default function PointOfSalePage({
  api,
  token,
  user,
  canManage,
  search,
  go,
}: {
  api: string;
  token: string;
  user: any;
  canManage: boolean;
  search: string;
  go: (page: string) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [cart, setCart] = useState<any[]>([]),
    [discount, setDiscount] = useState(0),
    [busy, setBusy] = useState(false),
    [bill, setBill] = useState<number | null>(null),
    [completedInvoice, setCompletedInvoice] = useState<number | null>(null),
    [key, setKey] = useState(crypto.randomUUID());
  const load = useCallback(
    async () => setData(await financeRequest(api, token, "point-of-sale")),
    [api, token],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const total =
    Math.round(
      (cart.reduce(
        (sum, line) => sum + line.quantity * Number(line.unit_price),
        0,
      ) -
        discount) *
        100,
    ) / 100;
  const subtotal = cart.reduce(
    (sum, line) => sum + line.quantity * Number(line.unit_price),
    0,
  );
  const pieces = cart.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <div className="pos-page">
      <div className="heading pos-heading">
        <div>
          <span>COUNTER SALES</span>
          <h1>Point of Sale</h1>
          <p>Choose articles, review your basket and collect payment.</p>
        </div>
        <button
          disabled={busy}
          onClick={() => load().catch((e) => setError(e.message))}
        >
          <RefreshCw /> Refresh products
        </button>
      </div>
      <div className="workflow-links pos-links">
        {[
          "Customers",
          "Invoices",
          "Collections",
          "Cashier Closing",
          "Serials & Warranty",
        ].map((name) => (
          <button key={name} onClick={() => go(name)}>
            {name} <ArrowRight size={14} />
          </button>
        ))}
      </div>
      {completedInvoice && (
        <div className="pos-success" role="status">
          <CheckCircle2 />
          <div>
            <b>Sale completed successfully</b>
            <span>The invoice and payment have been recorded.</span>
          </div>
          <button onClick={() => setBill(completedInvoice)}>
            View receipt
          </button>
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {!data ? (
        <p>{error ? "Use Refresh to retry." : "Loading point of sale..."}</p>
      ) : !canManage ? (
        <p>
          This profile can view sales through Invoices and Collections. Checkout
          requires accounting access.
        </p>
      ) : (
        <div className="workflow-pos-grid pos-layout">
          <section className="pos-catalog">
            <div className="pos-section-heading">
              <div>
                <span className="pos-step">01 / SELECT ARTICLES</span>
                <h2>
                  <Package /> Products &amp; sizes
                </h2>
              </div>
              <span className="pos-count">{data.items.length} variants</span>
            </div>
            <FilteredRecords
              records={data.items
                .map((item: any) => {
                  const quantity = Number(
                    stockAvailability(data.stock, item.article_id, item.size_label, item.colour || ""),
                  );
                  return {
                    ...item,
                    available_quantity: quantity,
                    availability: quantity > 0 ? "In stock" : "Out of stock",
                  };
                })
                .filter((item: any) => matchesSearch(item, search))}
              title="products"
            >
              {(filteredRows) => (
                <div className="pos-product-grid">
                  {!filteredRows.length && (
                    <p className="pos-empty-results">
                      No articles match your search. Try another name, code or
                      size.
                    </p>
                  )}
                  {filteredRows.map((item: any) => {
                    const stock = { quantity: stockAvailability(data.stock, item.article_id, item.size_label, item.colour || "") };
                    return (
                      <button
                        className="pos-product"
                        key={item.id}
                        disabled={busy || Number(stock?.quantity || 0) <= 0}
                        onClick={() => {
                          setKey(crypto.randomUUID());
                          setCart((old) =>
                            old.some((l) => l.id === item.id)
                              ? old.map((l) =>
                                  l.id === item.id
                                    ? { ...l, quantity: l.quantity + 1 }
                                    : l,
                                )
                              : [...old, { ...item, quantity: 1 }],
                          );
                        }}
                      >
                        <span className="pos-product-top">
                          <span className="pos-article-code">{displayCode(item)}</span>
                          <span className="pos-size">
                            Size {item.size_label}
                          </span>
                        </span>
                        <span className="pos-product-name">{item.name}</span>
                        <span
                          className={`pos-stock ${Number(stock?.quantity || 0) > 0 ? "" : "is-empty"}`}
                        >
                          {Number(stock?.quantity || 0) > 0
                            ? `${stock.quantity} pieces in stock`
                            : "Out of stock"}
                        </span>
                        <span className="pos-product-bottom">
                          <b>{money(item.unit_price)}</b>
                          <span className="pos-add">
                            <Plus size={16} /> Add
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </FilteredRecords>
          </section>
          <section className="workflow-pos-checkout pos-checkout">
            <div className="pos-section-heading">
              <div>
                <span className="pos-step">02 / REVIEW & PAY</span>
                <h2>
                  <ShoppingBag /> Current sale
                </h2>
              </div>
              <span className="pos-count">{pieces} pieces</span>
            </div>
            <SimpleForm
              busy={busy}
              submitDisabled={!cart.length || total <= 0}
              label={`Complete sale · ${money(total)}`}
              submit={async (f) => {
                setBusy(true);
                try {
                  const result = await financeRequest(
                    api,
                    token,
                    "point-of-sale/checkout",
                    {
                      checkout_key: key,
                      customer_id: Number(f.get("customer_id")),
                      sales_rep_id: Number(f.get("sales_rep_id")),
                      invoice_date: f.get("invoice_date"),
                      payment_method: f.get("payment_method"),
                      payment_account_id: Number(f.get("payment_account_id")) || null,
                      cheque_number: f.get("cheque_number"),
                      cheque_bank: f.get("cheque_bank"),
                      cheque_date: f.get("cheque_date"),
                      reference: f.get("reference"),
                      discount,
                      expected_total: total,
                      lines: cart.map((l) => ({
                        set_item_id: l.id,
                        quantity: l.quantity,
                      })),
                    },
                    "POST",
                  );
                  setCart([]);
                  setDiscount(0);
                  setKey(crypto.randomUUID());
                  setCompletedInvoice(result.invoice_id);
                  setBill(result.invoice_id);
                  await load().catch((e) =>
                    setError(
                      `Sale completed. Product refresh failed: ${e.message}`,
                    ),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="pos-cart">
                {!cart.length && (
                  <div className="pos-empty-cart">
                    <ShoppingBag />
                    <b>Your basket is empty</b>
                    <span>Select an article and size to start a sale.</span>
                  </div>
                )}
                {cart.map((line) => (
                  <div className="pos-cart-line" key={line.id}>
                    <div className="pos-cart-title">
                      <b>
                        {displayCode(line)} <span>Size {line.size_label}</span>
                      </b>
                      <span>{line.name}</span>
                      <small>{money(line.unit_price)} / piece</small>
                    </div>
                    <div className="pos-cart-controls">
                      <label>
                        Pieces
                        <input
                          type="number"
                          required
                          min="1"
                          step="1"
                          value={line.quantity}
                          onChange={(e) => {
                            setCart(
                              cart.map((l) =>
                                l.id === line.id
                                  ? { ...l, quantity: Number(e.target.value) }
                                  : l,
                              ),
                            );
                            setKey(crypto.randomUUID());
                          }}
                        />
                      </label>
                      <strong>
                        {money(line.quantity * Number(line.unit_price))}
                      </strong>
                      <button
                        type="button"
                        className="pos-remove"
                        aria-label={`Remove ${displayCode(line)} size ${line.size_label}`}
                        onClick={() => {
                          setCart(cart.filter((l) => l.id !== line.id));
                          setKey(crypto.randomUUID());
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <h3 className="pos-form-heading">Customer details</h3>
              <label>
                Customer
                <select name="customer_id" required>
                  <option value="">Choose customer</option>
                  {data.customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {displayCode(c)} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Salesperson / collector
                <select
                  name="sales_rep_id"
                  required
                  defaultValue={user?.sales_rep_id || ""}
                >
                  <option value="">Choose salesperson</option>
                  {data.reps
                    .filter(
                      (r: any) =>
                        !user?.sales_rep_id || r.id === user.sales_rep_id,
                    )
                    .map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </label>
              <h3 className="pos-form-heading">Payment details</h3>
              <label>
                Discount (LKR)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={discount}
                  onChange={(e) => {
                    setDiscount(Number(e.target.value));
                    setKey(crypto.randomUUID());
                  }}
                />
              </label>
              <label>
                Sale / receipt date
                <input
                  name="invoice_date"
                  type="date"
                  required
                  max={today()}
                  defaultValue={today()}
                />
              </label>
              <label>
                Payment method
                <select name="payment_method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </label>
              <label>
                {paymentMethod === "cheque" ? "Cheque holding account" : "Deposit to"}
                <select name="payment_account_id" required={paymentMethod !== "cheque"} disabled={paymentMethod === "cheque"}>
                  <option value="">{paymentMethod === "cheque" ? "1120 - Cheques in Hand" : "Choose cash/bank account"}</option>
                  {data.payment_accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {displayCode(a)} · {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reference
                <input name="reference" maxLength={80} />
              </label>
              {paymentMethod === "cheque" && <div className="collection-cheque-panel">
                <label>Cheque number<input name="cheque_number" required maxLength={80} /></label>
                <label>Bank / branch<input name="cheque_bank" required maxLength={160} /></label>
                <label>Cheque date<input name="cheque_date" type="date" required defaultValue={today()} /></label>
                <small>Pending clearance, not available cash. Clear or return this cheque from Collections.</small>
              </div>}
              <div className="pos-totals">
                <div>
                  <span>Subtotal</span>
                  <b>{money(subtotal)}</b>
                </div>
                <div>
                  <span>Discount</span>
                  <b>- {money(discount)}</b>
                </div>
              </div>
              <div className="workflow-summary pos-total">
                <span>Amount collected</span>
                <strong>{money(total)}</strong>
              </div>
              <p className="report-note">
                The full invoice amount is recorded as received. Serial
                requirements and available stock are checked before anything
                posts. Use Invoices for credit or part-payment sales.
              </p>
            </SimpleForm>
          </section>
        </div>
      )}
      {bill && (
        <InvoiceBill
          id={bill}
          api={api}
          token={token}
          close={() => setBill(null)}
        />
      )}
    </div>
  );
}
