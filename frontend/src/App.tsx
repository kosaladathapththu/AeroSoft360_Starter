import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ClipboardCheck,
  Factory,
  Eye,
  FileUp,
  FileText,
  LayoutDashboard,
  Loader2,
  Menu,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import "./styles.css";
import "./actions.css";
import "./reports.css";
import "./tables.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";
type Supplier = {
  id: number;
  code: string;
  name: string;
  phone?: string;
  payment_days: number;
  status: string;
};
type Material = {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
};
type Line = {
  id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  line_total: number;
};
type Order = {
  id: number;
  number: string;
  supplier_id: number;
  supplier_name: string;
  order_date: string;
  expected_date?: string;
  status: string;
  total: number;
  lines: Line[];
};
type Stock = {
  id: number;
  material_id: number;
  code: string;
  name: string;
  category: string;
  batch_number: string;
  quantity: number;
  unit_cost: number;
};
type JournalLine = {
  id: number;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
};
type Journal = {
  id: number;
  number: string;
  posting_date: string;
  description: string;
  status: string;
  lines: JournalLine[];
};
type RecordRow = Supplier | Order | Stock | Journal;
type Workspace = {
  suppliers: Supplier[];
  materials: Material[];
  purchase_orders: Order[];
  stock: Stock[];
  journals: Journal[];
};
type Profile = {
  user: {
    id: number;
    name: string;
    email: string;
    role_code: string;
    role_name: string;
  };
  permissions: string[];
};
const empty: Workspace = {
  suppliers: [],
  materials: [],
  purchase_orders: [],
  stock: [],
  journals: [],
};
const money = (n: number | string) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(
    Number(n),
  );
const status = (s: string) => (
  <span className={`status ${s}`}>{s.replace("_", " ")}</span>
);

