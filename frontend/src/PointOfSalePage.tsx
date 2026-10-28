import { useCallback, useEffect, useState } from "react";
import { Check, Plus, RefreshCw } from "lucide-react";
import { financeMoney as money, financeRequest, financeToday as today } from "./finance-utils";
import { SimpleForm } from "./BusinessWorkflowsPage";
import InvoiceBill from "./InvoiceBill";

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
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [cart, setCart] = useState<any[]>([]),
    [discount, setDiscount] = useState(0),
    [busy, setBusy] = useState(false),
    [bill, setBill] = useState<number | null>(null),
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
      (cart.reduce((sum, line) => sum + line.quantity * Number(line.unit_price), 0) - discount) *
        100,
    ) / 100;
  return (
    <>
      <div className="heading">
        <div>
          <span>COUNTER SALES</span>
          <h1>Point of Sale</h1>
          <p>
            One checkout creates the sales invoice, stock issue, customer collection and balanced
            journals.
          </p>
        </div>
        <button disabled={busy} onClick={() => load().catch((e) => setError(e.message))}>
          <RefreshCw /> Refresh products
        </button>
      </div>
      <div className="workflow-links">
        {["Customers", "Invoices", "Collections", "Cashier Closing", "Serials & Warranty"].map(
          (name) => (
            <button key={name} onClick={() => go(name)}>
              {name} →
            </button>
          ),
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {!data ? (
        <p>{error ? "Use Refresh to retry." : "Loading point of sale..."}</p>
      ) : !canManage ? (
        <p>
          This profile can view sales through Invoices and Collections. Checkout requires accounting
          access.
        </p>
      ) : (
        <div className="workflow-pos-grid">
          <section>
            <h2>Products and sizes</h2>
            <div className="workflow-operation-grid">
              {data.items
                .filter((i: any) =>
                  `${i.code} ${i.name} ${i.size_label}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((item: any) => {
                  const stock = data.stock.find(
                    (s: any) =>
                      s.article_id === item.article_id && s.size_label === item.size_label,
                  );
                  return (
                    <button
                      key={item.id}
                      disabled={busy || Number(stock?.quantity || 0) <= 0}
                      onClick={() => {
                        setKey(crypto.randomUUID());
                        setCart((old) =>
                          old.some((l) => l.id === item.id)
                            ? old.map((l) =>
                                l.id === item.id ? { ...l, quantity: l.quantity + 1 } : l,
                              )
                            : [...old, { ...item, quantity: 1 }],
                        );
                      }}
                    >
                      <h2>
                        {item.code} · Size {item.size_label}
                      </h2>
                      <p>{item.name}</p>
                      <b>{money(item.unit_price)}</b>
                      <p>In stock: {stock?.quantity || 0}</p>
                      <Plus />
                    </button>
                  );
                })}
            </div>
          </section>
          <section className="workflow-pos-checkout">
            <h2>Review and collect payment</h2>
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
                      payment_account_id: Number(f.get("payment_account_id")),
                      reference: f.get("reference"),
                      discount,
                      expected_total: total,
                      lines: cart.map((l) => ({ set_item_id: l.id, quantity: l.quantity })),
                    },
                    "POST",
                  );
                  setCart([]);
                  setDiscount(0);
                  setKey(crypto.randomUUID());
                  await load();
                  setBill(result.invoice_id);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Customer
                <select name="customer_id" required>
                  <option value="">Choose customer</option>
                  {data.customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Salesperson / collector
                <select name="sales_rep_id" required defaultValue={user?.sales_rep_id || ""}>
                  <option value="">Choose salesperson</option>
                  {data.reps
                    .filter((r: any) => !user?.sales_rep_id || r.id === user.sales_rep_id)
                    .map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </label>
              {cart.map((line) => (
                <div className="workflow-return-line" key={line.id}>
                  <div>
                    <b>
                      {line.code} · {line.size_label}
                    </b>
                    <small>{money(line.unit_price)} / piece</small>
                    <button
                      type="button"
                      onClick={() => {
                        setCart(cart.filter((l) => l.id !== line.id));
                        setKey(crypto.randomUUID());
                      }}
                    >
                      Remove
                    </button>
                  </div>
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
                            l.id === line.id ? { ...l, quantity: Number(e.target.value) } : l,
                          ),
                        );
                        setKey(crypto.randomUUID());
                      }}
                    />
                  </label>
                </div>
              ))}
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
                <select name="payment_method">
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </label>
              <label>
                Deposit to
                <select name="payment_account_id" required>
                  <option value="">Choose cash/bank account</option>
                  {data.payment_accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reference
                <input name="reference" maxLength={80} />
              </label>
              <div className="workflow-summary">
                <span>Amount collected</span>
                <strong>{money(total)}</strong>
              </div>
              <p className="report-note">
                The full invoice amount is recorded as received. Serial requirements and available
                stock are checked before anything posts. Use Invoices for credit or part-payment
                sales.
              </p>
            </SimpleForm>
          </section>
        </div>
      )}
      {bill && <InvoiceBill id={bill} api={api} token={token} close={() => setBill(null)} />}
    </>
  );
}
