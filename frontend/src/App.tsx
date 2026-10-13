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
  Users,
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
    ["Customer POs", ClipboardCheck],
    ["Sales Orders", FileText],
    ["Invoices", FileText],
    ["Collections", Check],
    ["Receivables Aging", ShieldCheck],
    ["Commissions", FileText],
    ["Customers", Building2],
    ["Salespersons", Users],
    ["Articles & Sets", PackagePlus],
    ["Employees", Users],
    ["Payroll", Building2],
    ["Reports", FileText],
    ["Suppliers", Building2],
    ["Purchase Orders", FileText],
    ["Receive Goods", ClipboardCheck],
    ["Raw Material Stock", Warehouse],
    ["General Ledger", ShieldCheck],
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
          <label>SALES TO COLLECTION</label>
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
          {[
            "Dashboard",
            "Customers",
            "Salespersons",
            "Articles & Sets",
            "Customer POs",
            "Sales Orders",
            "Invoices",
            "Collections",
            "Receivables Aging",
            "Commissions",
          ].includes(page) ? (
            <SalesPage token={token() || ""} page={page} go={setPage} />
          ) : page === "Employees" ? (
            <EmployeesPage token={token() || ""} />
          ) : page === "Payroll" ? (
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

function SalesPage({
  token,
  page,
  go,
}: {
  token: string;
  page: string;
  go: (page: string) => void;
}) {
  const [data, setData] = useState<any>(null),
    [aging, setAging] = useState<any>(null),
    [error, setError] = useState(""),
    [modal, setModal] = useState(""),
    [editingArticle, setEditingArticle] = useState<any>(null),
    [dispatchOrder, setDispatchOrder] = useState<any>(null),
    [viewing, setViewing] = useState<any>(null);
  const loadSales = useCallback(() => {
    setError("");
    Promise.all([
      fetch(`${API}/sales/workspace`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API}/sales/aging`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) throw new Error();
        setData(await a.json());
        setAging(await b.json());
        setError("");
      })
      .catch(() => setError("Unable to load sales workspace."));
  }, [token]);
  useEffect(loadSales, [loadSales]);
  const post = async (path: string, body?: any, method = "POST") => {
    const response = await fetch(`${API}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json();
    if (!response.ok)
      throw new Error(
        json.message ||
          Object.values(json.errors || {})
            .flat()
            .join(" ") ||
          "Request failed.",
      );
    await loadSales();
    return json;
  };
  if (!data || !aging)
    return (
      <div className="loading">
        <Loader2 /> Loading sales workspace...
      </div>
    );
  if (page === "Dashboard")
    return (
      <>
        <div className="heading">
          <div>
            <span>SALES AND RECEIVABLES ERP</span>
            <h1>Sales Dashboard</h1>
            <p>
              Customer orders, invoicing, collections, aging and commission in
              one controlled flow.
            </p>
          </div>
          <button className="primary" onClick={() => setModal("po")}>
            <Plus /> New customer PO
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="kpis">
          <article>
            <span>Customers</span>
            <b>{data.customers.length}</b>
            <small>Active customer accounts</small>
          </article>
          <article>
            <span>Open credit invoices</span>
            <b>
              {
                data.invoices.filter((x: any) => Number(x.outstanding) > 0)
                  .length
              }
            </b>
            <small>{money(aging.total)} outstanding</small>
          </article>
          <article>
            <span>Collections received</span>
            <b>
              {money(
                data.receipts.reduce(
                  (s: number, x: any) => s + Number(x.amount),
                  0,
                ),
              )}
            </b>
            <small>Allocated customer receipts</small>
          </article>
          <article>
            <span>Commission earned</span>
            <b>
              {money(
                data.commissions.reduce(
                  (s: number, x: any) => s + Number(x.commission_amount),
                  0,
                ),
              )}
            </b>
            <small>Collection-based eligible commission</small>
          </article>
        </div>
        <div className="flow-card">
          <h2>Customer order to commission</h2>
          <p>
            The customer and article data continues through every step without
            re-entry.
          </p>
          <div className="flow">
            {[
              ["1", "Customer PO", "Customer POs"],
              ["2", "Sales Order", "Sales Orders"],
              ["3", "Size Expansion", "Articles & Sets"],
              ["4", "Invoice", "Invoices"],
              ["5", "Collection", "Collections"],
              ["6", "Commission", "Commissions"],
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
              <h2>Recent invoices</h2>
              <button onClick={() => go("Invoices")}>View all</button>
            </div>
            {data.invoices.slice(0, 5).map((x: any) => (
              <div className="list-row" key={x.id}>
                <FileText />
                <span>
                  <b>{x.number}</b>
                  <small>
                    {x.customer_name} · {x.rep_name}
                  </small>
                </span>
                <strong>{money(x.outstanding)}</strong>
                {status(x.status)}
              </div>
            ))}
          </section>
          <section>
            <div className="panel-head">
              <h2>Recent collections</h2>
              <button onClick={() => go("Collections")}>View all</button>
            </div>
            {data.receipts.slice(0, 5).map((x: any) => (
              <div className="list-row" key={x.id}>
                <Check />
                <span>
                  <b>{x.number}</b>
                  <small>
                    {x.customer_name} · {x.receipt_date}
                  </small>
                </span>
                <strong>{money(x.amount)}</strong>
              </div>
            ))}
          </section>
        </div>
        {modal && (
          <SalesCreateModal
            type={modal}
            data={data}
            close={() => setModal("")}
            save={async (path, body) => {
              try {
                setError("");
                await post(path, body);
                setModal("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        )}
      </>
    );
  const map: any = {
    Customers: data.customers,
    Salespersons: data.reps,
    "Articles & Sets": data.articles,
    "Customer POs": data.pos,
    "Sales Orders": data.orders,
    Invoices: data.invoices,
    Collections: data.receipts,
    "Receivables Aging": aging.rows,
    Commissions: data.commissions,
  };
  const rows = map[page] || [];
  const addType: any = {
    Customers: "customer",
    Salespersons: "rep",
    "Articles & Sets": "article",
    "Customer POs": "po",
    Collections: "receipt",
  };
  const heads: any = {
    Customers: ["Customer", "Phone", "Credit terms", "Credit limit", "Status"],
    Salespersons: [
      "Representative",
      "Manager",
      "Channel",
      "Default rate",
      "Status",
    ],
    "Articles & Sets": [
      "Article",
      "Category",
      "Set types",
      "Size, quantity and price",
    ],
    "Customer POs": [
      "PO",
      "Customer",
      "Salesperson",
      "Date",
      "Sale type",
      "Total",
      "Status",
    ],
    "Sales Orders": [
      "Sales order",
      "Customer",
      "Salesperson",
      "Date",
      "Total",
      "Status",
    ],
    Invoices: [
      "Invoice",
      "Customer",
      "Salesperson",
      "Invoice/Due",
      "Type",
      "Total",
      "Received",
      "Outstanding",
      "Status",
    ],
    Collections: [
      "Receipt",
      "Customer",
      "Collected by",
      "Date",
      "Method",
      "Amount",
    ],
    "Receivables Aging": [
      "Invoice",
      "Customer",
      "Salesperson",
      "Due date",
      "Days overdue",
      "Bucket",
      "Outstanding",
    ],
    Commissions: [
      "Collected by",
      "Customer",
      "Invoice",
      "Receipt",
      "Collected",
      "Days",
      "Rate",
      "Eligibility",
      "Commission",
    ],
  };
  return (
    <>
      <div className="heading">
        <div>
          <span>SALES OPERATIONS</span>
          <h1>{page}</h1>
          <p>
            Sales-first transaction records linked from customer order through
            collection.
          </p>
        </div>
        {addType[page] && (
          <button className="primary" onClick={() => setModal(addType[page])}>
            <Plus />{" "}
            {page === "Collections"
              ? "Record collection"
              : `Add ${page.replace(/s$/, "")}`}
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              {heads[page].map((h: string) => (
                <th key={h}>{h}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={heads[page].length + 1}>No records yet.</td>
              </tr>
            ) : (
              rows.map((r: any) => (
                <tr key={r.id}>
                  {salesCells(page, r)}
                  <td>
                    <div className="row-actions">
                      {page === "Customer POs" && r.status === "draft" && (
                        <button
                          className="approve"
                          onClick={async () => {
                            try {
                              await post(`customer-pos/${r.id}/convert`);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          <Check /> Create sales order
                        </button>
                      )}
                      {page === "Sales Orders" &&
                        r.lines?.some((line: any) => Number(line.remaining_quantity) > 0) && (
                          <button className="approve" onClick={() => setDispatchOrder(r)}>
                            <FileText /> Dispatch &amp; invoice
                          </button>
                        )}
                      <button
                        className="icon-action view"
                        onClick={() => setViewing(r)}
                      >
                        <Eye />
                      </button>
                      {page === "Articles & Sets" && (
                        <button
                          className="icon-action edit"
                          title="Edit article, set types and sizes"
                          onClick={() => setEditingArticle(r)}
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
      {modal && (
        <SalesCreateModal
          type={modal}
          data={data}
          close={() => setModal("")}
          save={async (path, body) => {
            try {
              setError("");
              await post(path, body);
              setModal("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}{" "}
      {editingArticle && (
        <SalesCreateModal
          type="article"
          data={data}
          initial={editingArticle}
          close={() => setEditingArticle(null)}
          save={async (path, body, method) => {
            try {
              setError("");
              await post(path, body, method);
              setEditingArticle(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {dispatchOrder && (
        <DispatchInvoiceModal
          order={dispatchOrder}
          close={() => setDispatchOrder(null)}
          save={async (body) => {
            try {
              setError("");
              await post(`sales-orders/${dispatchOrder.id}/invoice`, body);
              setDispatchOrder(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {viewing && (
        <RecordView page={page} row={viewing} close={() => setViewing(null)} />
      )}
    </>
  );
}
function salesCells(page: string, r: any) {
  if (page === "Customers")
    return (
      <>
        <td>
          <b>{r.code}</b>
          <br />
          {r.name}
        </td>
        <td>{r.phone || "—"}</td>
        <td>{r.credit_days} days</td>
        <td>{money(r.credit_limit)}</td>
        <td>{status(r.status)}</td>
      </>
    );
  if (page === "Salespersons")
    return (
      <>
        <td>
          <b>{r.code}</b>
          <br />
          {r.name}
        </td>
        <td>{r.manager_name || "—"}</td>
        <td>{r.channel.replaceAll("_", " ")}</td>
        <td>{money(r.default_commission_rate)}</td>
        <td>{status(r.status)}</td>
      </>
    );
  if (page === "Articles & Sets")
    return (
      <>
        <td>
          <b>{r.code}</b>
          <br />
          {r.name}
        </td>
        <td>{r.category}</td>
        <td>
          {r.sets.map((set: any) => (
            <div key={set.id}>
              <b>{set.name}</b>
              <br />
              <small>
                {set.pieces} pieces · {money(set.set_price)} per set
              </small>
            </div>
          ))}
        </td>
        <td>
          {r.sets.map((set: any) => (
            <div key={set.id}>
              <b>{set.name}:</b>{" "}
              {set.items
                .map(
                  (item: any) =>
                    `${item.size_label} × ${Number(item.quantity)} @ ${money(item.unit_price)}`,
                )
                .join(", ")}
            </div>
          ))}
        </td>
      </>
    );
  if (page === "Customer POs")
    return (
      <>
        <td>
          <b>{r.number}</b>
          <br />
          <small>{r.customer_po_reference || "No customer reference"}</small>
        </td>
        <td>{r.customer_name}</td>
        <td>{r.rep_name}</td>
        <td>{r.po_date}</td>
        <td>{r.sale_type}</td>
        <td>{money(r.total)}</td>
        <td>{status(r.status)}</td>
      </>
    );
  if (page === "Sales Orders")
    return (
      <>
        <td>
          <b>{r.number}</b>
        </td>
        <td>{r.customer_name}</td>
        <td>{r.rep_name}</td>
        <td>{r.order_date}</td>
        <td>{money(r.total)}</td>
        <td>{status(r.status)}</td>
      </>
    );
  if (page === "Invoices")
    return (
      <>
        <td>
          <b>{r.number}</b>
        </td>
        <td>{r.customer_name}</td>
        <td>{r.rep_name}</td>
        <td>
          {r.invoice_date}
          <br />
          <small>Due {r.due_date}</small>
        </td>
        <td>{r.sale_type}</td>
        <td>{money(r.total)}</td>
        <td>{money(r.received_amount)}</td>
        <td>{money(r.outstanding)}</td>
        <td>{status(r.status)}</td>
      </>
    );
  if (page === "Collections")
    return (
      <>
        <td>
          <b>{r.number}</b>
        </td>
        <td>{r.customer_name}</td>
        <td>{r.rep_name}</td>
        <td>{r.receipt_date}</td>
        <td>{r.payment_method.replaceAll("_", " ")}</td>
        <td>{money(r.amount)}</td>
      </>
    );
  if (page === "Receivables Aging")
    return (
      <>
        <td>
          <b>{r.number}</b>
        </td>
        <td>{r.customer_name}</td>
        <td>{r.rep_name}</td>
        <td>{r.due_date}</td>
        <td>{r.days_overdue}</td>
        <td>{status(r.bucket)}</td>
        <td>{money(r.outstanding)}</td>
      </>
    );
  return (
    <>
      <td>{r.rep_name}</td>
      <td>{r.customer_name}</td>
      <td>{r.invoice_number}</td>
      <td>
        {r.receipt_number}
        <br />
        <small>{r.receipt_date}</small>
      </td>
      <td>{money(r.amount)}</td>
      <td>{r.days_taken}</td>
      <td>{money(r.commission_rate)} / piece</td>
      <td>{status(r.commission_status)}</td>
      <td>
        <b>{money(r.commission_amount)}</b>
      </td>
    </>
  );
}
function DispatchInvoiceModal({ order, close, save }: { order: any; close: () => void; save: (body: any) => Promise<void> }) {
  const available = order.lines.filter((line: any) => Number(line.remaining_quantity) > 0);
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(available.map((line: any) => [line.id, Number(line.remaining_quantity)])),
  );
  const [busy, setBusy] = useState(false);
  const total = available.reduce(
    (sum: number, line: any) => sum + Number(quantities[line.id] || 0) * Number(line.rate),
    0,
  );
  return (
    <div className="backdrop" onMouseDown={close}>
      <form className="modal dispatch-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        const f = new FormData(e.currentTarget);
        try { await save({ invoice_date: f.get("invoice_date"), lines: available.map((line: any) => ({ sales_order_size_line_id: line.id, quantity: Number(quantities[line.id] || 0) })) }); }
        finally { setBusy(false); }
      }}>
        <button type="button" className="close" onClick={close}><X /></button>
        <span>PARTIAL FULFILMENT</span>
        <h2>Dispatch and create invoice</h2>
        <p>{order.number} — {order.customer_name}. Enter only the quantity being sent now; the balance remains as backorder.</p>
        <label>Invoice / dispatch date<input name="invoice_date" type="date" required /></label>
        <div className="dispatch-lines">
          <div className="dispatch-head"><b>Article / size</b><b>Ordered</b><b>Already invoiced</b><b>Remaining</b><b>Dispatch now</b><b>Amount</b></div>
          {available.map((line: any) => (
            <div className="dispatch-row" key={line.id}>
              <span><b>{line.article_code}</b><small>{line.article_name} · Size {line.size_label}</small></span>
              <span>{Number(line.quantity)}</span>
              <span>{Number(line.invoiced_quantity)}</span>
              <span>{Number(line.remaining_quantity)}</span>
              <input type="number" min="0" max={Number(line.remaining_quantity)} step="1" value={quantities[line.id] || 0} onChange={(e) => setQuantities((all) => ({ ...all, [line.id]: Number(e.target.value) }))} />
              <b>{money(Number(quantities[line.id] || 0) * Number(line.rate))}</b>
            </div>
          ))}
        </div>
        <div className="po-grand-total"><span>Invoice total for this dispatch</span><strong>{money(total)}</strong></div>
        <div className="modal-actions"><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={busy || total <= 0}><Check /> Create partial invoice</button></div>
      </form>
    </div>
  );
}

function SalesCreateModal({
  type,
  data,
  initial,
  close,
  save,
}: {
  type: string;
  data: any;
  initial?: any;
  close: () => void;
  save: (path: string, body: any, method?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [setTypes, setSetTypes] = useState<any[]>([
    ...(initial?.sets?.length
      ? initial.sets.map((set: any) => ({
          ...set,
          items: set.items.map((item: any) => ({ ...item })),
        }))
      : [
          {
            name: "Standard Set",
            items: [{ size_label: "", quantity: 2, unit_price: 0 }],
          },
        ]),
  ]);
  const firstSetId = Number(data.articles?.[0]?.sets?.[0]?.id || 0);
  const firstArticleId = Number(data.articles?.[0]?.id || 0);
  const firstItemId = Number(data.articles?.[0]?.sets?.[0]?.items?.[0]?.id || 0);
  const [poLines, setPoLines] = useState<any[]>([
    { article_id: firstArticleId, order_mode: "badge", set_template_id: firstSetId, set_item_id: firstItemId, quantity: 1 },
  ]);
  const availableSets = (data.articles || []).flatMap((article: any) =>
    article.sets
      .filter((set: any) => set.status !== "inactive")
      .map((set: any) => ({ ...set, article })),
  );
  const poLineTotal = (line: any) => {
    const unitPrice = line.order_mode === "badge"
      ? Number(availableSets.find((set: any) => Number(set.id) === Number(line.set_template_id))?.set_price || 0)
      : Number(data.articles.flatMap((article: any) => article.sets.flatMap((set: any) => set.items)).find((item: any) => Number(item.id) === Number(line.set_item_id))?.unit_price || 0);
    return unitPrice * Number(line.quantity || 0);
  };
  const poGrandTotal = poLines.reduce(
    (total: number, line: any) => total + poLineTotal(line),
    0,
  );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    let path = "",
      body: any = {};
    if (type === "customer") {
      path = "customers";
      body = {
        code: f.get("code"),
        name: f.get("name"),
        tin: f.get("tin"),
        phone: f.get("phone"),
        address: f.get("address"),
        credit_days: Number(f.get("credit_days")),
        credit_limit: Number(f.get("credit_limit")),
      };
    } else if (type === "rep") {
      path = "sales-reps";
      body = {
        code: f.get("code"),
        name: f.get("name"),
        manager_name: f.get("manager_name"),
        channel: f.get("channel"),
        default_commission_rate: Number(f.get("default_commission_rate")),
      };
    } else if (type === "article") {
      path = initial ? `articles/${initial.id}` : "articles";
      body = {
        code: f.get("code"),
        name: f.get("name"),
        category: f.get("category"),
        status: initial?.status || "active",
        sets: setTypes,
      };
    } else if (type === "po") {
      path = "customer-pos";
      body = {
        customer_id: Number(f.get("customer_id")),
        sales_rep_id: Number(f.get("sales_rep_id")),
        customer_po_reference: f.get("customer_po_reference"),
        po_date: f.get("po_date"),
        sale_type: f.get("sale_type"),
        lines: poLines,
      };
    } else {
      path = "customer-receipts";
      body = {
        invoice_id: Number(f.get("invoice_id")),
        sales_rep_id: Number(f.get("sales_rep_id")),
        receipt_date: f.get("receipt_date"),
        payment_method: f.get("payment_method"),
        reference: f.get("reference"),
        amount: Number(f.get("amount")),
        commission_rate: Number(f.get("commission_rate")),
      };
    }
    try {
      await save(path, body, initial && type === "article" ? "PUT" : "POST");
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
        <span>SALES MASTER AND TRANSACTION</span>
        <h2>
          {type === "po"
            ? "New Customer PO"
            : type === "receipt"
              ? "Record Customer Collection"
              : initial && type === "article"
                ? "Edit article and set types"
                : `Add ${type}`}
        </h2>
        {type === "customer" ? (
          <>
            <div className="form-row">
              <label>
                Customer code
                <input name="code" required />
              </label>
              <label>
                Customer name
                <input name="name" required />
              </label>
              <label>
                TIN
                <input name="tin" />
              </label>
              <label>
                Phone
                <input name="phone" />
              </label>
              <label>
                Credit days
                <input
                  name="credit_days"
                  type="number"
                  defaultValue="30"
                  required
                />
              </label>
              <label>
                Credit limit
                <input
                  name="credit_limit"
                  type="number"
                  defaultValue="0"
                  required
                />
              </label>
            </div>
            <label>
              Address
              <input name="address" />
            </label>
          </>
        ) : type === "rep" ? (
          <>
            <div className="form-row">
              <label>
                Rep code
                <input name="code" required />
              </label>
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Sales manager
                <input name="manager_name" />
              </label>
              <label>
                Channel
                <select name="channel">
                  <option value="direct_sales">Direct Sales</option>
                  <option value="head_office">Head Office</option>
                  <option value="future_channel">Future Channel</option>
                </select>
              </label>
            </div>
            <label>
              Default commission rate per piece
              <input
                name="default_commission_rate"
                type="number"
                step=".01"
                defaultValue="0"
                required
              />
            </label>
          </>
        ) : type === "article" ? (
          <>
            <div className="form-row">
              <label>
                Article code
                <input name="code" defaultValue={initial?.code} required />
              </label>
              <label>
                Article name
                <input name="name" defaultValue={initial?.name} required />
              </label>
              <label>
                Category
                <input name="category" defaultValue={initial?.category} required />
              </label>
            </div>
            <div className="set-builder">
              {setTypes.map((set, setIndex) => (
                <section key={setIndex}>
                  <div className="set-builder-head">
                    <label>
                      Set type name
                      <input
                        value={set.name}
                        onChange={(e) =>
                          setSetTypes((all) =>
                            all.map((x, i) =>
                              i === setIndex
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          )
                        }
                        required
                      />
                    </label>
                    {setTypes.length > 1 && (
                      <button
                        type="button"
                        className="icon-action delete"
                        onClick={() =>
                          setSetTypes((all) =>
                            all.filter((_, i) => i !== setIndex),
                          )
                        }
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                  <div className="set-size-head">
                    <span>Size</span>
                    <span>Pieces in set</span>
                    <span>Price per piece</span>
                    <span></span>
                  </div>
                  {set.items.map((item: any, itemIndex: number) => (
                    <div className="set-size-row" key={itemIndex}>
                      <input
                        placeholder="Size"
                        value={item.size_label}
                        onChange={(e) =>
                          setSetTypes((all) =>
                            all.map((x, i) =>
                              i === setIndex
                                ? {
                                    ...x,
                                    items: x.items.map((v: any, j: number) =>
                                      j === itemIndex
                                        ? { ...v, size_label: e.target.value }
                                        : v,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                        required
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          setSetTypes((all) =>
                            all.map((x, i) =>
                              i === setIndex
                                ? {
                                    ...x,
                                    items: x.items.map((v: any, j: number) =>
                                      j === itemIndex
                                        ? {
                                            ...v,
                                            quantity: Number(e.target.value),
                                          }
                                        : v,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) =>
                          setSetTypes((all) =>
                            all.map((x, i) =>
                              i === setIndex
                                ? {
                                    ...x,
                                    items: x.items.map((v: any, j: number) =>
                                      j === itemIndex
                                        ? {
                                            ...v,
                                            unit_price: Number(e.target.value),
                                          }
                                        : v,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                        required
                      />
                      <button
                        type="button"
                        className="icon-action delete"
                        disabled={set.items.length === 1}
                        onClick={() =>
                          setSetTypes((all) =>
                            all.map((x, i) =>
                              i === setIndex
                                ? {
                                    ...x,
                                    items: x.items.filter(
                                      (_: any, j: number) => j !== itemIndex,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-row"
                    onClick={() =>
                      setSetTypes((all) =>
                        all.map((x, i) =>
                          i === setIndex
                            ? {
                                ...x,
                                items: [
                                  ...x.items,
                                  {
                                    size_label: "",
                                    quantity: 1,
                                    unit_price: 0,
                                  },
                                ],
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    <Plus /> Add size
                  </button>
                </section>
              ))}
              <button
                type="button"
                className="secondary-action"
                onClick={() =>
                  setSetTypes((all) => [
                    ...all,
                    {
                      name: `Set Type ${all.length + 1}`,
                      items: [{ size_label: "", quantity: 1, unit_price: 0 }],
                    },
                  ])
                }
              >
                <Plus /> Add another set type
              </button>
            </div>
          </>
        ) : type === "po" ? (
          <>
            <div className="form-row">
              <label>
                Customer
                <select name="customer_id">
                  {data.customers.map((x: any) => (
                    <option value={x.id} key={x.id}>
                      {x.code} — {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Salesperson
                <select name="sales_rep_id">
                  {data.reps.map((x: any) => (
                    <option value={x.id} key={x.id}>
                      {x.code} — {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Customer PO reference
                <input name="customer_po_reference" />
              </label>
              <label>
                PO date
                <input name="po_date" type="date" required />
              </label>
              <label>
                Sale type
                <select name="sale_type">
                  <option value="credit">Credit sale</option>
                  <option value="cash">Cash sale</option>
                  <option value="mixed">Part cash / credit</option>
                </select>
              </label>
            </div>
            <div className="po-lines">
              <div className="po-lines-head">
                <div><b>PO articles</b><small>Order complete badges and individual article sizes together.</small></div>
                <button type="button" className="secondary-action" onClick={() => setPoLines((lines) => [...lines, { article_id: firstArticleId, order_mode: "badge", set_template_id: firstSetId, set_item_id: firstItemId, quantity: 1 }])}><Plus /> Add article</button>
              </div>
              {poLines.map((line, index) => (
                <div className="po-line" key={index}>
                  <label>Article
                    <select value={line.article_id} onChange={(e) => { const article=data.articles.find((a:any)=>Number(a.id)===Number(e.target.value)); const set=article?.sets?.find((s:any)=>s.status!=="inactive"); setPoLines((lines) => lines.map((x, i) => i === index ? { ...x, article_id: Number(e.target.value), set_template_id: Number(set?.id||0), set_item_id: Number(set?.items?.[0]?.id||0) } : x)); }} required>
                      {data.articles.map((article: any) => <option value={article.id} key={article.id}>{article.code} — {article.name}</option>)}
                    </select>
                  </label>
                  <label>Order as
                    <select value={line.order_mode} onChange={(e) => setPoLines((lines) => lines.map((x, i) => i === index ? { ...x, order_mode: e.target.value } : x))}>
                      <option value="badge">Complete badge</option><option value="size">Individual size</option>
                    </select>
                  </label>
                  <label>{line.order_mode === "badge" ? "Badge" : "Size"}
                    {line.order_mode === "badge" ? (
                      <select value={line.set_template_id} onChange={(e) => setPoLines((lines) => lines.map((x, i) => i === index ? { ...x, set_template_id: Number(e.target.value) } : x))} required>
                        {data.articles.find((a:any)=>Number(a.id)===Number(line.article_id))?.sets.filter((s:any)=>s.status!=="inactive").map((set:any)=><option value={set.id} key={set.id}>{set.name} ({set.pieces} pcs · {money(set.set_price)})</option>)}
                      </select>
                    ) : (
                      <select value={line.set_item_id} onChange={(e) => setPoLines((lines) => lines.map((x, i) => i === index ? { ...x, set_item_id: Number(e.target.value) } : x))} required>
                        {data.articles.find((a:any)=>Number(a.id)===Number(line.article_id))?.sets.flatMap((set:any)=>set.items.map((item:any)=><option value={item.id} key={item.id}>Size {item.size_label} · {money(item.unit_price)}</option>))}
                      </select>
                    )}
                  </label>
                  <label>{line.order_mode === "badge" ? "No. of badges" : "Pieces"}
                    <input type="number" step="1" min="1" value={line.quantity} onChange={(e) => setPoLines((lines) => lines.map((x, i) => i === index ? { ...x, quantity: Number(e.target.value) } : x))} required />
                  </label>
                  <div className="po-line-total">
                    <small>Line total</small>
                    <b>{money(poLineTotal(line))}</b>
                  </div>
                  <button type="button" className="icon-action delete" title="Remove article" disabled={poLines.length === 1} onClick={() => setPoLines((lines) => lines.filter((_, i) => i !== index))}><Trash2 /></button>
                </div>
              ))}
              <div className="po-grand-total">
                <span>Customer PO total</span>
                <strong>{money(poGrandTotal)}</strong>
              </div>
            </div>
          </>
        ) : (
          <>
            <label>
              Outstanding invoice
              <select name="invoice_id">
                {data.invoices
                  .filter((x: any) => Number(x.outstanding) > 0)
                  .map((x: any) => (
                    <option value={x.id} key={x.id}>
                      {x.number} — {x.customer_name} — {money(x.outstanding)}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Cash collected by
                <select name="sales_rep_id">
                  {data.reps.map((rep: any) => (
                    <option value={rep.id} key={rep.id}>
                      {rep.code} — {rep.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Receipt date
                <input name="receipt_date" type="date" required />
              </label>
              <label>
                Payment method
                <select name="payment_method">
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                </select>
              </label>
              <label>
                Amount
                <input
                  name="amount"
                  type="number"
                  step=".01"
                  min=".01"
                  required
                />
              </label>
              <label>
                Reference
                <input name="reference" />
              </label>
              <label>
                Approved commission rate per piece
                <input
                  name="commission_rate"
                  type="number"
                  min="0"
                  step=".01"
                  defaultValue="0"
                  required
                />
              </label>
            </div>
          </>
        )}
        <div className="actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? <Loader2 /> : <Check />} Save
          </button>
        </div>
      </form>
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
function EmployeesPage({ token }: { token: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [viewing, setViewing] = useState<any>(null),
    [settingsOpen, setSettingsOpen] = useState(false);
  const loadEmployees = useCallback(() => {
    fetch(`${API}/payroll`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError("Unable to load employees."));
  }, [token]);
  useEffect(loadEmployees, [loadEmployees]);
  const remove = async (employee: any) => {
    if (!window.confirm(`Delete employee ${employee.name}?`)) return;
    const response = await fetch(`${API}/employees/${employee.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.message || "Delete failed.");
      return;
    }
    loadEmployees();
  };
  const historyFor = (employee: any) =>
    data.runs.flatMap((run: any) =>
      run.items
        .filter((item: any) => item.employee_id === employee.id)
        .map((item: any) => ({
          ...item,
          payroll_number: run.number,
          period_start: run.period_start,
          period_end: run.period_end,
          payroll_status: run.status,
        })),
    );
  return (
    <>
      <div className="heading">
        <div>
          <span>HUMAN RESOURCES</span>
          <h1>Employees</h1>
          <p>
            Employee profiles, salary settings and complete payroll history.
          </p>
        </div>
        <button
          className="primary"
          onClick={() =>
            setEditing({
              employee_no: "",
              name: "",
              department: "",
              designation: "",
              basic_salary: 0,
              status: "active",
            })
          }
        >
          <Plus /> Add employee
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {!data ? (
        <div className="loading">
          <Loader2 /> Loading employees...
        </div>
      ) : (
        <>
          <div className="kpis">
            <article>
              <span>Total employees</span>
              <b>{data.employees.length}</b>
              <small>All employee master records</small>
            </article>
            <article>
              <span>Active employees</span>
              <b>
                {
                  data.employees.filter((item: any) => item.status === "active")
                    .length
                }
              </b>
              <small>Included in payroll processing</small>
            </article>
            <article>
              <span>Monthly basic salaries</span>
              <b>
                {money(
                  data.employees.reduce(
                    (sum: number, item: any) => sum + Number(item.basic_salary),
                    0,
                  ),
                )}
              </b>
              <small>Current active salary master</small>
            </article>
            <article>
              <span>Payroll history</span>
              <b>{data.runs.length}</b>
              <small>Recorded payroll periods</small>
            </article>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Basic salary</th>
                  <th>Fixed gross</th>
                  <th>History</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((employee: any) => (
                  <tr key={employee.id}>
                    <td>
                      <b>{employee.employee_no}</b>
                      <br />
                      {employee.name}
                    </td>
                    <td>{employee.department}</td>
                    <td>{employee.designation}</td>
                    <td>{money(employee.basic_salary)}</td>
                    <td>
                      {money(
                        Number(employee.basic_salary) +
                          Number(employee.fixed_allowance || 0) +
                          Number(employee.fixed_incentive || 0),
                      )}
                    </td>
                    <td>{historyFor(employee).length} payroll records</td>
                    <td>{status(employee.status)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-action view"
                          title="View employee and salary history"
                          onClick={() =>
                            setViewing({
                              employee,
                              history: historyFor(employee),
                            })
                          }
                        >
                          <Eye />
                        </button>
                        <button
                          className="icon-action download"
                          title="Payroll settings"
                          onClick={() => {
                            setEditing(employee);
                            setSettingsOpen(true);
                          }}
                        >
                          <Settings />
                        </button>
                        <button
                          className="icon-action edit"
                          title="Edit employee"
                          onClick={() => setEditing(employee)}
                        >
                          <Pencil />
                        </button>
                        <button
                          className="icon-action delete"
                          title="Delete employee"
                          onClick={() => remove(employee)}
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
        <EmployeeProfileModal
          employee={viewing.employee}
          history={viewing.history}
          close={() => setViewing(null)}
        />
      )}
      {editing && !settingsOpen && (
        <PayrollEditModal
          type="employee"
          row={editing}
          token={token}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            loadEmployees();
          }}
        />
      )}
      {settingsOpen && data && (
        <PayrollSettingsModal
          employees={[
            editing,
            ...data.employees.filter((item: any) => item.id !== editing?.id),
          ]}
          token={token}
          close={() => {
            setSettingsOpen(false);
            setEditing(null);
          }}
          saved={() => {
            setSettingsOpen(false);
            setEditing(null);
            loadEmployees();
          }}
        />
      )}
    </>
  );
}
function EmployeeProfileModal({
  employee,
  history,
  close,
}: {
  employee: any;
  history: any[];
  close: () => void;
}) {
  return (
    <div className="backdrop" onMouseDown={close}>
      <div
        className="modal employee-profile-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close" onClick={close}>
          <X />
        </button>
        <span>EMPLOYEE PROFILE</span>
        <h2>{employee.name}</h2>
        <p>
          {employee.employee_no} · {employee.department} ·{" "}
          {employee.designation}
        </p>
        <div className="detail-grid">
          <div>
            <small>Basic salary</small>
            <b>{money(employee.basic_salary)}</b>
          </div>
          <div>
            <small>Fixed allowance</small>
            <b>{money(employee.fixed_allowance || 0)}</b>
          </div>
          <div>
            <small>Fixed incentive</small>
            <b>{money(employee.fixed_incentive || 0)}</b>
          </div>
          <div>
            <small>Fixed deduction</small>
            <b>{money(employee.fixed_deduction || 0)}</b>
          </div>
          <div>
            <small>EPF rate</small>
            <b>{employee.epf_rate}%</b>
          </div>
          <div>
            <small>Working days</small>
            <b>{employee.monthly_working_days}</b>
          </div>
          <div>
            <small>Monthly hours</small>
            <b>{employee.standard_month_hours}</b>
          </div>
          <div>
            <small>OT multiplier</small>
            <b>{employee.overtime_multiplier}x</b>
          </div>
        </div>
        <h3>Salary history</h3>
        <div className="table-card employee-history">
          <table>
            <thead>
              <tr>
                <th>Payroll</th>
                <th>Period</th>
                <th>Basic</th>
                <th>Allowances</th>
                <th>OT</th>
                <th>Deductions</th>
                <th>Net salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8}>No payroll history yet.</td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.payroll_number}</td>
                    <td>
                      {item.period_start} to {item.period_end}
                    </td>
                    <td>{money(item.basic_salary)}</td>
                    <td>
                      {money(Number(item.allowances) + Number(item.incentive))}
                    </td>
                    <td>{money(item.overtime)}</td>
                    <td>
                      {money(
                        Number(item.epf_employee) +
                          Number(item.other_deductions) +
                          Number(item.no_pay_amount || 0),
                      )}
                    </td>
                    <td>
                      <b>{money(item.net_salary)}</b>
                    </td>
                    <td>{status(item.payroll_status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <button onClick={close}>Close</button>
        </div>
      </div>
    </div>
  );
}
function PayrollPage({ token }: { token: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [viewing, setViewing] = useState<any>(null),
    [editing, setEditing] = useState<any>(null),
    [editType, setEditType] = useState(""),
    [attendanceOpen, setAttendanceOpen] = useState(false),
    [attendanceHistoryOpen, setAttendanceHistoryOpen] = useState(false),
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
      if (!response.ok)
        throw new Error(json.message || "Payroll calculation failed.");
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
          <button
            className="secondary-action"
            onClick={() => setAttendanceHistoryOpen(true)}
          >
            <ClipboardCheck /> Attendance files
          </button>
          <button
            className="secondary-action"
            onClick={() => setSettingsOpen(true)}
          >
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
                          onClick={() =>
                            downloadPayrollReport(
                              `payroll-runs/${r.id}/excel`,
                              `Payroll_${r.number}.xls`,
                            )
                          }
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
      {attendanceHistoryOpen && data && (
        <AttendanceFilesModal
          imports={data.imports}
          calculating={calculating}
          close={() => setAttendanceHistoryOpen(false)}
          upload={() => {
            setAttendanceHistoryOpen(false);
            setAttendanceOpen(true);
          }}
          view={(item) => {
            setAttendanceHistoryOpen(false);
            setViewing(item);
          }}
          calculate={calculatePayroll}
          download={downloadPayrollReport}
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
function AttendanceFilesModal({
  imports,
  calculating,
  close,
  upload,
  view,
  calculate,
  download,
}: {
  imports: any[];
  calculating: number | null;
  close: () => void;
  upload: () => void;
  view: (item: any) => void;
  calculate: (id: number) => void;
  download: (path: string, fileName: string) => void;
}) {
  return (
    <div className="backdrop" onMouseDown={close}>
      <div
        className="modal attendance-history-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <span>ATTENDANCE MANAGEMENT</span>
        <div className="attendance-modal-heading">
          <div>
            <h2>Attendance files</h2>
            <p>
              Review imported attendance separately before creating payroll.
            </p>
          </div>
          <button type="button" className="primary" onClick={upload}>
            <FileUp /> Upload attendance
          </button>
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
              {imports.length === 0 ? (
                <tr>
                  <td colSpan={8}>No attendance sheets uploaded yet.</td>
                </tr>
              ) : (
                imports.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.file_name}</b>
                      <br />
                      <small>{item.record_count} valid records</small>
                    </td>
                    <td>
                      {item.period_start} to {item.period_end}
                    </td>
                    <td>{item.employees}</td>
                    <td>{item.paid_days}</td>
                    <td>{item.no_pay_days}</td>
                    <td>{item.overtime_hours}</td>
                    <td>{status(item.status)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-action view"
                          onClick={() => view(item)}
                          title="View validation summary"
                        >
                          <Eye />
                        </button>
                        <button
                          className="icon-action download"
                          onClick={() =>
                            download(
                              `attendance/${item.id}/excel`,
                              `Attendance_${item.period_end}.xls`,
                            )
                          }
                          title="Download attendance report"
                        >
                          <FileText />
                        </button>
                        {item.status === "validated" && (
                          <button
                            className="approve"
                            disabled={calculating === item.id}
                            onClick={() => calculate(item.id)}
                          >
                            {calculating === item.id ? <Loader2 /> : <Check />}{" "}
                            Calculate payroll
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
        <div className="actions">
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
function PayrollSettingsModal({
  employees,
  token,
  close,
  saved,
}: {
  employees: any[];
  token: string;
  close: () => void;
  saved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(String(employees[0]?.id || ""));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const employee =
    employees.find((item) => String(item.id) === employeeId) || employees[0];
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      [
        "basic_salary",
        "fixed_allowance",
        "fixed_incentive",
        "fixed_deduction",
        "epf_rate",
        "monthly_working_days",
        "standard_month_hours",
        "overtime_multiplier",
      ].map((key) => [key, Number(form.get(key))]),
    );
    try {
      const response = await fetch(
        `${API}/employees/${employeeId}/payroll-settings`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.message || "Unable to save payroll settings.");
      saved();
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        key={employeeId}
        className="modal payroll-settings-modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <span>MANUAL SALARY MASTER</span>
        <h2>Payroll settings</h2>
        <p>
          Maintain salary values manually. Attendance uploads provide only paid
          days, no-pay days and overtime hours.
        </p>
        {error && <div className="error">{error}</div>}
        <label>
          Employee
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          >
            {employees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.employee_no} — {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Basic salary (LKR)
            <input
              type="number"
              step="0.01"
              min="0"
              name="basic_salary"
              required
              defaultValue={employee?.basic_salary || 0}
            />
          </label>
          <label>
            Fixed allowance (LKR)
            <input
              type="number"
              step="0.01"
              min="0"
              name="fixed_allowance"
              required
              defaultValue={employee?.fixed_allowance || 0}
            />
          </label>
          <label>
            Fixed incentive (LKR)
            <input
              type="number"
              step="0.01"
              min="0"
              name="fixed_incentive"
              required
              defaultValue={employee?.fixed_incentive || 0}
            />
          </label>
          <label>
            Other fixed deduction (LKR)
            <input
              type="number"
              step="0.01"
              min="0"
              name="fixed_deduction"
              required
              defaultValue={employee?.fixed_deduction || 0}
            />
          </label>
          <label>
            Employee EPF rate (%)
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              name="epf_rate"
              required
              defaultValue={employee?.epf_rate ?? 8}
            />
          </label>
          <label>
            Monthly working days
            <input
              type="number"
              step="0.5"
              min="1"
              max="31"
              name="monthly_working_days"
              required
              defaultValue={employee?.monthly_working_days ?? 26}
            />
          </label>
          <label>
            Standard monthly hours
            <input
              type="number"
              step="0.5"
              min="1"
              name="standard_month_hours"
              required
              defaultValue={employee?.standard_month_hours ?? 240}
            />
          </label>
          <label>
            Overtime multiplier
            <input
              type="number"
              step="0.01"
              min="0"
              name="overtime_multiplier"
              required
              defaultValue={employee?.overtime_multiplier ?? 1.5}
            />
          </label>
        </div>
        <div className="salary-preview">
          <span>Current fixed gross</span>
          <b>
            {money(
              Number(employee?.basic_salary || 0) +
                Number(employee?.fixed_allowance || 0) +
                Number(employee?.fixed_incentive || 0),
            )}
          </b>
        </div>
        <div className="actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? <Loader2 /> : <Check />} Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
function AttendanceUploadModal({
  token,
  close,
  saved,
}: {
  token: string;
  close: () => void;
  saved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData(event.currentTarget);
      const response = await fetch(`${API}/attendance/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body,
      });
      const json = await response.json();
      if (!response.ok) {
        const firstValidationError = json.errors
          ? Object.values(json.errors).flat()[0]
          : null;
        throw new Error(
          String(
            firstValidationError || json.message || "Attendance upload failed.",
          ),
        );
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
      <form
        className="modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="close" onClick={close}>
          <X />
        </button>
        <span>ATTENDANCE IMPORT</span>
        <h2>Upload attendance sheet</h2>
        <p>
          Upload CSV, XLS or XLSX from the attendance system. Required columns:{" "}
          <b>employee_no</b>, <b>date</b>, <b>status</b>. Optional:{" "}
          <b>overtime_hours</b>.
        </p>
        {error && <div className="error">{error}</div>}
        <div className="form-row">
          <label>
            Period start
            <input type="date" name="period_start" required />
          </label>
          <label>
            Period end
            <input type="date" name="period_end" required />
          </label>
        </div>
        <label>
          Attendance sheet
          <input type="file" name="file" accept=".csv,.xls,.xlsx" required />
        </label>
        <p>
          Accepted statuses: present, absent, paid_leave, holiday, off, half_day
          and no_pay.
        </p>
        <div className="actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? <Loader2 /> : <FileUp />}{" "}
            {busy ? "Validating..." : "Upload and validate"}
          </button>
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
      const creatingEmployee = type === "employee" && !row.id;
      const path =
          type === "employee"
            ? creatingEmployee
              ? "employees"
              : `employees/${row.id}`
            : `payroll-runs/${row.id}`,
        r = await fetch(`${API}/${path}`, {
          method: creatingEmployee ? "POST" : "PUT",
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
        <h2>
          {type === "employee" && !row.id
            ? "Add Employee"
            : `Edit ${type === "employee" ? "Employee" : "Payroll Run"}`}
        </h2>
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
            {busy
              ? "Saving…"
              : type === "employee" && !row.id
                ? "Add employee"
                : "Save changes"}
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
    [aging, setAging] = useState<any>(null),
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
      fetch(`${API}/reports/aging?as_of=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
      .then(async ([a, b, c]) => {
        if (!a.ok || !b.ok || !c.ok) throw new Error();
        setData(await a.json());
        setFinancial(await b.json());
        setAging(await c.json());
      })
      .catch(() => setError("Unable to load financial reports."));
  }, [token, from, to]);
  useEffect(load, [load]);
  const download = async (report = selected) => {
    const isAging = report === "aging";
    const r = await fetch(
      isAging
        ? `${API}/reports/aging/excel?as_of=${to}`
        : `${API}/reports/financial-statements/excel?from=${from}&to=${to}&report=${report}`,
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
    a.download = isAging
      ? `Accounts_Payable_Aging_${to}.xls`
      : `AeroSoft360_${report}_${to}.xls`;
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
          ["aging", "Payables Aging"],
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
      {!data || !financial || !aging ? (
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
          {selected === "aging" ? (
            <AgingReportView aging={aging} />
          ) : (
            <FinancialReportView selected={selected} financial={financial} />
          )}
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
function AgingReportView({ aging }: { aging: any }) {
  const totals = aging.totals;
  return (
    <div className="aging-report">
      <div className="aging-summary">
        <article>
          <span>Current</span>
          <b>{money(totals.current)}</b>
        </article>
        <article>
          <span>1–30 days</span>
          <b>{money(totals.days_1_30)}</b>
        </article>
        <article>
          <span>31–60 days</span>
          <b>{money(totals.days_31_60)}</b>
        </article>
        <article>
          <span>61–90 days</span>
          <b>{money(totals.days_61_90)}</b>
        </article>
        <article>
          <span>90+ days</span>
          <b>{money(totals.days_90_plus)}</b>
        </article>
        <article className="aging-total">
          <span>Total outstanding</span>
          <b>{money(totals.total)}</b>
        </article>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Invoice</th>
              <th>Invoice date</th>
              <th>Due date</th>
              <th>Days overdue</th>
              <th>Aging bucket</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {aging.rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  No outstanding supplier invoices as of {aging.as_of}.
                </td>
              </tr>
            ) : (
              aging.rows.map((row: any) => (
                <tr key={row.id}>
                  <td>
                    <b>{row.supplier_code}</b>
                    <br />
                    {row.supplier}
                  </td>
                  <td>{row.invoice}</td>
                  <td>{row.invoice_date}</td>
                  <td>{row.due_date}</td>
                  <td>{row.days_overdue}</td>
                  <td>{status(row.bucket.replace("days_", ""))}</td>
                  <td>
                    <b>{money(row.outstanding)}</b>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="report-note">
        Based on posted goods receipts and each supplier’s payment terms.
        Recorded supplier payments will require payment-allocation entries when
        that module is added.
      </p>
    </div>
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
            ...financial.balance_sheet.assets.map(
              (x: any) =>
                [`${x.code} ${x.account}`, x.amount] as [string, number],
            ),
            ["Total assets", financial.balance_sheet.assets_total],
          ]}
        />
        <Statement
          title="Liabilities"
          rows={[
            ...financial.balance_sheet.liabilities.map(
              (x: any) =>
                [`${x.code} ${x.account}`, x.amount] as [string, number],
            ),
            ["Total liabilities", financial.balance_sheet.liabilities_total],
          ]}
        />
        <Statement
          title="Equity"
          rows={[
            ...financial.balance_sheet.equity.map(
              (x: any) =>
                [`${x.code} ${x.account}`, x.amount] as [string, number],
            ),
            ["Current-period profit", financial.balance_sheet.current_profit],
            ["Total equity", financial.balance_sheet.equity_total],
            [
              "Liabilities plus equity",
              financial.balance_sheet.liabilities_equity_total,
            ],
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
          [
            "Liabilities plus equity",
            financial.balance_sheet.liabilities_equity_total,
          ],
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