export default function App() {
  const [data, setData] = useState<Workspace>(empty),
    [profile, setProfile] = useState<Profile | null>(null),
    [authReady, setAuthReady] = useState(false),
    [page, setPage] = useState("Dashboard"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [modal, setModal] = useState(""),
    [editing, setEditing] = useState<RecordRow | null>(null),
    [viewing, setViewing] = useState<RecordRow | null>(null),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState("");
  const token = () => localStorage.getItem("aerosoft_token");
  const load = useCallback(async () => {
    const saved = localStorage.getItem("aerosoft_token");
    if (!saved) {
      setAuthReady(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const me = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${saved}` },
      });
      if (!me.ok) throw new Error("session");
      setProfile(await me.json());
      const r = await fetch(`${API}/workspace`, {
        headers: { Authorization: `Bearer ${saved}` },
      });
      if (!r.ok)
        throw new Error("Backend is unavailable. Start Laravel and try again.");
      setData(await r.json());
    } catch (e) {
      if ((e as Error).message === "session") {
        localStorage.removeItem("aerosoft_token");
        setProfile(null);
      } else
        setError(e instanceof Error ? e.message : "Unable to load workspace");
    } finally {
      setAuthReady(true);
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const call = async (url: string, body?: unknown, method = "POST") => {
    const r = await fetch(`${API}${url}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok)
      throw new Error(
        json.message ||
          Object.values(json.errors || {})
            .flat()
            .join(" ") ||
          "Request failed",
      );
    await load();
    return json;
  };
  const nav = [
    ["Dashboard", LayoutDashboard],
    ["Suppliers", Building2],
    ["Purchase Orders", FileText],
    ["Receive Goods", ClipboardCheck],
    ["Raw Material Stock", Warehouse],
    ["General Ledger", ShieldCheck],
    ["Payroll", Building2],
    ["Reports", FileText],
  ] as const;
  const rows = useMemo(() => {
    const q = search.toLowerCase();
    if (page === "Suppliers")
      return data.suppliers.filter((x) =>
        `${x.code} ${x.name}`.toLowerCase().includes(q),
      );
    if (page === "Purchase Orders" || page === "Receive Goods")
      return data.purchase_orders.filter((x) =>
        `${x.number} ${x.supplier_name}`.toLowerCase().includes(q),
      );
    if (page === "Raw Material Stock")
      return data.stock.filter((x) =>
        `${x.code} ${x.name} ${x.batch_number}`.toLowerCase().includes(q),
      );
    return data.journals.filter((x) =>
      `${x.number} ${x.description}`.toLowerCase().includes(q),
    );
  }, [data, page, search]);
  const remove = async (row: RecordRow) => {
    const kind =
      page === "Suppliers"
        ? "supplier"
        : page === "Raw Material Stock"
          ? "stock batch"
          : page === "General Ledger"
            ? "journal"
            : "purchase order";
    if (!window.confirm(`Delete this ${kind}? This action cannot be undone.`))
      return;
    const path =
      page === "Suppliers"
        ? `/suppliers/${row.id}`
        : page === "Raw Material Stock"
          ? `/stock/${row.id}`
          : page === "General Ledger"
            ? `/journals/${row.id}`
            : `/purchase-orders/${row.id}`;
    try {
      setError("");
      await call(path, undefined, "DELETE");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const can = (permission: string) =>
    profile?.permissions.includes(permission) ?? false;
  const logout = async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
    } finally {
      localStorage.removeItem("aerosoft_token");
      setProfile(null);
      setData(empty);
    }
  };
  if (!authReady)
    return (
      <div className="login-page">
        <Loader2 className="login-spinner" />
      </div>
    );
  if (!profile)
    return (
      <Login
        onLogin={(result) => {
          localStorage.setItem("aerosoft_token", result.token);
          setProfile({ user: result.user, permissions: result.permissions });
          load();
        }}
      />
    );
  return (
    <div className="shell">
      {menu && <button className="scrim" onClick={() => setMenu(false)} />}
      <aside className={menu ? "open" : ""}>
        <div className="brand">
          <div className="logo">A</div>
          <div>
            <b>AeroSoft360</b>
            <span>Finance & Manufacturing ERP</span>
          </div>
          <button className="mobile-close" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <div className="company">
          <Factory />
          <div>
            <b>Supun AeroSoft</b>
            <span>Colombo 13 · LKR</span>
          </div>
        </div>
        <nav>
          <label>PROCURE TO STOCK</label>
          {nav.map(([name, Icon]) => (
            <button
              className={page === name ? "active" : ""}
              onClick={() => {
                setPage(name);
                setMenu(false);
                setSearch("");
              }}
              key={name}
            >
              <Icon />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="user">
          <div>U1</div>
          <span>
            <b>Administrator</b>
            <small>Full access</small>
          </span>
        </div>
      </aside>
      <main>
        <header>
          <button className="menu" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div>
            <span>Workspace</span>
            <b>{page}</b>
          </div>
          <div className="search">
            <Search />
            <input
              placeholder="Search records"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="refresh" onClick={load}>
            <RefreshCw />
          </button>
        </header>
        <section className="content">
          {page === "Payroll" ? (
            <PayrollPage token={token() || ""} />
          ) : page === "Reports" ? (
            <ReportsPage token={token() || ""} />
          ) : (
            <>
              <div className="heading">
                <div>
                  <span>SUPUN AEROSOFT (PVT) LTD</span>
                  <h1>{page}</h1>
                  <p>
                    {page === "Dashboard"
                      ? "Purchasing, goods receiving, batch stock and accounting in one controlled flow."
                      : "Search, review and process authorized business records."}
                  </p>
                </div>
                {page === "Suppliers" && (
                  <button
                    className="primary"
                    onClick={() => setModal("supplier")}
                  >
                    <Plus /> Add Supplier
                  </button>
                )}
                {page === "Purchase Orders" && (
                  <button className="primary" onClick={() => setModal("po")}>
                    <Plus /> New Purchase Order
                  </button>
                )}
                {page === "Receive Goods" && (
                  <button className="primary" onClick={() => setModal("grn")}>
                    <PackagePlus /> Receive Goods
                  </button>
                )}
              </div>
              {error && <div className="error">{error}</div>}
              {loading ? (
                <div className="loading">
                  <Loader2 /> Loading records…
                </div>
              ) : page === "Dashboard" ? (
                <Dashboard data={data} go={setPage} />
              ) : (
                <Records
                  page={page}
                  rows={rows as RecordRow[]}
                  approve={async (id) => {
                    try {
                      await call(`/purchase-orders/${id}/approve`);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                  edit={setEditing}
                  view={setViewing}
                  remove={remove}
                />
              )}
            </>
          )}
        </section>
      </main>
      {modal && (
        <CreateModal
          type={modal}
          data={data}
          close={() => setModal("")}
          submit={async (url, body) => {
            try {
              setError("");
              await call(url, body);
              setModal("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}{" "}
      {editing && (
        <EditModal
          page={page}
          row={editing}
          suppliers={data.suppliers}
          close={() => setEditing(null)}
          submit={async (url, body) => {
            try {
              setError("");
              await call(url, body, "PUT");
              setEditing(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {viewing && (
        <RecordView
          page={page}
          row={viewing as any}
          close={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function Dashboard({ data, go }: { data: Workspace; go: (x: string) => void }) {
  const approved = data.purchase_orders.filter(
    (x) => x.status === "approved" || x.status === "part_received",
  );
  const stockValue = data.stock.reduce(
    (s, x) => s + Number(x.quantity) * Number(x.unit_cost),
    0,
  );
  return (
    <>
      <div className="kpis">
        <article>
          <span>Suppliers</span>
          <b>{data.suppliers.length}</b>
          <small>Active supplier records</small>
        </article>
        <article>
          <span>Open purchase orders</span>
          <b>{approved.length}</b>
          <small>Approved or partially received</small>
        </article>
        <article>
          <span>Raw material stock</span>
          <b>{money(stockValue)}</b>
          <small>Specific batch value</small>
        </article>
        <article>
          <span>Posted journals</span>
          <b>{data.journals.length}</b>
          <small>Balanced source postings</small>
        </article>
      </div>
      <div className="flow-card">
        <h2>Purchasing workflow</h2>
        <p>Each step uses the approved record from the previous step.</p>
        <div className="flow">
          {[
            ["1", "Supplier", "Suppliers"],
            ["2", "Purchase Order", "Purchase Orders"],
            ["3", "Approval", "Purchase Orders"],
            ["4", "Goods Receipt", "Receive Goods"],
            ["5", "Batch Stock", "Raw Material Stock"],
            ["6", "General Ledger", "General Ledger"],
          ].map((x) => (
            <button key={x[0]} onClick={() => go(x[2])}>
              <i>{x[0]}</i>
              <b>{x[1]}</b>
            </button>
          ))}
        </div>
      </div>
      <div className="panels">
        <section>
          <div className="panel-head">
            <h2>Recent purchase orders</h2>
            <button onClick={() => go("Purchase Orders")}>View all</button>
          </div>
          {data.purchase_orders.length ? (
            data.purchase_orders.slice(0, 5).map((x) => (
              <div className="list-row" key={x.id}>
                <FileText />
                <span>
                  <b>{x.number}</b>
                  <small>{x.supplier_name}</small>
                </span>
                <strong>{money(x.total)}</strong>
                {status(x.status)}
              </div>
            ))
          ) : (
            <Empty text="No purchase orders yet" />
          )}
        </section>
        <section>
          <div className="panel-head">
            <h2>Recent accounting entries</h2>
            <button onClick={() => go("General Ledger")}>View all</button>
          </div>
          {data.journals.length ? (
            data.journals.slice(0, 5).map((x) => (
              <div className="list-row" key={x.id}>
                <ShieldCheck />
                <span>
                  <b>{x.number}</b>
                  <small>{x.description}</small>
                </span>
                {status(x.status)}
              </div>
            ))
          ) : (
            <Empty text="No journals posted yet" />
          )}
        </section>
      </div>
    </>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Truck />
      <b>{text}</b>
      <span>New records will appear here after they are saved.</span>
    </div>
  );
}

function Records({
  page,
  rows,
  approve,
  view,
  edit,
  remove,
}: {
  page: string;
  rows: RecordRow[];
  approve: (id: number) => void;
  view: (row: RecordRow) => void;
  edit: (row: RecordRow) => void;
  remove: (row: RecordRow) => void;
}) {
  if (!rows.length)
    return (
      <div className="table-card">
        <Empty text={`No ${page.toLowerCase()} found`} />
      </div>
    );
  let heads: string[] = [];
  if (page === "Suppliers")
    heads = ["Code", "Supplier", "Phone", "Payment Terms", "Status", "Actions"];
  else if (page === "Purchase Orders" || page === "Receive Goods")
    heads = [
      "Document",
      "Supplier",
      "Order Date",
      "Expected",
      "Total",
      "Status",
      "Actions",
    ];
  else if (page === "Raw Material Stock")
    heads = [
      "Material",
      "Description",
      "Category",
      "Batch",
      "Quantity",
      "Unit Cost",
      "Stock Value",
      "Actions",
    ];
  else
    heads = [
      "Journal",
      "Posting Date",
      "Description",
      "Debit",
      "Credit",
      "Status",
      "Actions",
    ];
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any) => (
            <tr key={row.id}>
              {page === "Suppliers" ? (
                <>
                  <td>{row.code}</td>
                  <td>
                    <b>{row.name}</b>
                  </td>
                  <td>{row.phone || "—"}</td>
                  <td>{row.payment_days} days</td>
                  <td>{status(row.status)}</td>
                </>
              ) : page === "Purchase Orders" || page === "Receive Goods" ? (
                <>
                  <td>
                    <b>{row.number}</b>
                  </td>
                  <td>{row.supplier_name}</td>
                  <td>{row.order_date}</td>
                  <td>{row.expected_date || "—"}</td>
                  <td>{money(row.total)}</td>
                  <td>{status(row.status)}</td>
                </>
              ) : page === "Raw Material Stock" ? (
                <>
                  <td>
                    <b>{row.code}</b>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.category.replace("_", " ")}</td>
                  <td>{row.batch_number}</td>
                  <td>{Number(row.quantity).toLocaleString()}</td>
                  <td>{money(row.unit_cost)}</td>
                  <td>{money(row.quantity * row.unit_cost)}</td>
                </>
              ) : (
                <>
                  <td>
                    <b>{row.number}</b>
                  </td>
                  <td>{row.posting_date}</td>
                  <td>{row.description}</td>
                  <td>
                    {money(
                      row.lines.reduce(
                        (s: number, l: JournalLine) => s + Number(l.debit),
                        0,
                      ),
                    )}
                  </td>
                  <td>
                    {money(
                      row.lines.reduce(
                        (s: number, l: JournalLine) => s + Number(l.credit),
                        0,
                      ),
                    )}
                  </td>
                  <td>{status(row.status)}</td>
                </>
              )}
              <td>
                <div className="row-actions">
                  {page === "Purchase Orders" && row.status === "draft" && (
                    <button className="approve" onClick={() => approve(row.id)}>
                      <Check /> Approve
                    </button>
                  )}
                  {page === "Receive Goods" &&
                    (row.status === "approved" ||
                      row.status === "part_received") && (
                      <span className="ready">Ready</span>
                    )}
                  <button
                    className="icon-action view"
                    title="View"
                    onClick={() => view(row)}
                  >
                    <Eye />
                  </button>
                  <button
                    className="icon-action edit"
                    title="Edit"
                    onClick={() => edit(row)}
                  >
                    <Pencil />
                  </button>
                  <button
                    className="icon-action delete"
                    title="Delete"
                    onClick={() => remove(row)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordView({
  page,
  row,
  close,
}: {
  page: string;
  row: any;
  close: () => void;
}) {
  const hidden = ["id", "lines", "items", "created_at", "updated_at"];
  return (
    <div className="backdrop" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>
          <X />
        </button>
        <span>RECORD DETAILS</span>
        <h2>{page}</h2>
        <div className="detail-grid">
          {Object.entries(row)
            .filter(([k]) => !hidden.includes(k))
            .map(([k, v]) => (
              <div key={k}>
                <small>{k.replace(/_/g, " ")}</small>
                <b>
                  {typeof v === "number" &&
                  ["total", "salary", "cost", "debit", "credit"].some((x) =>
                    k.includes(x),
                  )
                    ? money(v)
                    : String(v ?? "—")}
                </b>
              </div>
            ))}
        </div>
        {(row.lines || row.items)?.length > 0 && (
          <div className="detail-lines">
            <h3>Lines</h3>
            {(row.lines || row.items).map((line: any) => (
              <div key={line.id}>
                <span>
                  {line.material_name || line.account_name || line.name}
                </span>
                <b>
                  {line.net_salary
                    ? `Net ${money(line.net_salary)}`
                    : line.quantity
                      ? `${line.quantity} × ${money(line.unit_cost)}`
                      : `Dr ${money(line.debit)} / Cr ${money(line.credit)}`}
                </b>
              </div>
            ))}
          </div>
        )}
        <div className="actions">
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateModal({
  type,
  data,
  close,
  submit,
}: {
  type: string;
  data: Workspace;
  close: () => void;
  submit: (url: string, body: any) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const approved = data.purchase_orders.filter(
    (x) => x.status === "approved" || x.status === "part_received",
  );
  const send = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (type === "supplier")
        await submit("/suppliers", {
          code: f.get("code"),
          name: f.get("name"),
          phone: f.get("phone"),
          payment_days: Number(f.get("payment_days")),
        });
      if (type === "po")
        await submit("/purchase-orders", {
          supplier_id: Number(f.get("supplier_id")),
          order_date: f.get("order_date"),
          expected_date: f.get("expected_date") || null,
          lines: [
            {
              material_id: Number(f.get("material_id")),
              quantity: Number(f.get("quantity")),
              unit_cost: Number(f.get("unit_cost")),
            },
          ],
        });
      if (type === "grn") {
        const order = data.purchase_orders.find(
          (x) => x.id === Number(f.get("purchase_order_id")),
        )!;
        const line = order.lines.find(
          (x) => x.id === Number(f.get("line_id")),
        )!;
        await submit(`/purchase-orders/${order.id}/receive`, {
          received_on: f.get("received_on"),
          supplier_invoice: f.get("supplier_invoice") || null,
          lines: [
            {
              purchase_order_line_id: line.id,
              quantity: Number(f.get("quantity")),
              batch_number: f.get("batch_number"),
            },
          ],
        });
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalShell
      title={
        type === "supplier"
          ? "Add Supplier"
          : type === "po"
            ? "New Purchase Order"
            : "Receive Goods"
      }
      close={close}
      busy={busy}
      onSubmit={send}
    >
      {type === "supplier" ? (
        <>
          <label>
            Supplier code
            <input name="code" required placeholder="SUP-001" />
          </label>
          <label>
            Supplier name
            <input name="name" required />
          </label>
          <div className="form-row">
            <label>
              Phone
              <input name="phone" />
            </label>
            <label>
              Payment days
              <input
                name="payment_days"
                required
                type="number"
                min="0"
                defaultValue="30"
              />
            </label>
          </div>
        </>
      ) : type === "po" ? (
        <>
          <label>
            Supplier
            <select name="supplier_id" required>
              <option value="">Select supplier</option>
              {data.suppliers.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.code} — {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Order date
              <input name="order_date" required type="date" />
            </label>
            <label>
              Expected date
              <input name="expected_date" type="date" />
            </label>
          </div>
          <label>
            Material
            <select name="material_id" required>
              <option value="">Select material</option>
              {data.materials.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.code} — {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Quantity
              <input
                name="quantity"
                required
                type="number"
                min="0.0001"
                step="0.0001"
              />
            </label>
            <label>
              Unit cost (LKR)
              <input
                name="unit_cost"
                required
                type="number"
                min="0"
                step="0.01"
              />
            </label>
          </div>
        </>
      ) : (
        <GrnFields orders={approved} />
      )}
    </ModalShell>
  );
}

function EditModal({
  page,
  row,
  suppliers,
  close,
  submit,
}: {
  page: string;
  row: any;
  suppliers: Supplier[];
  close: () => void;
  submit: (url: string, body: any) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const send = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (page === "Suppliers")
        await submit(`/suppliers/${row.id}`, {
          code: f.get("code"),
          name: f.get("name"),
          phone: f.get("phone"),
          payment_days: Number(f.get("payment_days")),
          status: f.get("status"),
        });
      else if (page === "Raw Material Stock")
        await submit(`/stock/${row.id}`, {
          batch_number: f.get("batch_number"),
          quantity: Number(f.get("quantity")),
          unit_cost: Number(f.get("unit_cost")),
        });
      else if (page === "General Ledger")
        await submit(`/journals/${row.id}`, {
          posting_date: f.get("posting_date"),
          description: f.get("description"),
          status: f.get("status"),
        });
      else
        await submit(`/purchase-orders/${row.id}`, {
          supplier_id: Number(f.get("supplier_id")),
          order_date: f.get("order_date"),
          expected_date: f.get("expected_date") || null,
          status: f.get("status"),
        });
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalShell
      title={`Edit ${page === "Receive Goods" ? "Purchase Order" : page.replace(/s$/, "")}`}
      close={close}
      busy={busy}
      onSubmit={send}
    >
      {page === "Suppliers" ? (
        <>
          <label>
            Supplier code
            <input name="code" required defaultValue={row.code} />
          </label>
          <label>
            Supplier name
            <input name="name" required defaultValue={row.name} />
          </label>
          <div className="form-row">
            <label>
              Phone
              <input name="phone" defaultValue={row.phone} />
            </label>
            <label>
              Payment days
              <input
                name="payment_days"
                required
                type="number"
                min="0"
                defaultValue={row.payment_days}
              />
            </label>
          </div>
          <label>
            Status
            <select name="status" defaultValue={row.status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </>
      ) : page === "Raw Material Stock" ? (
        <>
          <label>
            Material
            <input value={`${row.code} — ${row.name}`} disabled />
          </label>
          <label>
            Batch number
            <input
              name="batch_number"
              required
              defaultValue={row.batch_number}
            />
          </label>
          <div className="form-row">
            <label>
              Quantity
              <input
                name="quantity"
                required
                type="number"
                min="0"
                step="0.0001"
                defaultValue={row.quantity}
              />
            </label>
            <label>
              Unit cost
              <input
                name="unit_cost"
                required
                type="number"
                min="0"
                step="0.0001"
                defaultValue={row.unit_cost}
              />
            </label>
          </div>
        </>
      ) : page === "General Ledger" ? (
        <>
          <label>
            Journal
            <input value={row.number} disabled />
          </label>
          <label>
            Posting date
            <input
              name="posting_date"
              required
              type="date"
              defaultValue={row.posting_date}
            />
          </label>
          <label>
            Description
            <input name="description" required defaultValue={row.description} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={row.status}>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="void">Void</option>
            </select>
          </label>
        </>
      ) : (
        <>
          <label>
            Purchase order
            <input value={row.number} disabled />
          </label>
          <label>
            Supplier
            <select name="supplier_id" required defaultValue={row.supplier_id}>
              {suppliers.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.code} — {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Order date
              <input
                name="order_date"
                required
                type="date"
                defaultValue={row.order_date}
              />
            </label>
            <label>
              Expected date
              <input
                name="expected_date"
                type="date"
                defaultValue={row.expected_date}
              />
            </label>
          </div>
          <label>
            Status
            <select name="status" defaultValue={row.status}>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="part_received">Part received</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </>
      )}
    </ModalShell>
  );
}

function ModalShell({
  title,
  close,
  busy,
  onSubmit,
  children,
}: {
  title: string;
  close: () => void;
  busy: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className="modal"
        onSubmit={onSubmit}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <span>CONTROLLED TRANSACTION</span>
        <h2>{title}</h2>
        <p>Review the information before saving this business record.</p>
        {children}
        <div className="actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? <Loader2 /> : <Check />}
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
function GrnFields({ orders }: { orders: Order[] }) {
  const [id, setId] = useState(orders[0]?.id || 0),
    order = orders.find((x) => x.id === id);
  return (
    <>
      <label>
        Approved purchase order
        <select
          name="purchase_order_id"
          required
          value={id || ""}
          onChange={(e) => setId(Number(e.target.value))}
        >
          <option value="">Select PO</option>
          {orders.map((x) => (
            <option value={x.id} key={x.id}>
              {x.number} — {x.supplier_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        PO material line
        <select name="line_id" required>
          <option value="">Select material</option>
          {order?.lines
            .filter((x) => Number(x.received_quantity) < Number(x.quantity))
            .map((x) => (
              <option value={x.id} key={x.id}>
                {x.material_code} — {x.material_name} (
                {Number(x.quantity) - Number(x.received_quantity)} remaining)
              </option>
            ))}
        </select>
      </label>
      <div className="form-row">
        <label>
          Received date
          <input name="received_on" required type="date" />
        </label>
        <label>
          Supplier invoice
          <input name="supplier_invoice" />
        </label>
      </div>
      <div className="form-row">
        <label>
          Quantity received
          <input
            name="quantity"
            required
            type="number"
            min="0.0001"
            step="0.0001"
          />
        </label>
        <label>
          Batch number
          <input name="batch_number" required placeholder="RM-261013-A" />
        </label>
      </div>
    </>
  );
}

function Login({
  onLogin,
}: {
  onLogin: (result: Profile & { token: string }) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message || "Unable to sign in.");
      onLogin(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="logo">A</div>
          <div>
            <b>AeroSoft360</b>
            <span>Finance & Manufacturing ERP</span>
          </div>
        </div>
        <span className="eyebrow">SECURE WORKSPACE</span>
        <h1>Sign in</h1>
        <p>Use your assigned AeroSoft360 account.</p>
        {error && <div className="error">{error}</div>}
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            defaultValue="admin@aerosoft360.lk"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            defaultValue="Admin@123"
          />
        </label>
        <button className="primary login-submit" disabled={busy}>
          {busy ? <Loader2 /> : <ShieldCheck />}
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <small>Demo profiles are documented in README.md.</small>
      </form>
    </div>
  );
}

function ModuleHeader({ title, back }: { title: string; back: () => void }) {
  return (
    <header className="module-header">
      <button onClick={back}>← Dashboard</button>
      <div>
        <span>AeroSoft360 ERP</span>
        <b>{title}</b>
      </div>
    </header>
  );
}
function PayrollPage({ token }: { token: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [viewing, setViewing] = useState<any>(null),
    [editing, setEditing] = useState<any>(null),
    [editType, setEditType] = useState(""),
    [attendanceOpen, setAttendanceOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [calculating, setCalculating] = useState<number | null>(null);
  const loadPayroll = useCallback(() => {
    fetch(`${API}/payroll`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError("Unable to load payroll."));
  }, [token]);
  useEffect(loadPayroll, [loadPayroll]);
  const remove = async (type: string, row: any) => {
    if (!window.confirm(`Delete ${type} ${row.name || row.number}?`)) return;
    const path =
      type === "employee" ? `employees/${row.id}` : `payroll-runs/${row.id}`;
    const r = await fetch(`${API}/${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const json = await r.json();
    if (!r.ok) {
      setError(json.message || "Delete failed.");
      return;
    }
    loadPayroll();
  };
  const calculatePayroll = async (attendanceImportId: number) => {
    setCalculating(attendanceImportId);
    setError("");
    try {
      const response = await fetch(`${API}/payroll/calculate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ attendance_import_id: attendanceImportId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Payroll calculation failed.");
      loadPayroll();
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setCalculating(null);
    }
  };
  const downloadPayrollReport = async (path: string, fileName: string) => {
    setError("");
    try {
      const response = await fetch(`${API}/${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.ms-excel",
        },
      });
      if (!response.ok) throw new Error("Report download failed.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exception) {
      setError((exception as Error).message);
    }
  };
  return (
    <>
      <div className="heading">
        <div>
          <span>HUMAN RESOURCES AND PAYROLL</span>
          <h1>Payroll</h1>
          <p>Employee salaries, earnings, deductions and net-pay history.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-action" onClick={() => setSettingsOpen(true)}>
            <Settings /> Payroll settings
          </button>
          <button className="primary" onClick={() => setAttendanceOpen(true)}>
            <FileUp /> Upload attendance
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {!data ? (
        <div className="loading">
          <Loader2 /> Loading payroll…
        </div>
      ) : (
        <>
          <div className="kpis">
            <article>
              <span>Employees</span>
              <b>{data.employees.length}</b>
              <small>Employee master records</small>
            </article>
            <article>
              <span>Payroll runs</span>
              <b>{data.runs.length}</b>
              <small>Processed pay periods</small>
            </article>
            <article>
              <span>Latest gross payroll</span>
              <b>{money(data.runs[0]?.gross_total || 0)}</b>
              <small>Earnings before deductions</small>
            </article>
            <article>
              <span>Latest net payroll</span>
              <b>{money(data.runs[0]?.net_total || 0)}</b>
              <small>Employee take-home total</small>
            </article>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Attendance file</th>
                  <th>Period</th>
                  <th>Employees</th>
                  <th>Paid days</th>
                  <th>No-pay days</th>
                  <th>OT hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.imports.length === 0 ? (
                  <tr><td colSpan={8}>No attendance sheets uploaded yet.</td></tr>
                ) : data.imports.map((item: any) => (
                  <tr key={item.id}>
                    <td><b>{item.file_name}</b><br /><small>{item.record_count} valid records</small></td>
                    <td>{item.period_start} to {item.period_end}</td>
                    <td>{item.employees}</td>
                    <td>{item.paid_days}</td>
                    <td>{item.no_pay_days}</td>
                    <td>{item.overtime_hours}</td>
                    <td>{status(item.status)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-action view" onClick={() => setViewing(item)} title="View validation summary"><Eye /></button>
                        <button className="icon-action download" onClick={() => downloadPayrollReport(`attendance/${item.id}/excel`, `Attendance_${item.period_end}.xls`)} title="Download attendance report"><FileText /></button>
                        {item.status === "validated" && (
                          <button className="approve" disabled={calculating === item.id} onClick={() => calculatePayroll(item.id)}>
                            {calculating === item.id ? <Loader2 /> : <Check />} Calculate payroll
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Basic salary</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e: any) => (
                  <tr key={e.id}>
                    <td>
                      <b>{e.employee_no}</b>
                      <br />
                      {e.name}
                    </td>
                    <td>{e.department}</td>
                    <td>{e.designation}</td>
                    <td>{money(e.basic_salary)}</td>
                    <td>{status(e.status)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-action view"
                          onClick={() => setViewing(e)}
                          title="View"
                        >
                          <Eye />
                        </button>
                        <button
                          className="icon-action edit"
                          onClick={() => {
                            setEditing(e);
                            setEditType("employee");
                          }}
                          title="Edit"
                        >
                          <Pencil />
                        </button>
                        <button
                          className="icon-action delete"
                          onClick={() => remove("employee", e)}
                          title="Delete"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Payroll</th>
                  <th>Period</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net pay</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.number}</b>
                    </td>
                    <td>
                      {r.period_start} to {r.period_end}
                    </td>
                    <td>{money(r.gross_total)}</td>
                    <td>{money(r.deduction_total)}</td>
                    <td>{money(r.net_total)}</td>
                    <td>{status(r.status)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-action view"
                          onClick={() => setViewing(r)}
                          title="View"
                        >
                          <Eye />
                        </button>
                        <button
                          className="icon-action download"
                          onClick={() => downloadPayrollReport(`payroll-runs/${r.id}/excel`, `Payroll_${r.number}.xls`)}
                          title="Download payroll register"
                        >
                          <FileText />
                        </button>
                        <button
                          className="icon-action edit"
                          onClick={() => {
                            setEditing(r);
                            setEditType("payroll");
                          }}
                          title="Edit"
                        >
                          <Pencil />
                        </button>
                        <button
                          className="icon-action delete"
                          onClick={() => remove("payroll", r)}
                          title="Delete"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {viewing && (
        <RecordView
          page="Payroll"
          row={viewing}
          close={() => setViewing(null)}
        />
      )}{" "}
      {editing && (
        <PayrollEditModal
          type={editType}
          row={editing}
          token={token}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            loadPayroll();
          }}
        />
      )}
      {attendanceOpen && (
        <AttendanceUploadModal
          token={token}
          close={() => setAttendanceOpen(false)}
          saved={() => {
            setAttendanceOpen(false);
            loadPayroll();
          }}
        />
      )}
      {settingsOpen && data && (
        <PayrollSettingsModal
          employees={data.employees}
          token={token}
          close={() => setSettingsOpen(false)}
          saved={() => {
            setSettingsOpen(false);
            loadPayroll();
          }}
        />
      )}
    </>
  );
}
function PayrollSettingsModal({ employees, token, close, saved }: { employees: any[]; token: string; close: () => void; saved: () => void }) {
  const [employeeId, setEmployeeId] = useState(String(employees[0]?.id || ""));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const employee = employees.find((item) => String(item.id) === employeeId) || employees[0];
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(["basic_salary", "fixed_allowance", "fixed_incentive", "fixed_deduction", "epf_rate", "monthly_working_days", "standard_month_hours", "overtime_multiplier"].map((key) => [key, Number(form.get(key))]));
    try {
      const response = await fetch(`${API}/employees/${employeeId}/payroll-settings`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Unable to save payroll settings.");
      saved();
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="backdrop" onMouseDown={close}>
      <form key={employeeId} className="modal payroll-settings-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="close" onClick={close}><X /></button>
        <span>MANUAL SALARY MASTER</span>
        <h2>Payroll settings</h2>
        <p>Maintain salary values manually. Attendance uploads provide only paid days, no-pay days and overtime hours.</p>
        {error && <div className="error">{error}</div>}
        <label>Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>{employees.map((item) => <option key={item.id} value={item.id}>{item.employee_no} — {item.name}</option>)}</select></label>
        <div className="form-row">
          <label>Basic salary (LKR)<input type="number" step="0.01" min="0" name="basic_salary" required defaultValue={employee?.basic_salary || 0} /></label>
          <label>Fixed allowance (LKR)<input type="number" step="0.01" min="0" name="fixed_allowance" required defaultValue={employee?.fixed_allowance || 0} /></label>
          <label>Fixed incentive (LKR)<input type="number" step="0.01" min="0" name="fixed_incentive" required defaultValue={employee?.fixed_incentive || 0} /></label>
          <label>Other fixed deduction (LKR)<input type="number" step="0.01" min="0" name="fixed_deduction" required defaultValue={employee?.fixed_deduction || 0} /></label>
          <label>Employee EPF rate (%)<input type="number" step="0.01" min="0" max="100" name="epf_rate" required defaultValue={employee?.epf_rate ?? 8} /></label>
          <label>Monthly working days<input type="number" step="0.5" min="1" max="31" name="monthly_working_days" required defaultValue={employee?.monthly_working_days ?? 26} /></label>
          <label>Standard monthly hours<input type="number" step="0.5" min="1" name="standard_month_hours" required defaultValue={employee?.standard_month_hours ?? 240} /></label>
          <label>Overtime multiplier<input type="number" step="0.01" min="0" name="overtime_multiplier" required defaultValue={employee?.overtime_multiplier ?? 1.5} /></label>
        </div>
        <div className="salary-preview"><span>Current fixed gross</span><b>{money(Number(employee?.basic_salary || 0) + Number(employee?.fixed_allowance || 0) + Number(employee?.fixed_incentive || 0))}</b></div>
        <div className="actions"><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? <Loader2 /> : <Check />} Save settings</button></div>
      </form>
    </div>
  );
}
function AttendanceUploadModal({ token, close, saved }: { token: string; close: () => void; saved: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData(event.currentTarget);
      const response = await fetch(`${API}/attendance/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body,
      });
      const json = await response.json();
      if (!response.ok) {
        const firstValidationError = json.errors ? Object.values(json.errors).flat()[0] : null;
        throw new Error(String(firstValidationError || json.message || "Attendance upload failed."));
      }
      saved();
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="backdrop" onMouseDown={close}>
      <form className="modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="close" onClick={close}><X /></button>
        <span>ATTENDANCE IMPORT</span>
        <h2>Upload attendance sheet</h2>
        <p>Upload CSV, XLS or XLSX from the attendance system. Required columns: <b>employee_no</b>, <b>date</b>, <b>status</b>. Optional: <b>overtime_hours</b>.</p>
        {error && <div className="error">{error}</div>}
        <div className="form-row">
          <label>Period start<input type="date" name="period_start" required /></label>
          <label>Period end<input type="date" name="period_end" required /></label>
        </div>
        <label>Attendance sheet<input type="file" name="file" accept=".csv,.xls,.xlsx" required /></label>
        <p>Accepted statuses: present, absent, paid_leave, holiday, off, half_day and no_pay.</p>
        <div className="actions">
          <button type="button" onClick={close}>Cancel</button>
          <button className="primary" disabled={busy}>{busy ? <Loader2 /> : <FileUp />} {busy ? "Validating..." : "Upload and validate"}</button>
        </div>
      </form>
    </div>
  );
}
function PayrollEditModal({
  type,
  row,
  token,
  close,
  saved,
}: {
  type: string;
  row: any;
  token: string;
  close: () => void;
  saved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget),
      body =
        type === "employee"
          ? {
              employee_no: f.get("employee_no"),
              name: f.get("name"),
              department: f.get("department"),
              designation: f.get("designation"),
              basic_salary: Number(f.get("basic_salary")),
              status: f.get("status"),
            }
          : {
              period_start: f.get("period_start"),
              period_end: f.get("period_end"),
              status: f.get("status"),
            };
    try {
      const path =
          type === "employee"
            ? `employees/${row.id}`
            : `payroll-runs/${row.id}`,
        r = await fetch(`${API}/${path}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        }),
        json = await r.json();
      if (!r.ok) throw new Error(json.message || "Update failed.");
      saved();
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className="modal"
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <span>PAYROLL RECORD</span>
        <h2>Edit {type === "employee" ? "Employee" : "Payroll Run"}</h2>
        {error && <div className="error">{error}</div>}
        {type === "employee" ? (
          <>
            <label>
              Employee number
              <input
                name="employee_no"
                required
                defaultValue={row.employee_no}
              />
            </label>
            <label>
              Name
              <input name="name" required defaultValue={row.name} />
            </label>
            <div className="form-row">
              <label>
                Department
                <input
                  name="department"
                  required
                  defaultValue={row.department}
                />
              </label>
              <label>
                Designation
                <input
                  name="designation"
                  required
                  defaultValue={row.designation}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Basic salary
                <input
                  name="basic_salary"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={row.basic_salary}
                />
              </label>
              <label>
                Status
                <select name="status" defaultValue={row.status}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="form-row">
              <label>
                Period start
                <input
                  name="period_start"
                  type="date"
                  required
                  defaultValue={row.period_start}
                />
              </label>
              <label>
                Period end
                <input
                  name="period_end"
                  type="date"
                  required
                  defaultValue={row.period_end}
                />
              </label>
            </div>
            <label>
              Status
              <select name="status" defaultValue={row.status}>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="posted">Posted</option>
                <option value="void">Void</option>
              </select>
            </label>
          </>
        )}
        <div className="actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
function ReportsPage({ token }: { token: string }) {
  const now = new Date(),
    [from, setFrom] = useState(`${now.getFullYear()}-01-01`),
    [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null),
    [financial, setFinancial] = useState<any>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("summary");
  const load = useCallback(() => {
    setError("");
    Promise.all([
      fetch(`${API}/reports/management`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API}/reports/financial-statements?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) throw new Error();
        setData(await a.json());
        setFinancial(await b.json());
      })
      .catch(() => setError("Unable to load financial reports."));
  }, [token, from, to]);
  useEffect(load, [load]);
  const download = async (report = selected) => {
    const r = await fetch(
      `${API}/reports/financial-statements/excel?from=${from}&to=${to}&report=${report}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) {
      setError("Excel export failed.");
      return;
    }
    const blob = await r.blob(),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `AeroSoft360_${report}_${to}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="heading">
        <div>
          <span>FINANCE AND MANAGEMENT ACCOUNTING</span>
          <h1>Financial Reports</h1>
          <p>
            Profit and loss, balance sheet, cash flow, trial balance and
            management summaries.
          </p>
        </div>
        <button className="primary" onClick={() => download()}>
          <FileText /> Download this report
        </button>
      </div>
      <div className="report-menu">
        {[
          ["summary", "Report centre"],
          ["profit_loss", "Profit and Loss"],
          ["balance_sheet", "Balance Sheet"],
          ["cash_flow", "Cash Flow"],
          ["trial_balance", "Trial Balance"],
        ].map(([key, label]) => (
          <button
            className={selected === key ? "active" : ""}
            onClick={() => setSelected(key)}
            key={key}
          >
            <FileText />
            <span>{label}</span>
            <small>Open report →</small>
          </button>
        ))}
      </div>
      <div className="report-filters">
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button onClick={load}>Apply period</button>
      </div>
      {error && <div className="error">{error}</div>}
      {!data || !financial ? (
        <div className="loading">
          <Loader2 /> Loading reports…
        </div>
      ) : (
        <>
          <div className="kpis">
            <article>
              <span>Revenue</span>
              <b>{money(financial.profit_loss.revenue)}</b>
              <small>Posted income</small>
            </article>
            <article>
              <span>Net profit</span>
              <b>{money(financial.profit_loss.net_profit)}</b>
              <small>Revenue less expenses</small>
            </article>
            <article>
              <span>Total assets</span>
              <b>{money(financial.balance_sheet.assets_total)}</b>
              <small>Balance sheet assets</small>
            </article>
            <article>
              <span>Net cash change</span>
              <b>{money(financial.cash_flow.net_change)}</b>
              <small>Cash and bank accounts</small>
            </article>
          </div>
          <FinancialReportView selected={selected} financial={financial} />
          <div className="panels">
            <section>
              <div className="panel-head">
                <h2>Purchases by status</h2>
              </div>
              {data.purchase_by_status.map((x: any) => (
                <div className="report-row" key={x.status}>
                  <span>{x.status.replace("_", " ")}</span>
                  <b>{x.records} records</b>
                  <strong>{money(x.total)}</strong>
                </div>
              ))}
            </section>
            <section>
              <div className="panel-head">
                <h2>Payroll by department</h2>
              </div>
              {data.payroll_by_department.map((x: any) => (
                <div className="report-row" key={x.department}>
                  <span>{x.department}</span>
                  <strong>{money(x.total)}</strong>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </>
  );
}
function FinancialReportView({
  selected,
  financial,
}: {
  selected: string;
  financial: any;
}) {
  if (selected === "profit_loss")
    return (
      <div className="statement-page">
        <Statement
          title="Profit and Loss"
          rows={[
            ["Revenue", financial.profit_loss.revenue],
            ["Expenses", financial.profit_loss.expenses_total],
            ["Net profit", financial.profit_loss.net_profit],
          ]}
        />
      </div>
    );
  if (selected === "balance_sheet")
    return (
      <div className="statement-page">
        <Statement
          title="Assets"
          rows={[
            ...financial.balance_sheet.assets.map((x:any)=>[`${x.code} ${x.account}`,x.amount] as [string,number]),
            ["Total assets", financial.balance_sheet.assets_total],
          ]}
        />
        <Statement
          title="Liabilities"
          rows={[
            ...financial.balance_sheet.liabilities.map((x:any)=>[`${x.code} ${x.account}`,x.amount] as [string,number]),
            ["Total liabilities", financial.balance_sheet.liabilities_total],
          ]}
        />
        <Statement
          title="Equity"
          rows={[
            ...financial.balance_sheet.equity.map((x:any)=>[`${x.code} ${x.account}`,x.amount] as [string,number]),
            ["Current-period profit", financial.balance_sheet.current_profit],
            ["Total equity", financial.balance_sheet.equity_total],
            ["Liabilities plus equity", financial.balance_sheet.liabilities_equity_total],
            ["Difference", financial.balance_sheet.difference],
          ]}
        />
      </div>
    );
  if (selected === "cash_flow")
    return (
      <div className="statement-page">
        <Statement
          title="Cash Flow"
          rows={[
            ["Operating activities", financial.cash_flow.operating],
            ["Investing activities", financial.cash_flow.investing],
            ["Financing activities", financial.cash_flow.financing],
            ["Net cash change", financial.cash_flow.net_change],
          ]}
        />
      </div>
    );
  if (selected === "trial_balance")
    return (
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {financial.trial_balance.map((x: any) => (
              <tr key={x.code}>
                <td>{x.code}</td>
                <td>{x.account}</td>
                <td>{x.type}</td>
                <td>{money(x.debit)}</td>
                <td>{money(x.credit)}</td>
                <td>{money(x.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <div className="statement-grid">
      <Statement
        title="Profit and Loss"
        rows={[
          ["Revenue", financial.profit_loss.revenue],
          ["Expenses", financial.profit_loss.expenses_total],
          ["Net profit", financial.profit_loss.net_profit],
        ]}
      />
      <Statement
        title="Balance Sheet"
        rows={[
          ["Total assets", financial.balance_sheet.assets_total],
          ["Total liabilities", financial.balance_sheet.liabilities_total],
          ["Total equity", financial.balance_sheet.equity_total],
          ["Liabilities plus equity", financial.balance_sheet.liabilities_equity_total],
          ["Difference", financial.balance_sheet.difference],
        ]}
      />
      <Statement
        title="Cash Flow"
        rows={[
          ["Operating activities", financial.cash_flow.operating],
          ["Investing activities", financial.cash_flow.investing],
          ["Financing activities", financial.cash_flow.financing],
          ["Net cash change", financial.cash_flow.net_change],
        ]}
      />
    </div>
  );
}
function Statement({
  title,
  rows,
}: {
  title: string;
  rows: [string, number][];
}) {
  return (
    <section className="statement">
      <h2>{title}</h2>
      {rows.map(([label, value], i) => (
        <div
          className={i === rows.length - 1 ? "statement-total" : ""}
          key={label}
        >
          <span>{label}</span>
          <b>{money(value)}</b>
        </div>
      ))}
    </section>
  );
}
