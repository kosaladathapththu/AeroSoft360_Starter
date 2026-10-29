import { Fragment, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Factory,
  FileDown,
  Eye,
  FileUp,
  FileText,
  LayoutDashboard,
  Loader2,
  Menu,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
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
import PointOfSalePage from "./PointOfSalePage";
import SerialWarrantyPage from "./SerialWarrantyPage";
import BusinessWorkflowsPage, { workflowPages } from "./BusinessWorkflowsPage";
import { printReport, reportTotals } from "./report-print";
import "./tables.css";
import "./popups.css";
import { confirmDialog, showNotice } from "./AppDialogs";
import InvoiceBill from "./InvoiceBill";
import CustomerProfile from "./CustomerProfile";
import CustomerOpeningFields from "./CustomerOpeningFields";
import RateFields from "./RateFields";
import { fixedItemRate, givenItemRate } from "./rates";
import "./rates.css";
import { matchesSearch } from "./search";
import { reportSearchCatalog, pageSearchKeywords } from "./search-catalog";
import GlobalSearchRecords from "./GlobalSearchRecords";
import "./search.css";
import CollectionFields from "./CollectionFields";
import PaymentVouchersPage from "./PaymentVouchersPage";
import ChartOfAccountsPage from "./ChartOfAccountsPage";
import CashFlowPage from "./CashFlowPage";

const API =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
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
  source_type: string;
  posting_date: string;
  description: string;
  status: string;
  lines: JournalLine[];
};
type RecordRow = Supplier | Order | Stock | Journal;
type Workspace = {
  suppliers: Supplier[];
  materials: Material[];
  accounts: { id: number; code: string; name: string; type: string }[];
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
    sales_rep_id?: number | null;
    sales_rep_code?: string | null;
    sales_rep_name?: string | null;
  };
  permissions: string[];
};
const empty: Workspace = {
  suppliers: [],
  materials: [],
  accounts: [],
  purchase_orders: [],
  stock: [],
  journals: [],
};
const money = (n: number | string) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(Number(n));
const status = (s: string) => <span className={`status ${s}`}>{s.replace("_", " ")}</span>;

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
    [openNavGroup, setOpenNavGroup] = useState(""),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false);
  const [requestedReport, setRequestedReport] = useState("");
  const [reportSearchVersion, setReportSearchVersion] = useState(0);
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
      if (!r.ok) throw new Error("Backend is unavailable. Start Laravel and try again.");
      setData(await r.json());
    } catch (e) {
      if ((e as Error).message === "session") {
        localStorage.removeItem("aerosoft_token");
        setProfile(null);
      } else setError(e instanceof Error ? e.message : "Unable to load workspace");
    } finally {
      setAuthReady(true);
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const closeOpenDropdowns = (event: PointerEvent) => {
      const target = event.target as Node | null;
      document
        .querySelectorAll<HTMLDetailsElement>(
          "details.colour-multi-picker[open], details.invoice-breakdown-details[open]",
        )
        .forEach((dropdown) => {
          if (target && !dropdown.contains(target)) dropdown.open = false;
        });
    };
    document.addEventListener("pointerdown", closeOpenDropdowns, true);
    return () => document.removeEventListener("pointerdown", closeOpenDropdowns, true);
  }, []);
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
  const navGroups = [
    {
      name: "Sales",
      icon: ClipboardCheck,
      items: [
        ["Point of Sale", Check],
        ["Quotations", FileText],
        ["Customer POs", ClipboardCheck],
        ["Sales Orders", FileText],
        ["Invoices", FileText],
        ["Collections", Check],
        ["Debtors Aging", ShieldCheck],
        ["Commissions", FileText],
      ],
    },
    {
      name: "People & Products",
      icon: Users,
      items: [
        ["Customers", Building2],
        ["Salespersons", Users],
        ["Pricing List", PackagePlus],
        ["Categories", PackagePlus],
        ["Brands", PackagePlus],
        ["Units", PackagePlus],
        ["Employees", Users],
        ["Payroll", Building2],
      ],
    },
    {
      name: "Purchasing & Inventory",
      icon: Warehouse,
      items: [
        ["Inventory Overview", Warehouse],
        ["Suppliers", Building2],
        ["Purchase Orders", FileText],
        ["Receive Goods", ClipboardCheck],
        ["Supplier Invoices", FileText],
        ["Purchase Returns", FileText],
        ["Raw Material Stock", Warehouse],
        ["Finished Goods Stock", PackagePlus],
        ["Bulk Inventory Import", FileUp],
        ["Inventory Operations", Warehouse],
        ["Stock Ledgers", FileText],
        ["Serials & Warranty", ShieldCheck],
      ],
    },
    {
      name: "Finance & Reports",
      icon: ShieldCheck,
      items: [
        ["Chart of Accounts", Building2],
        ["Cash Flow", FileText],
        ["Cashier Closing", Check],
        ["Customer Ledgers", FileText],
        ["All Payables", FileText],
        ["Supplier Ledgers", FileText],
        ["Recurring Journals", FileText],
        ["Head Office Salaries", Users],
        ["Head Office Expenses", FileText],
        ["Payment Vouchers", FileText],
        ["General Ledger", ShieldCheck],
        ["Reports", FileText],
      ],
    },
    {
      name: "Administration",
      icon: Settings,
      items: [["Access Control", ShieldCheck]],
    },
  ] as const;
  const goToPage = (name: string) => {
    setRequestedReport("");
    setPage(name);
    setMenu(false);
    setSearch("");
    setSearchOpen(false);
    const group = navGroups.find(group => group.items.some(([page]) => page === name));
    if (group) setOpenNavGroup(group.name);
  };
  const searchPages = [
    { name: "Dashboard", group: "Workspace" },
    ...navGroups
      .filter(group => group.name !== "Administration" || profile?.permissions.includes("admin.manage"))
      .flatMap(group => group.items.map(([name]) => ({ name, group: group.name, keywords: pageSearchKeywords[name] || "" }))),
  ].filter(item => matchesSearch(item, search));
  const searchReports = reportSearchCatalog.filter(report => matchesSearch(["Reports", ...report], search));
  const openSearchReport = (key: string) => { goToPage("Reports"); setRequestedReport(key); setReportSearchVersion(value => value + 1); };
  const openSearchRecord = (name: string, query: string) => { goToPage(name); setSearch(query); };
  const rows = useMemo(() => {
    if (page === "Suppliers")
      return data.suppliers.filter((x) => matchesSearch(x, search));
    if (page === "Purchase Orders" || page === "Receive Goods")
      return data.purchase_orders.filter((x) => matchesSearch(x, search));
    if (page === "Raw Material Stock")
      return data.stock.filter((x) => matchesSearch(x, search));
    return data.journals.filter((x) => matchesSearch(x, search));
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
    if (!(await confirmDialog(`Delete this ${kind}? This action cannot be undone.`))) return;
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
  const can = (permission: string) => profile?.permissions.includes(permission) ?? false;
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
          <label>MAIN MENU</label>
          <button
            className={page === "Dashboard" ? "active" : ""}
            onClick={() => goToPage("Dashboard")}
          >
            <LayoutDashboard />
            <span>Dashboard</span>
          </button>
          {navGroups
            .filter(
              (group) =>
                group.name !== "Administration" || profile.permissions.includes("admin.manage"),
            )
            .map((group) => {
              const isOpen = openNavGroup === group.name;
              const hasActivePage = group.items.some(([name]) => name === page);
              const GroupIcon = group.icon;
              return (
                <div className={`nav-group ${isOpen ? "open" : ""}`} key={group.name}>
                  <button
                    className={`nav-group-toggle ${hasActivePage ? "group-active" : ""}`}
                    aria-expanded={isOpen}
                    onClick={() => setOpenNavGroup(isOpen ? "" : group.name)}
                  >
                    <GroupIcon />
                    <span>{group.name}</span>
                    <ChevronDown className="nav-chevron" />
                  </button>
                  {isOpen && (
                    <div className="nav-group-items">
                      {group.items.map(([name, Icon]) => (
                        <button
                          className={page === name ? "active" : ""}
                          onClick={() => goToPage(name)}
                          key={name}
                        >
                          <Icon />
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>
        <button className="user" onClick={logout} title="Sign out">
          <div>U1</div>
          <span>
            <b>{profile.user.name}</b>
            <small>{profile.user.role_name} · Sign out</small>
          </span>
        </button>
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
          <div className="search workspace-search" onBlur={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSearchOpen(false);
          }}>
            <Search />
            <input
              placeholder="Search records"
              aria-label="Search current records or find a page"
              aria-expanded={searchOpen && Boolean(search.trim())}
              aria-controls="workspace-search-results"
              maxLength={120}
              value={search}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
              onKeyDown={e => {
                if (e.key === "Escape") { setSearch(""); setSearchOpen(false); }
                if (e.key === "Enter" && search.trim() && searchPages.length + searchReports.length === 1) {
                  e.preventDefault();
                  if (searchReports.length) openSearchReport(searchReports[0][0]);
                  else goToPage(searchPages[0].name);
                }
                if (e.key === "ArrowDown" && search.trim()) {
                  e.preventDefault();
                  e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(".workspace-search-results button")?.focus();
                }
              }}
            />
            {search && <button className="workspace-search-clear" aria-label="Clear search" onClick={() => { setSearch(""); setSearchOpen(false); }}><X size={16} /></button>}
            {searchOpen && search.trim() && <div id="workspace-search-results" className="workspace-search-results">
              <p>Search current lists or open a matching page:</p>
              {searchPages.map(item => <button key={item.name} onClick={() => goToPage(item.name)}><b>{item.name}</b><small>{item.group}</small></button>)}
              <p>Reports</p>
              {searchReports.map(([key, name]) => <button key={key} onClick={() => openSearchReport(key)}><b>{name}</b><small>Open report</small></button>)}
              {!searchPages.length && !searchReports.length && <p>No matching pages or reports.</p>}
              <GlobalSearchRecords api={API} token={token() || ""} query={search} open={openSearchRecord} />
            </div>}
          </div>
          <button className="refresh" onClick={load}>
            <RefreshCw />
          </button>
        </header>
        <section className="content">
          {page === "Point of Sale" ? (
            <PointOfSalePage
              api={API}
              token={token() || ""}
              user={profile.user}
              canManage={profile.permissions.includes("accounting.manage")}
              search={search}
              go={goToPage}
            />
          ) : page === "Serials & Warranty" ? (
            <SerialWarrantyPage
              api={API}
              token={token() || ""}
              permissions={profile.permissions}
              search={search}
              go={goToPage}
            />
          ) : workflowPages.includes(page) ? (
            <BusinessWorkflowsPage
              key={page}
              api={API}
              token={token() || ""}
              page={page}
              permissions={profile.permissions}
              search={search}
              go={goToPage}
              onChanged={load}
              user={profile.user}
            />
          ) : [
              "Dashboard",
              "Customers",
              "Salespersons",
              "Pricing List",
              "Customer POs",
              "Sales Orders",
              "Invoices",
              "Collections",
              "Debtors Aging",
              "Commissions",
              "Finished Goods Stock",
              "Inventory Overview",
            ].includes(page) ? (
            <SalesPage
              token={token() || ""}
              page={page}
              go={setPage}
              currentUser={profile.user}
              rawStock={data.stock}
              search={search}
            />
          ) : page === "Employees" ? (
            <EmployeesPage token={token() || ""} search={search} />
          ) : page === "Payroll" ? (
            <PayrollPage token={token() || ""} go={goToPage} search={search} />
          ) : page === "Payment Vouchers" ? (
            <PaymentVouchersPage
              api={API}
              token={token() || ""}
              canManage={profile.permissions.includes("accounting.manage")}
              search={search}
              onChanged={load}
            />
          ) : page === "Chart of Accounts" ? (
            <ChartOfAccountsPage
              api={API}
              token={token() || ""}
              canManage={profile.permissions.includes("accounting.manage")}
              search={search}
              onChanged={load}
            />
          ) : page === "Cash Flow" ? (
            <CashFlowPage api={API} token={token() || ""} search={search} go={setPage} />
          ) : page === "Reports" ? (
            <ReportsPage key={reportSearchVersion} token={token() || ""} search={search} requestedReport={requestedReport} />
          ) : page === "Access Control" ? (
            <AccessPage token={token() || ""} currentUserId={profile.user.id} search={search} />
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
                  <button className="primary" onClick={() => setModal("supplier")}>
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
                {page === "General Ledger" && (
                  <button className="primary" onClick={() => setModal("journal")}>
                    <Plus /> New Journal Entry
                  </button>
                )}
                {page === "Raw Material Stock" && (
                  <button className="primary" onClick={() => setModal("stock_adjustment")}>
                    <Plus /> Adjust Stock
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
      {viewing && <RecordView page={page} row={viewing as any} close={() => setViewing(null)} />}
    </div>
  );
}

function SalesPage({
  token,
  page,
  go,
  currentUser,
  rawStock = [],
  search = "",
}: {
  token: string;
  page: string;
  go: (page: string) => void;
  currentUser: Profile["user"];
  rawStock?: Stock[];
  search?: string;
}) {
  const [data, setData] = useState<any>(null),
    [aging, setAging] = useState<any>(null),
    [dashboard, setDashboard] = useState<any>(null),
    [error, setError] = useState(""),
    [modal, setModal] = useState(""),
    [editingMaster, setEditingMaster] = useState<{ type: string; row: any } | null>(null),
    [editingTransaction, setEditingTransaction] = useState<any>(null),
    [editingArticle, setEditingArticle] = useState<any>(null),
    [editingPo, setEditingPo] = useState<any>(null),
    [convertingPo, setConvertingPo] = useState<any>(null),
    [dispatchOrder, setDispatchOrder] = useState<any>(null),
    [poInvoiceOpen, setPoInvoiceOpen] = useState(false),
    [poDownloading, setPoDownloading] = useState<string | null>(null),
    [billInvoiceId, setBillInvoiceId] = useState<number | null>(null),
    [viewing, setViewing] = useState<any>(null),
    [priceImporting, setPriceImporting] = useState(false),
    [priceImportMessage, setPriceImportMessage] = useState(""),
    [pendingPriceFile, setPendingPriceFile] = useState<File | null>(null),
    [pricePreview, setPricePreview] = useState<any>(null),
    [collectionView, setCollectionView] = useState<"due" | "history">("due"),
    [collectionInvoice, setCollectionInvoice] = useState<any>(null),
    [inventoryQuery, setInventoryQuery] = useState(""),
    [inventoryType, setInventoryType] = useState("all"),
    [inventoryCategory, setInventoryCategory] = useState("all"),
    [inventoryRecord, setInventoryRecord] = useState<{ mode: "view" | "edit"; row: any } | null>(
      null,
    ),
    [expandedPriceArticles, setExpandedPriceArticles] = useState<Set<number>>(new Set());
  const priceFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (page === "Collections" && search.trim() && data?.receipts?.some((row: any) => matchesSearch(row, search)) && !data?.invoices?.some((row: any) => Number(row.outstanding) > 0 && matchesSearch(row, search))) {
      setCollectionView("history");
    }
  }, [page, search, data]);
  const salesTableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (salesTableRef.current) salesTableRef.current.scrollLeft = 0;
  }, [page]);
  const loadDashboard = useCallback(() => {
    setError("");
    fetch(`${API}/sales/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setDashboard(await response.json());
      })
      .catch(() => setError("Unable to load sales dashboard."));
  }, [token]);
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
  useEffect(() => {
    if (page === "Dashboard") {
      if (!dashboard) loadDashboard();
    } else if (!data || !aging) loadSales();
  }, [page, dashboard, data, aging, loadDashboard, loadSales]);
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
    if (
      method === "POST" &&
      (path === "sales-invoices/manual" ||
        /^(sales-orders|customer-pos)\/\d+\/invoice$/.test(path)) &&
      json.id
    )
      setBillInvoiceId(Number(json.id));
    return json;
  };
  const updateCommissionPolicy = async () => {
    const current = Number(data?.commission_settings?.max_collection_days || 100);
    const value = prompt("Maximum collection days for commission eligibility", String(current));
    if (value === null) return;
    const days = Number(value);
    if (!Number.isInteger(days) || days < 1 || days > 365)
      return setError("Enter a whole number between 1 and 365 days.");
    try {
      await post("commission-settings", { max_collection_days: days }, "PUT");
    } catch (exception) {
      setError((exception as Error).message);
    }
  };
  const downloadCustomerPo = async (po?: any) => {
    if (poDownloading !== null) return;
    setPoDownloading(po ? String(po.id) : "all");
    setError("");
    try {
      const response = await fetch(`${API}/customer-pos/${po ? `${po.id}/` : ""}export`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
      if (!response.ok) throw new Error("Unable to download the PO report. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = po
        ? `${String(po.number).replace(/[^A-Za-z0-9_-]/g, "_")}.xlsx`
        : "All_Customer_POs.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exception) {
      setError((exception as Error).message);
    } finally {
      setPoDownloading(null);
    }
  };
  const previewPriceList = async (file?: File) => {
    if (!file) return;
    setPriceImporting(true);
    setPriceImportMessage("");
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch(`${API}/price-list/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "Price-list validation failed.");
      setPendingPriceFile(file);
      setPricePreview(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPriceImporting(false);
    }
  };
  const confirmPriceImport = async () => {
    if (!pendingPriceFile || !pricePreview?.can_import) return;
    setPriceImporting(true);
    setError("");
    const body = new FormData();
    body.append("file", pendingPriceFile);
    try {
      const response = await fetch(`${API}/price-list/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "Price-list import failed.");
      const s = json.summary;
      setPriceImportMessage(
        `Imported ${s.rows_read - s.rows_skipped} priced rows: ${s.articles_created} new articles, ${s.articles_updated} article updates, ${s.items_created} new sizes and ${s.items_updated} price updates. ${s.rows_skipped} rows skipped.`,
      );
      setPricePreview(null);
      setPendingPriceFile(null);
      if (priceFileRef.current) priceFileRef.current.value = "";
      await loadSales();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPriceImporting(false);
    }
  };
  if (error && page === "Dashboard" && !dashboard)
    return (
      <div className="error loading-failure">
        <b>{error}</b>
        <button onClick={loadDashboard}>Try again</button>
      </div>
    );
  if (error && page !== "Dashboard" && (!data || !aging))
    return (
      <div className="error loading-failure">
        <b>{error}</b>
        <button onClick={loadSales}>Try again</button>
      </div>
    );
  if (page === "Dashboard" && !dashboard)
    return (
      <div className="loading">
        <Loader2 /> Loading dashboard...
      </div>
    );
  if (page !== "Dashboard" && (!data || !aging))
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
              Customer orders, invoicing, collections, aging and commission in one controlled flow.
            </p>
          </div>
          <button className="primary" onClick={() => go("Customer POs")}>
            <Plus /> New customer PO
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="kpis">
          <article>
            <span>Customers</span>
            <b>{dashboard.customers_count}</b>
            <small>Active customer accounts</small>
          </article>
          <article>
            <span>Open credit invoices</span>
            <b>{dashboard.open_invoices_count}</b>
            <small>{money(dashboard.outstanding_total)} outstanding</small>
          </article>
          <article>
            <span>Collections received</span>
            <b>{money(dashboard.collections_total)}</b>
            <small>Allocated customer receipts</small>
          </article>
          <article>
            <span>Commission earned</span>
            <b>{money(dashboard.commission_total)}</b>
            <small>Collection-based eligible commission</small>
          </article>
        </div>
        <div className="flow-card">
          <h2>Customer order to commission</h2>
          <p>The customer and article data continues through every step without re-entry.</p>
          <div className="flow">
            {[
              ["1", "Customer PO", "Customer POs"],
              ["2", "Sales Order", "Sales Orders"],
              ["3", "Price & Size", "Pricing List"],
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
            {dashboard.recent_invoices.map((x: any) => (
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
            {dashboard.recent_receipts.map((x: any) => (
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
            currentUser={currentUser}
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
    "Pricing List": data.articles
      .filter((article: any) => article.status === "active")
      .map((article: any) => ({
        id: article.id,
        article_id: article.id,
        article_code: article.code,
        article_name: article.name,
        category: article.category,
        article_status: article.status,
        article,
        variants: article.sets
          .flatMap((set: any) =>
            set.items
              .filter(
                (item: any) =>
                  item.price_source ||
                  item.item_code ||
                  item.colours ||
                  item.production_cost != null,
              )
              .map((item: any) => ({ ...item, set_name: set.name })),
          )
          .sort(
            (a: any, b: any) => Number(a.source_row || 999999) - Number(b.source_row || 999999),
          ),
      }))
      .filter((article: any) => article.variants.length > 0)
      .sort(
        (a: any, b: any) =>
          Number(a.variants[0]?.source_row || 999999) - Number(b.variants[0]?.source_row || 999999),
      ),
    "Customer POs": data.pos,
    "Sales Orders": data.orders,
    Invoices: data.invoices,
    Collections: data.receipts,
    "Debtors Aging": aging.rows,
    Commissions: data.commissions,
    "Finished Goods Stock": data.finished_stock || [],
    "Inventory Overview": data.finished_stock || [],
  };
  const sourceRows =
    page === "Collections"
      ? collectionView === "due"
        ? data.invoices.filter((invoice: any) => Number(invoice.outstanding) > 0)
        : data.receipts
      : map[page] || [];
  const rows = sourceRows.filter((row: any) => matchesSearch(row, search));
  const addType: any = {
    Customers: "customer",
    Salespersons: "rep",
    "Pricing List": "article",
    "Customer POs": "po",
    "Sales Orders": "sales_order",
    Invoices: "invoice",
    Collections: "receipt",
    Commissions: "commission",
    "Finished Goods Stock": "finished_stock",
  };
  const heads: any = {
    Customers: ["Customer", "Phone", "Credit terms", "Credit limit", "Status"],
    Salespersons: ["Representative", "Manager", "Channel", "Default rate", "Status"],
    "Pricing List": [
      "Article",
      "Category",
      "Item Code",
      "Size",
      "Colours",
      "Production Cost",
      "Selling Price",
    ],
    "Customer POs": ["PO", "Customer", "Salesperson", "Date", "Sale type", "Total", "Status"],
    "Sales Orders": ["Sales order", "Customer", "Salesperson", "Date", "Total", "Status"],
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
    Collections:
      collectionView === "due"
        ? [
            "Invoice",
            "Customer",
            "Salesperson",
            "Due date",
            "Invoice total",
            "Paid",
            "To be paid",
            "Status",
          ]
        : [
            "Receipt",
            "Customer",
            "Invoice salesperson",
            "Cash collector",
            "Date",
            "Collection type",
            "Method",
            "Amount",
          ],
    "Debtors Aging": [
      "Invoice",
      "Customer",
      "Salesperson",
      "Due date",
      "Days overdue",
      "Bucket",
      "Last collection",
      "Outstanding",
    ],
    Commissions: [
      "Source",
      "Commission paid to",
      "Customer",
      "Invoice",
      "Receipt",
      "Basis / collected",
      "Days",
      "Eligible pieces",
      "Rate",
      "Eligibility",
      "Commission",
    ],
    "Finished Goods Stock": ["Article", "Category", "Size", "Available quantity"],
    "Inventory Overview": [
      "Type",
      "Item",
      "Category",
      "Variant / batch",
      "Available quantity",
      "Unit",
    ],
  };
  const groupedFinishedStock = Object.values(
    (data.finished_stock || []).reduce((groups: any, item: any) => {
      const key = String(item.article_id);
      if (!groups[key])
        groups[key] = {
          ...item,
          id: `finished-article-${item.article_id}`,
          record_id: item.article_id,
          inventory_kind: "finished",
          type: "Finished goods",
          item: `${item.article_code} — ${item.article_name}`,
          category: item.category || "Uncategorized",
          quantity: 0,
          unit: "pcs",
          details: [],
        };
      const article = (data.articles || []).find(
        (entry: any) => Number(entry.id) === Number(item.article_id),
      );
      const colours = [
        ...new Set(
          (article?.sets || []).flatMap((set: any) =>
            (set.items || [])
              .filter((setItem: any) => String(setItem.size_label) === String(item.size_label))
              .flatMap((setItem: any) => splitColours(setItem.colours || "")),
          ),
        ),
      ] as string[];
      groups[key].details.push({ ...item, colours });
      groups[key].quantity += Number(item.quantity || 0);
      groups[key].variant = `${groups[key].details.length} sizes`;
      groups[key].size_labels = groups[key].details
        .map((entry: any) => entry.size_label)
        .join(", ");
      return groups;
    }, {}),
  ) as any[];
  const inventoryRows =
    page === "Inventory Overview"
      ? [
          ...groupedFinishedStock,
          ...rawStock.map((item: Stock) => ({
            ...item,
            id: `raw-${item.id}`,
            record_id: item.id,
            inventory_kind: "raw",
            type: "Raw materials",
            item: `${item.code} — ${item.name}`,
            category: item.category || "Uncategorized",
            variant: `Batch ${item.batch_number}`,
            quantity: Number(item.quantity || 0),
            unit: "stock units",
          })),
        ]
      : [];
  const inventoryCategories = [...new Set(inventoryRows.map((item: any) => item.category))].sort();
  const visibleInventoryRows = inventoryRows.filter((item: any) => {
    const query = inventoryQuery.trim().toLowerCase();
    return (
      (inventoryType === "all" || item.type === inventoryType) &&
      (inventoryCategory === "all" || item.category === inventoryCategory) &&
      matchesSearch(item, search) &&
      (!query ||
        `${item.item} ${item.category} ${item.variant} ${item.size_labels || ""} ${item.type}`
          .toLowerCase()
          .includes(query))
    );
  });
  const finishedQuantity = inventoryRows
    .filter((item: any) => item.type === "Finished goods")
    .reduce((sum: number, item: any) => sum + item.quantity, 0);
  const rawQuantity = inventoryRows
    .filter((item: any) => item.type === "Raw materials")
    .reduce((sum: number, item: any) => sum + item.quantity, 0);
  return (
    <>
      <div className="heading">
        <div>
          <span>SALES OPERATIONS</span>
          <h1>{page}</h1>
          <p>
            {page === "Inventory Overview"
              ? "Review stock across finished products and raw materials by category, article, size and batch."
              : "Sales-first transaction records linked from customer order through collection."}
          </p>
        </div>
        {addType[page] && (
          <div className="heading-actions">
            {page === "Pricing List" && (
              <>
                <input
                  ref={priceFileRef}
                  hidden
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => previewPriceList(event.target.files?.[0])}
                />
                <button
                  className="secondary-action"
                  disabled={priceImporting}
                  onClick={() => priceFileRef.current?.click()}
                >
                  {priceImporting ? <Loader2 /> : <FileUp />}{" "}
                  {priceImporting ? "Importing..." : "Import price list"}
                </button>
              </>
            )}
            {page === "Commissions" && (
              <button className="secondary-action" onClick={updateCommissionPolicy}>
                <Settings /> Policy: {data.commission_settings?.max_collection_days || 100} days
              </button>
            )}
            {page === "Customer POs" && (
              <button
                className="secondary-action"
                title="Download all saved customer POs, across all dates and statuses, with item details"
                disabled={poDownloading !== null}
                onClick={() => downloadCustomerPo()}
              >
                {poDownloading === "all" ? <Loader2 /> : <FileDown />}{" "}
                {poDownloading === "all" ? "Downloading…" : "Download full PO report"}
              </button>
            )}
            {page === "Invoices" && (
              <button className="secondary-action" onClick={() => setPoInvoiceOpen(true)}>
                <FileText /> Invoice customer PO
              </button>
            )}
            <button
              className="primary"
              onClick={() => {
                if (page === "Collections") setCollectionInvoice(null);
                setModal(addType[page]);
              }}
            >
              <Plus />{" "}
              {page === "Collections"
                ? "Record collection"
                : page === "Commissions"
                  ? "Manual adjustment"
                  : page === "Finished Goods Stock"
                    ? "Adjust stock"
                    : page === "Invoices"
                      ? "Create invoice"
                      : page === "Sales Orders"
                        ? "Create sales order"
                        : page === "Pricing List"
                          ? "Add price item"
                          : `Add ${page.replace(/s$/, "")}`}
            </button>
          </div>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {priceImportMessage && page === "Pricing List" && (
        <div className="success-message">{priceImportMessage}</div>
      )}
      {page === "Collections" && (
        <div className="report-tabs" role="tablist" aria-label="Collection records">
          <button
            className={collectionView === "due" ? "active" : ""}
            onClick={() => setCollectionView("due")}
          >
            To Be Paid{" "}
            <small>
              {data.invoices.filter((invoice: any) => Number(invoice.outstanding) > 0).length}
            </small>
          </button>
          <button
            className={collectionView === "history" ? "active" : ""}
            onClick={() => setCollectionView("history")}
          >
            Payment History <small>{data.receipts.length}</small>
          </button>
        </div>
      )}
      {page === "Inventory Overview" ? (
        <div className="inventory-overview">
          <div className="inventory-summary-grid">
            <button
              type="button"
              onClick={() => setInventoryType("all")}
              className={inventoryType === "all" ? "active" : ""}
            >
              <Warehouse />
              <span>
                <small>All inventory records</small>
                <b>{inventoryRows.length.toLocaleString()}</b>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setInventoryType("Finished goods")}
              className={inventoryType === "Finished goods" ? "active" : ""}
            >
              <PackagePlus />
              <span>
                <small>Finished goods</small>
                <b>{finishedQuantity.toLocaleString()} pcs</b>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setInventoryType("Raw materials")}
              className={inventoryType === "Raw materials" ? "active" : ""}
            >
              <Factory />
              <span>
                <small>Raw materials</small>
                <b>{rawQuantity.toLocaleString()} units</b>
              </span>
            </button>
            <div className="inventory-manage-links">
              <small>Stock management</small>
              <button type="button" onClick={() => go("Finished Goods Stock")}>
                Finished goods
              </button>
              <button type="button" onClick={() => go("Raw Material Stock")}>
                Raw materials
              </button>
              <button
                type="button"
                className="temporary-stock-button"
                onClick={async () => {
                  if (!confirm("Set every finished-goods size balance to 50 pieces?")) return;
                  try {
                    await post("finished-stock/temporary-fill");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Set all to 50 temporarily
              </button>
            </div>
          </div>
          <div className="inventory-filters">
            <label>
              Search inventory
              <div>
                <Search />
                <input
                  value={inventoryQuery}
                  onChange={(event) => setInventoryQuery(event.target.value)}
                  placeholder="Article, product, size or batch"
                />
              </div>
            </label>
            <label>
              Inventory type
              <select
                value={inventoryType}
                onChange={(event) => setInventoryType(event.target.value)}
              >
                <option value="all">All inventory</option>
                <option value="Finished goods">Finished goods</option>
                <option value="Raw materials">Raw materials</option>
              </select>
            </label>
            <label>
              Category
              <select
                value={inventoryCategory}
                onChange={(event) => setInventoryCategory(event.target.value)}
              >
                <option value="all">All categories</option>
                {inventoryCategories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="table-card inventory-table-card">
            <table>
              <thead>
                <tr>
                  {heads[page].map((heading: string) => (
                    <th key={heading}>{heading}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInventoryRows.length ? (
                  visibleInventoryRows.map((item: any) => (
                    <tr key={item.id}>
                      <td>
                        <span
                          className={`inventory-type ${item.type === "Finished goods" ? "finished" : "raw"}`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td>
                        <b>{item.item}</b>
                      </td>
                      <td>{item.category}</td>
                      <td>{item.variant}</td>
                      <td>
                        <b>{item.quantity.toLocaleString()}</b>
                      </td>
                      <td>{item.unit}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-action view"
                            title="View all stock details"
                            onClick={() => setInventoryRecord({ mode: "view", row: item })}
                          >
                            <Eye />
                          </button>
                          <button
                            className="icon-action edit"
                            title="Edit stock"
                            onClick={() => setInventoryRecord({ mode: "edit", row: item })}
                          >
                            <Pencil />
                          </button>
                          <button
                            className="icon-action delete"
                            title="Delete stock record"
                            onClick={async () => {
                              if (!confirm(`Delete ${item.item}, ${item.variant}?`)) return;
                              try {
                                await post(
                                  item.inventory_kind === "finished"
                                    ? `finished-stock/${item.record_id}`
                                    : `stock/${item.record_id}`,
                                  undefined,
                                  "DELETE",
                                );
                                if (item.inventory_kind === "raw") window.location.reload();
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={heads[page].length + 1}>No matching inventory records.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div
          ref={salesTableRef}
          className={`table-card sales-table-card ${page === "Invoices" ? "invoice-table-card" : ""} ${page === "Pricing List" ? "pricing-table-card" : ""}`}
        >
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
                  <Fragment key={r.id}>
                    <tr>
                      {salesCells(
                        page === "Collections" && collectionView === "due"
                          ? "Collections Due"
                          : page,
                        r,
                      )}
                      <td>
                        <div className="row-actions">
                          {page === "Collections" && collectionView === "due" && (
                            <button
                              className="approve"
                              onClick={() => {
                                setCollectionInvoice(r);
                                setModal("receipt");
                              }}
                            >
                              <Check /> Record payment
                            </button>
                          )}
                          {page === "Pricing List" && (
                            <button
                              className="icon-action view"
                              title={
                                expandedPriceArticles.has(r.article_id)
                                  ? "Hide sizes"
                                  : "Show sizes"
                              }
                              onClick={() =>
                                setExpandedPriceArticles((current) => {
                                  const next = new Set(current);
                                  if (next.has(r.article_id)) next.delete(r.article_id);
                                  else next.add(r.article_id);
                                  return next;
                                })
                              }
                            >
                              {expandedPriceArticles.has(r.article_id) ? (
                                <ChevronDown />
                              ) : (
                                <ChevronRight />
                              )}
                            </button>
                          )}
                          {page === "Customer POs" && r.status === "draft" && (
                            <button className="approve" onClick={() => setConvertingPo(r)}>
                              <Check /> Review &amp; create
                            </button>
                          )}
                          {page === "Sales Orders" &&
                            r.lines?.some((line: any) => Number(line.remaining_quantity) > 0) && (
                              <button className="approve" onClick={() => setDispatchOrder(r)}>
                                <FileText /> Dispatch &amp; invoice
                              </button>
                            )}
                          {page !== "Pricing List" &&
                            !(page === "Collections" && collectionView === "due") && (
                              <button className="icon-action view" onClick={() => setViewing(r)}>
                                <Eye />
                              </button>
                            )}
                          {page === "Customer POs" && (
                            <>
                              <button
                                className="icon-action download"
                                title={`Download ${r.number} (Excel)`}
                                aria-label={`Download ${r.number} (Excel)`}
                                disabled={poDownloading !== null}
                                onClick={() => downloadCustomerPo(r)}
                              >
                                {poDownloading === String(r.id) ? <Loader2 /> : <FileDown />}
                              </button>
                              <button
                                className="icon-action edit"
                                title="Edit and update PO"
                                onClick={() => setEditingPo(r)}
                              >
                                <Pencil />
                              </button>
                              <button
                                className="icon-action delete"
                                title="Delete PO and linked records"
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `Delete ${r.number} and all linked sales orders, invoices, collections and journals? This cannot be undone.`,
                                    )
                                  )
                                    return;
                                  try {
                                    await post(`customer-pos/${r.id}`, undefined, "DELETE");
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                <Trash2 />
                              </button>
                            </>
                          )}
                          {page === "Pricing List" && (
                            <>
                              <button
                                className="icon-action edit"
                                title="Edit article and prices"
                                onClick={() => setEditingArticle(r.article)}
                              >
                                <Pencil />
                              </button>
                              <button
                                className="icon-action delete"
                                title="Delete article"
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `Delete article ${r.article_name} and all its price rows?`,
                                    )
                                  )
                                    return;
                                  try {
                                    await post(`articles/${r.article_id}`, undefined, "DELETE");
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                <Trash2 />
                              </button>
                            </>
                          )}
                          {page === "Customers" && (
                            <>
                              <button
                                className="icon-action edit"
                                title="Edit customer"
                                onClick={() => setEditingMaster({ type: "customer", row: r })}
                              >
                                <Pencil />
                              </button>
                              <button
                                className="icon-action delete"
                                title="Delete customer"
                                onClick={async () => {
                                  if (!confirm(`Delete ${r.name}?`)) return;
                                  try {
                                    await post(`customers/${r.id}`, undefined, "DELETE");
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                <Trash2 />
                              </button>
                            </>
                          )}
                          {page === "Salespersons" && (
                            <>
                              <button
                                className="icon-action edit"
                                title="Edit salesperson"
                                onClick={() => setEditingMaster({ type: "rep", row: r })}
                              >
                                <Pencil />
                              </button>
                              <button
                                className="icon-action delete"
                                title="Delete salesperson"
                                onClick={async () => {
                                  if (!confirm(`Delete ${r.name}?`)) return;
                                  try {
                                    await post(`sales-reps/${r.id}`, undefined, "DELETE");
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                <Trash2 />
                              </button>
                            </>
                          )}
                          {page === "Commissions" && (
                            <>
                              {r.source_type === "manual" && (
                                <button
                                  className="icon-action edit"
                                  title="Edit management adjustment"
                                  onClick={() => setEditingMaster({ type: "commission", row: r })}
                                >
                                  <Pencil />
                                </button>
                              )}
                              <button
                                className="icon-action delete"
                                title="Delete commission"
                                onClick={async () => {
                                  const manual = r.source_type === "manual";
                                  if (
                                    !confirm(
                                      manual
                                        ? "Delete this manual commission and its journal?"
                                        : "Delete this commission? The customer payment will remain allocated.",
                                    )
                                  )
                                    return;
                                  try {
                                    await post(
                                      manual
                                        ? `commissions/manual/${r.manual_id}`
                                        : `commissions/${r.id}`,
                                      undefined,
                                      "DELETE",
                                    );
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              >
                                <Trash2 />
                              </button>
                            </>
                          )}
                          {["Sales Orders", "Invoices", "Collections"].includes(page) &&
                            !(page === "Collections" && collectionView === "due") && (
                              <>
                                {page === "Invoices" && (
                                  <button
                                    className="icon-action"
                                    title="View / print bill"
                                    onClick={() => setBillInvoiceId(Number(r.id))}
                                  >
                                    <Printer />
                                  </button>
                                )}
                                <button
                                  className="icon-action edit"
                                  title={`Edit ${page}`}
                                  onClick={() =>
                                    page === "Invoices"
                                      ? setEditingMaster({ type: "invoice", row: r })
                                      : setEditingTransaction({ page, row: r })
                                  }
                                >
                                  <Pencil />
                                </button>
                                <button
                                  className="icon-action delete"
                                  title={`Delete ${page}`}
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        `Delete ${r.number}? Related posted records will be checked first.`,
                                      )
                                    )
                                      return;
                                    const base =
                                      page === "Sales Orders"
                                        ? "sales-orders"
                                        : page === "Invoices"
                                          ? "sales-invoices"
                                          : "customer-receipts";
                                    try {
                                      await post(`${base}/${r.id}`, undefined, "DELETE");
                                    } catch (e) {
                                      setError((e as Error).message);
                                    }
                                  }}
                                >
                                  <Trash2 />
                                </button>
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                    {page === "Pricing List" && expandedPriceArticles.has(r.article_id) && (
                      <tr className="price-detail-row">
                        <td colSpan={heads[page].length + 1}>
                          <div className="price-variants">
                            <div className="price-variant-head">
                              <b>Variant</b>
                              <b>Item code</b>
                              <b>Size</b>
                              <b>Colours</b>
                              <b>Production cost</b>
                              <b>Selling price</b>
                            </div>
                            {r.variants.map((item: any) => (
                              <div className="price-variant-line" key={item.id}>
                                <span>{item.set_name || "Price List"}</span>
                                <span>
                                  <b>{item.item_code || "—"}</b>
                                </span>
                                <span>{item.size_label}</span>
                                <span>{item.colours || "—"}</span>
                                <span>
                                  {item.production_cost == null ? "—" : money(item.production_cost)}
                                </span>
                                <span>
                                  <b>{money(item.unit_price)}</b>
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <SalesCreateModal
          type={modal}
          data={data}
          currentUser={currentUser}
          initial={modal === "receipt" ? collectionInvoice : undefined}
          close={() => {
            setModal("");
            setCollectionInvoice(null);
          }}
          save={async (path, body) => {
            try {
              setError("");
              await post(path, body);
              setModal("");
              setCollectionInvoice(null);
            } catch (e) {
              setError((e as Error).message);
              throw e;
            }
          }}
        />
      )}{" "}
      {editingArticle && (
        <SalesCreateModal
          type="article"
          data={data}
          currentUser={currentUser}
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
      {editingMaster && (
        <SalesCreateModal
          type={editingMaster.type}
          data={data}
          currentUser={currentUser}
          initial={editingMaster.row}
          close={() => setEditingMaster(null)}
          save={async (path, body, method) => {
            try {
              setError("");
              await post(path, body, method);
              setEditingMaster(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {editingPo && (
        <SalesCreateModal
          type="po"
          data={data}
          currentUser={currentUser}
          initial={editingPo}
          close={() => setEditingPo(null)}
          save={async (path, body, method) => {
            try {
              setError("");
              await post(path, body, method);
              setEditingPo(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {editingTransaction && (
        <SalesTransactionEditModal
          page={editingTransaction.page}
          row={editingTransaction.row}
          data={data}
          close={() => setEditingTransaction(null)}
          save={async (path, body) => {
            try {
              setError("");
              await post(path, body, "PUT");
              setEditingTransaction(null);
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
      {convertingPo && (
        <ConvertPoModal
          po={convertingPo}
          data={data}
          close={() => setConvertingPo(null)}
          save={async (body) => {
            try {
              setError("");
              await post(`customer-pos/${convertingPo.id}/convert`, body);
              setConvertingPo(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {poInvoiceOpen && (
        <PoInvoiceModal
          data={data}
          close={() => setPoInvoiceOpen(false)}
          save={async (poId, body) => {
            try {
              setError("");
              await post(`customer-pos/${poId}/invoice`, body);
              setPoInvoiceOpen(false);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
      {billInvoiceId !== null && (
        <InvoiceBill
          id={billInvoiceId}
          api={API}
          token={token}
          close={() => setBillInvoiceId(null)}
        />
      )}
      {viewing && (page === "Customers" ? (
        <CustomerProfile id={Number(viewing.id)} api={API} token={token} close={() => setViewing(null)} />
      ) : <RecordView page={page} row={viewing} close={() => setViewing(null)} />)}
      {inventoryRecord && (
        <InventoryRecordModal
          record={inventoryRecord}
          close={() => setInventoryRecord(null)}
          save={post}
          fail={setError}
        />
      )}
      {pricePreview && (
        <div className="backdrop" onMouseDown={() => !priceImporting && setPricePreview(null)}>
          <div
            className="modal price-validation-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Business record dialog"
          >
            <div className="popup-header">
              <button
                type="button"
                className="close"
                disabled={priceImporting}
                onClick={() => setPricePreview(null)}
                aria-label="Close dialog"
              >
                <X />
              </button>
              <span>PRICE LIST VALIDATION</span>
              <h2>Review before import</h2>
            </div>
            <div className="popup-body">
              <p>
                <b>{pricePreview.file_name}</b> · Sheet: {pricePreview.sheet_name}
              </p>
              <div className="validation-summary">
                <article>
                  <span>Valid rows</span>
                  <b>{pricePreview.valid_rows}</b>
                </article>
                <article>
                  <span>Skipped rows</span>
                  <b>{pricePreview.skipped_rows}</b>
                </article>
                <article>
                  <span>Duplicates</span>
                  <b>{pricePreview.duplicate_rows}</b>
                </article>
                <article>
                  <span>Missing columns</span>
                  <b>{pricePreview.missing_columns.length}</b>
                </article>
              </div>
              {pricePreview.missing_columns.length > 0 && (
                <div className="error">
                  Missing required columns: {pricePreview.missing_columns.join(", ")}
                </div>
              )}
              {pricePreview.warnings.length > 0 && (
                <div className="validation-warnings">
                  <b>Validation warnings</b>
                  <ul>
                    {pricePreview.warnings.slice(0, 12).map((warning: string) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                  {pricePreview.warnings.length > 12 && (
                    <small>And {pricePreview.warnings.length - 12} more warnings.</small>
                  )}
                </div>
              )}
              {pricePreview.sample.length > 0 && (
                <div className="validation-preview">
                  <b>First validated rows</b>
                  <div className="table-card">
                    <table>
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Article</th>
                          <th>Item code</th>
                          <th>Size</th>
                          <th>Selling price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricePreview.sample.map((row: any) => (
                          <tr key={row.row}>
                            <td>{row.row}</td>
                            <td>{row.article}</td>
                            <td>{row.item_code}</td>
                            <td>{row.size}</td>
                            <td>{money(row.selling_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="popup-footer">
              <div className="actions">
                <button
                  type="button"
                  disabled={priceImporting}
                  onClick={() => {
                    setPricePreview(null);
                    setPendingPriceFile(null);
                    if (priceFileRef.current) priceFileRef.current.value = "";
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!pricePreview.can_import || priceImporting}
                  onClick={confirmPriceImport}
                >
                  {priceImporting ? <Loader2 /> : <Check />} Confirm import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function InventoryRecordModal({
  record,
  close,
  save,
  fail,
}: {
  record: { mode: "view" | "edit"; row: any };
  close: () => void;
  save: (path: string, body?: any, method?: string) => Promise<any>;
  fail: (message: string) => void;
}) {
  const row = record.row;
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className="modal inventory-record-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            if (row.inventory_kind === "finished")
              await Promise.all(
                (row.details || []).map((detail: any) =>
                  save(
                    `finished-stock/${detail.id}`,
                    { quantity: Number(form.get(`quantity_${detail.id}`)) },
                    "PUT",
                  ),
                ),
              );
            else {
              await save(
                `stock/${row.record_id}`,
                {
                  batch_number: form.get("batch_number"),
                  quantity: Number(form.get("quantity")),
                  unit_cost: Number(form.get("unit_cost")),
                },
                "PUT",
              );
              window.location.reload();
            }
            close();
          } catch (error) {
            fail((error as Error).message);
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>INVENTORY RECORD</span>
          <h2>{record.mode === "view" ? row.item : `Edit ${row.item}`}</h2>
        </div>
        <div className="popup-body">
          <div className="inventory-detail-grid inventory-summary-details">
            <div>
              <small>Inventory type</small>
              <b>{row.type}</b>
            </div>
            <div>
              <small>Category</small>
              <b>{row.category}</b>
            </div>
            <div>
              <small>Total available</small>
              <b>
                {Number(row.quantity).toLocaleString()} {row.unit}
              </b>
            </div>
            <div>
              <small>{row.inventory_kind === "finished" ? "Article code" : "Material code"}</small>
              <b>{row.article_code || row.code}</b>
            </div>
          </div>
          {row.inventory_kind === "finished" ? (
            <div className="inventory-size-details">
              <div className="inventory-size-head">
                <b>Size</b>
                <b>Colours</b>
                <b>Stock record</b>
                <b>Available quantity</b>
              </div>
              {(row.details || []).map((detail: any) => (
                <div className="inventory-size-line" key={detail.id}>
                  <b>Size {detail.size_label}</b>
                  <div className="inventory-colour-list">
                    {detail.colours?.length ? (
                      detail.colours.map((colour: string) => (
                        <span key={colour}>
                          <i className="colour-swatch" style={{ background: colourHex(colour) }} />
                          {colour}
                        </span>
                      ))
                    ) : (
                      <small>No colour specified</small>
                    )}
                  </div>
                  <span>#{detail.id}</span>
                  {record.mode === "edit" ? (
                    <input
                      name={`quantity_${detail.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={detail.quantity}
                      required
                    />
                  ) : (
                    <strong>{Number(detail.quantity).toLocaleString()} pcs</strong>
                  )}
                </div>
              ))}
            </div>
          ) : record.mode === "edit" ? (
            <div className="inventory-edit-fields">
              <label>
                Batch number
                <input name="batch_number" defaultValue={row.batch_number} required />
              </label>
              <label>
                Available quantity
                <input
                  name="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={row.quantity}
                  required
                />
              </label>
              <label>
                Unit cost
                <input
                  name="unit_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={row.unit_cost}
                  required
                />
              </label>
            </div>
          ) : (
            <div className="inventory-detail-grid">
              <div>
                <small>Batch number</small>
                <b>{row.batch_number}</b>
              </div>
              <div>
                <small>Material name</small>
                <b>{row.name}</b>
              </div>
              <div>
                <small>Unit cost</small>
                <b>{money(row.unit_cost)}</b>
              </div>
              <div>
                <small>Stock record</small>
                <b>#{row.record_id}</b>
              </div>
            </div>
          )}
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" onClick={close}>
              Close
            </button>
            {record.mode === "edit" && (
              <button className="primary" type="submit">
                <Check /> Save all sizes
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
function SalesTransactionEditModal({
  page,
  row,
  data,
  close,
  save,
}: {
  page: string;
  row: any;
  data: any;
  close: () => void;
  save: (path: string, body: any) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <ModalShell
      title={`Edit ${row.number}`}
      close={close}
      busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const form = new FormData(event.currentTarget);
        try {
          if (page === "Sales Orders")
            await save(`sales-orders/${row.id}`, {
              order_date: form.get("order_date"),
              status: form.get("status"),
            });
          else if (page === "Invoices")
            await save(`sales-invoices/${row.id}`, {
              due_date: form.get("due_date"),
              sale_type: form.get("sale_type"),
            });
          else
            await save(`customer-receipts/${row.id}`, {
              receipt_date: form.get("receipt_date"),
              collector_sales_rep_id: Number(form.get("collector_sales_rep_id")),
              collection_type: form.get("collection_type"),
              payment_method: form.get("payment_method"),
              commission_decision: form.get("commission_decision"),
              reference: form.get("reference"),
            });
        } finally {
          setBusy(false);
        }
      }}
    >
      {page === "Sales Orders" ? (
        <div className="form-row">
          <label>
            Order date
            <input name="order_date" type="date" defaultValue={row.order_date} required />
          </label>
          <label>
            Status
            <select name="status" defaultValue={row.status}>
              <option value="confirmed">Confirmed</option>
              <option value="part_invoiced">Part invoiced</option>
              <option value="invoiced">Invoiced</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      ) : page === "Invoices" ? (
        <div className="form-row">
          <label>
            Due date
            <input name="due_date" type="date" defaultValue={row.due_date} required />
          </label>
          <label>
            Sale type
            <select name="sale_type" defaultValue={row.sale_type}>
              <option value="credit">Credit</option>
              <option value="cash">Cash</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
        </div>
      ) : (
        <>
          <div className="form-row">
            <label>
              Cash collector
              <select
                name="collector_sales_rep_id"
                defaultValue={row.collector_sales_rep_id || row.sales_rep_id}
                required
              >
                {data.reps.map((rep: any) => (
                  <option value={rep.id} key={rep.id}>
                    {rep.code} â€” {rep.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Receipt date
              <input name="receipt_date" type="date" defaultValue={row.receipt_date} required />
            </label>
            <label>
              Collection type
              <select name="collection_type" defaultValue={row.collection_type || "regular"}>
                <option value="regular">Regular collection</option>
                <option value="partial">Partial collection</option>
                <option value="final">Final settlement</option>
                <option value="recovery">Overdue debt recovery</option>
              </select>
            </label>
            <label>
              Payment method
              <select name="payment_method" defaultValue={row.payment_method}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
              </select>
            </label>
            <label>
              Commission decision
              <select
                name="commission_decision"
                defaultValue={row.commission_decision || "invoice_salesperson"}
              >
                <option value="invoice_salesperson">Pay original invoice salesperson</option>
                <option value="collector">Pay cash collector</option>
                <option value="cancel">No commission / cancel</option>
              </select>
            </label>
          </div>
          <label>
            Reference
            <input name="reference" defaultValue={row.reference} />
          </label>
        </>
      )}
    </ModalShell>
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
  if (page === "Pricing List") {
    const colours = [
      ...new Set(r.variants.map((item: any) => item.colours).filter(Boolean)),
    ] as string[];
    const costs = r.variants
      .map((item: any) => Number(item.production_cost))
      .filter((value: number) => Number.isFinite(value) && value > 0);
    const prices = r.variants
      .map((item: any) => Number(item.unit_price))
      .filter((value: number) => Number.isFinite(value));
    const priceText =
      prices.length && Math.min(...prices) !== Math.max(...prices)
        ? `${money(Math.min(...prices))} – ${money(Math.max(...prices))}`
        : money(prices[0] || 0);
    const costText = costs.length
      ? Math.min(...costs) === Math.max(...costs)
        ? money(costs[0])
        : `${money(Math.min(...costs))} – ${money(Math.max(...costs))}`
      : "—";
    return (
      <>
        <td>
          <b>{r.article_code}</b>
        </td>
        <td>{r.category}</td>
        <td>
          <b>{r.variants.length} item codes</b>
        </td>
        <td>{r.variants.map((item: any) => item.size_label).join(", ")}</td>
        <td>{colours.join(" · ") || "—"}</td>
        <td>{costText}</td>
        <td>
          <b>{priceText}</b>
        </td>
      </>
    );
  }
  if (page === "Finished Goods Stock")
    return (
      <>
        <td>
          <b>{r.article_code}</b>
          <br />
          {r.article_name}
        </td>
        <td>{r.category}</td>
        <td>{r.size_label}</td>
        <td>
          <b>{Number(r.quantity).toLocaleString()}</b>
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
        <td>
          {r.sale_type}
          {r.sale_type === "mixed" && (
            <>
              <br />
              <small>
                Cash {money(r.cash_amount)} · Credit {money(r.credit_amount)}
              </small>
            </>
          )}
        </td>
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
        <td>{r.invoice_rep_name}</td>
        <td>{r.collector_name || r.invoice_rep_name}</td>
        <td>{r.receipt_date}</td>
        <td>{(r.collection_type || "regular").replaceAll("_", " ")}</td>
        <td>{r.payment_method.replaceAll("_", " ")}</td>
        <td>{money(r.amount)}</td>
      </>
    );
  if (page === "Collections Due")
    return (
      <>
        <td>
          <b>{r.number}</b>
        </td>
        <td>{r.customer_name}</td>
        <td>{r.rep_name}</td>
        <td>{r.due_date}</td>
        <td>{money(r.total)}</td>
        <td>{money(r.received_amount)}</td>
        <td>
          <b>{money(r.outstanding)}</b>
        </td>
        <td>{status(Number(r.received_amount) > 0 ? "part paid" : "unpaid")}</td>
      </>
    );
  if (page === "Debtors Aging")
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
        <td>
          {r.last_collection_date ? (
            <>
              {r.last_collection_date}
              <br />
              <small>
                {r.last_collector || "Unknown collector"} Â·{" "}
                {(r.last_collection_type || "regular").replaceAll("_", " ")}
              </small>
            </>
          ) : (
            "No collection yet"
          )}
        </td>
        <td>{money(r.outstanding)}</td>
      </>
    );
  return (
    <>
      <td>{status(r.source_type === "manual" ? "Manual" : "Automatic")}</td>
      <td>{r.rep_name}</td>
      <td>{r.customer_name}</td>
      <td>{r.invoice_number}</td>
      <td>
        {r.receipt_number}
        <br />
        <small>{r.receipt_date}</small>
      </td>
      <td>
        {r.source_type === "manual" ? (
          <>
            <b>{Number(r.amount).toLocaleString()} pieces</b>
            <br />
            <small>Manual quantity basis</small>
          </>
        ) : (
          money(r.amount)
        )}
      </td>
      <td>{r.days_taken}</td>
      <td>
        {Number(r.source_type === "manual" ? r.amount : r.commission_pieces || 0).toLocaleString()}
      </td>
      <td>{money(r.commission_rate)} / piece</td>
      <td>{status(r.commission_status)}</td>
      <td>
        <b>{money(r.commission_amount)}</b>
      </td>
    </>
  );
}
function ConvertPoModal({
  po,
  data,
  close,
  save,
}: {
  po: any;
  data: any;
  close: () => void;
  save: (body: any) => Promise<void>;
}) {
  const lines = useMemo(() => {
    const expanded: any[] = [];
    po.lines.forEach((line: any) => {
      const article = data.articles.find((a: any) => Number(a.id) === Number(line.article_id));
      const set = article?.sets.find((s: any) => Number(s.id) === Number(line.set_template_id));
      if (line.order_mode === "size") {
        const item = set?.items.find((i: any) => Number(i.id) === Number(line.set_item_id));
        if (item)
          expanded.push({
            key: `${line.id}|${item.id}`,
            po_line_id: line.id,
            set_item_id: item.id,
            article_code: line.article_code,
            article_name: line.article_name,
            size_label: item.size_label,
            colour: line.colour,
            ordered: Number(line.pieces),
            fixed_rate: fixedItemRate(line,item),
            rate: givenItemRate(line,item),
          });
      } else {
        set?.items.forEach((item: any) =>
          expanded.push({
            key: `${line.id}|${item.id}`,
            po_line_id: line.id,
            set_item_id: item.id,
            article_code: line.article_code,
            article_name: line.article_name,
            size_label: item.size_label,
            colour: line.colour,
            ordered: Number(item.quantity) * Number(line.sets),
            fixed_rate: fixedItemRate(line,item),
            rate: givenItemRate(line,item),
          }),
        );
      }
    });
    return expanded;
  }, [po, data.articles]);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((line: any) => [line.key, line.ordered])),
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const quantityFor = (line: any) =>
    removed.has(line.key) ? 0 : Number(quantities[line.key] || 0);
  const total = lines.reduce(
    (sum: number, line: any) => sum + Math.round(quantityFor(line) * line.rate * 100) / 100,
    0,
  );
  const pieces = lines.reduce((sum: number, line: any) => sum + quantityFor(line), 0);
  const included = lines.filter((line: any) => quantityFor(line) > 0).length;
  const missingReasons = lines.filter(
    (line: any) => quantityFor(line) !== line.ordered && !reasons[line.key]?.trim(),
  ).length;
  const invalid = lines.some(
    (line: any) =>
      !Number.isInteger(quantityFor(line)) ||
      quantityFor(line) < 0 ||
      quantityFor(line) > line.ordered,
  );
  return (
    <div
      className="backdrop"
      onMouseDown={() => {
        if (!busy) close();
      }}
    >
      <form
        className="modal dispatch-modal order-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-review-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) close();
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || invalid || missingReasons > 0 || included === 0 || total <= 0) return;
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            await save({
              order_date: form.get("order_date"),
              lines: lines.map((line: any) => ({
                customer_po_line_id: line.po_line_id,
                set_item_id: line.set_item_id,
                quantity: quantityFor(line),
                reason: quantityFor(line) !== line.ordered ? reasons[line.key]?.trim() : null,
              })),
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="order-review-header">
          <button
            type="button"
            className="close"
            aria-label="Close review"
            disabled={busy}
            onClick={close}
          >
            <X />
          </button>
          <span>SALES ORDER REVIEW</span>
          <h2 id="order-review-title">Review your order</h2>
          <p>Edit quantities or remove sizes. A reason is required for every changed item.</p>
        </div>
        <div className="order-review-body">
          <div className="order-review-context">
            <div>
              <small>CUSTOMER</small>
              <strong>{po.customer_name}</strong>
              <span>{po.number || "Customer purchase order"}</span>
            </div>
            <label>
              Sales order date
              <input
                name="order_date"
                type="date"
                defaultValue={po.po_date || new Date().toISOString().slice(0, 10)}
                required
                disabled={busy}
              />
            </label>
          </div>
          <div className="order-review-section">
            <h3>
              Order items <span>{lines.length}</span>
            </h3>
            <span>
              <Pencil size={14} /> Edit order quantities below
            </span>
          </div>
          <div className="dispatch-lines">
            <div className="dispatch-head">
              <b>Article / colour</b>
              <b>Size</b>
              <b>PO qty</b>
              <b>Order qty</b>
              <b>Status</b>
              <b>Amount</b>
              <b>Action</b>
            </div>
            {lines.map((line: any) => {
              const qty = quantityFor(line);
              const isRemoved = removed.has(line.key);
              const label = `${line.article_code}, ${line.colour || "no colour"}, size ${line.size_label}`;
              return (
                <div className={`dispatch-row ${isRemoved ? "is-removed" : ""}`} key={line.key}>
                  <span>
                    <b>{line.article_code}</b>
                    <small>
                      {line.article_name}
                      {line.colour ? ` · ${line.colour}` : ""}
                    </small>
                  </span>
                  <span className="order-review-size">{line.size_label}</span>
                  <span className="order-review-original">{line.ordered}</span>
                  <input
                    aria-label={`Order quantity for ${label}`}
                    type="number"
                    min="0"
                    max={line.ordered}
                    step="1"
                    required
                    disabled={busy || isRemoved}
                    value={isRemoved ? 0 : quantities[line.key]}
                    onChange={(e) =>
                      setQuantities((current) => ({
                        ...current,
                        [line.key]: Number(e.target.value),
                      }))
                    }
                  />
                  <span
                    className={`order-review-status ${isRemoved || qty === 0 ? "excluded" : qty === line.ordered ? "full" : "partial"}`}
                  >
                    {isRemoved
                      ? "Removed"
                      : qty === 0
                        ? "Excluded"
                        : qty === line.ordered
                          ? "Full quantity"
                          : `${line.ordered - qty} fewer`}
                  </span>
                  <span className="order-review-amount">
                    <b>{money(qty * line.rate)}</b>
                    <small>{money(line.rate)} / piece</small>
                  </span>
                  <button
                    type="button"
                    className={`order-review-remove ${isRemoved ? "restore" : ""}`}
                    disabled={busy}
                    aria-label={`${isRemoved ? "Restore" : "Remove"} ${label}`}
                    title={isRemoved ? "Restore item" : "Remove item"}
                    onClick={() =>
                      setRemoved((current) => {
                        const next = new Set(current);
                        if (next.has(line.key)) next.delete(line.key);
                        else next.add(line.key);
                        return next;
                      })
                    }
                  >
                    {isRemoved ? (
                      <>
                        <RefreshCw size={14} /> Undo
                      </>
                    ) : (
                      <Trash2 size={17} />
                    )}
                  </button>
                  {qty !== line.ordered && (
                    <label className="order-review-reason">
                      {qty === 0 ? "Reason for removal" : "Reason for quantity change"}{" "}
                      <span>
                        Required · {line.ordered} → {qty} pieces
                      </span>
                      <input
                        aria-label={`Reason for ${qty === 0 ? "removing" : "editing"} ${label}`}
                        type="text"
                        maxLength={500}
                        required
                        pattern=".*\S.*"
                        disabled={busy}
                        value={reasons[line.key] || ""}
                        onChange={(event) =>
                          setReasons((current) => ({ ...current, [line.key]: event.target.value }))
                        }
                        placeholder={
                          qty === 0
                            ? "e.g. Out of stock or customer cancelled this size"
                            : "e.g. Customer requested fewer pieces"
                        }
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          <p className="order-review-note">
            Removed items and quantities of 0 are excluded from this sales order. Undo a removal to
            restore its quantity.
          </p>
        </div>
        <div className="order-review-footer">
          <div className="po-grand-total" aria-live="polite">
            <div>
              <span>Reviewed order total</span>
              <small>
                {included} sizes included · {pieces.toLocaleString()} pieces
                {removed.size > 0 ? ` · ${removed.size} removed` : ""}
              </small>
            </div>
            <strong>{money(total)}</strong>
          </div>
          {included === 0 && (
            <p className="order-review-note" role="status">
              Restore an item or enter a quantity to create an order.
            </p>
          )}
          {missingReasons > 0 && (
            <p className="order-review-reason-warning" role="status">
              Enter a reason for {missingReasons} changed item{missingReasons === 1 ? "" : "s"} to
              continue.
            </p>
          )}
          <div className="modal-actions">
            <button type="button" disabled={busy} onClick={close}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || invalid || missingReasons > 0 || total <= 0 || included === 0}
            >
              {busy ? <Loader2 /> : <Check />} {busy ? "Creating order…" : "Create sales order"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ArticleSearchPicker({
  articles,
  selectedId,
  listId,
  onSelect,
}: {
  articles: any[];
  selectedId: number;
  listId: string;
  onSelect: (article: any) => void;
}) {
  const selected = articles.find((article: any) => Number(article.id) === Number(selectedId));
  const labelFor = (article: any) =>
    `${article.code} — ${article.name}${article.category ? ` · ${article.category}` : ""}`;
  const [query, setQuery] = useState(selected ? labelFor(selected) : "");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setQuery(selected ? labelFor(selected) : "");
  }, [selectedId]);
  const normalizedQuery = query.trim().toLowerCase();
  const selectedLabel = selected ? labelFor(selected) : "";
  const filtering = normalizedQuery && normalizedQuery !== selectedLabel.toLowerCase();
  const results = filtering
    ? articles.filter((article: any) =>
        [article.code, article.name, article.category, labelFor(article)].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      )
    : articles;
  const choose = (article: any) => {
    onSelect(article);
    setQuery(labelFor(article));
    setOpen(false);
  };
  return (
    <div className={`searchable-article-select ${open ? "open" : ""}`}>
      <Search className="picker-search-icon" aria-hidden="true" />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        placeholder="Search code, name or category"
        onFocus={(event) => {
          window.dispatchEvent(new Event("close-colour-pickers"));
          setOpen(true);
          event.currentTarget.select();
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            setQuery(selected ? labelFor(selected) : "");
          }, 120);
        }}
        autoComplete="off"
      />
      <ChevronDown className="picker-chevron" aria-hidden="true" />
      {open && (
        <div className="article-picker-menu" id={listId} role="listbox">
          {results.length ? (
            results.map((article: any) => (
              <button
                type="button"
                role="option"
                aria-selected={Number(article.id) === Number(selectedId)}
                className={Number(article.id) === Number(selectedId) ? "selected" : ""}
                key={article.id}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(article);
                }}
              >
                <b>{article.code}</b>
                <span>{article.name}</span>
                {article.category && <small>{article.category}</small>}
              </button>
            ))
          ) : (
            <div className="article-picker-empty">No matching articles</div>
          )}
        </div>
      )}
    </div>
  );
}

const STANDARD_COLOURS = [
  "BLACK",
  "WHITE",
  "BROWN",
  "TAN",
  "BEIGE",
  "GRAY",
  "RED",
  "BLUE",
  "GREEN",
  "YELLOW",
  "ORANGE",
  "PINK",
  "PURPLE",
  "NAVY",
];
const COLOUR_HEX: Record<string, string> = {
  BK: "#111827",
  BLACK: "#111827",
  WH: "#ffffff",
  WHITE: "#ffffff",
  BR: "#795548",
  BROWN: "#795548",
  TAN: "#c49a6c",
  BE: "#d9c7a3",
  BEIGE: "#d9c7a3",
  GR: "#808080",
  GRAY: "#808080",
  GREY: "#808080",
  RED: "#dc2626",
  BLUE: "#2563eb",
  "N.BLUE": "#1e3a8a",
  NAVYBLUE: "#1e3a8a",
  "L.BLUE": "#60a5fa",
  SKYBLUE: "#38bdf8",
  GREEN: "#16a34a",
  YELLOW: "#facc15",
  ORANGE: "#f97316",
  PINK: "#ec4899",
  PURPLE: "#9333ea",
  NAVY: "#1e3a8a",
};
const colourHex = (colour: string) =>
  /^#[0-9a-f]{6}$/i.test(colour.trim())
    ? colour.trim()
    : COLOUR_HEX[colour.trim().toUpperCase()] || "#94a3b8";
const splitColours = (value: string) => [
  ...new Set(
    String(value || "")
      .split(",")
      .map((colour) => colour.trim())
      .filter(Boolean),
  ),
];

function ColourMultiPicker({
  value,
  options = [],
  onChange,
  allowCustom = false,
  label = "Choose colours",
}: {
  value: string[];
  options?: string[];
  onChange: (value: string[]) => void;
  allowCustom?: boolean;
  label?: string;
}) {
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState("#00897b");
  const pickerRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = () => {
      if (pickerRef.current) pickerRef.current.open = false;
    };
    window.addEventListener("close-colour-pickers", close);
    return () => window.removeEventListener("close-colour-pickers", close);
  }, []);
  const choices = [
    ...new Set(
      [...(allowCustom ? STANDARD_COLOURS : []), ...options, ...value]
        .map((colour) => colour.trim())
        .filter(Boolean),
    ),
  ];
  const toggle = (colour: string) =>
    onChange(value.includes(colour) ? value.filter((item) => item !== colour) : [...value, colour]);
  const add = (colour: string) => {
    const normalized = colour.trim().toUpperCase();
    if (normalized && !value.includes(normalized)) onChange([...value, normalized]);
    setTyped("");
  };
  return (
    <details
      ref={pickerRef}
      className="colour-multi-picker"
      onToggle={(event) => {
        const activePicker = event.currentTarget;
        if (activePicker.open)
          window.setTimeout(
            () =>
              document
                .querySelectorAll<HTMLDetailsElement>(".colour-multi-picker[open]")
                .forEach((item) => {
                  if (item !== activePicker) item.open = false;
                }),
            0,
          );
      }}
    >
      <summary>
        <span className="colour-picker-value">
          {value.length ? (
            value.map((colour) => (
              <span className="colour-chip" key={colour}>
                <i style={{ background: colourHex(colour) }} />
                {colour}
              </span>
            ))
          ) : (
            <span className="colour-placeholder">{label}</span>
          )}
        </span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="colour-picker-panel">
        <div className="colour-picker-heading">
          <b>Select colours</b>
          <small>Tick one or more</small>
        </div>
        <div className="colour-picker-options">
          {choices.map((colour) => (
            <label className={value.includes(colour) ? "selected" : ""} key={colour}>
              <input
                type="checkbox"
                checked={value.includes(colour)}
                onChange={() => toggle(colour)}
              />
              <i style={{ background: colourHex(colour) }} />
              <span>{colour}</span>
            </label>
          ))}
        </div>
        {!choices.length && (
          <small className="colour-picker-empty">No colours are assigned to this article.</small>
        )}
        {allowCustom && (
          <div className="colour-custom-entry">
            <input
              value={typed}
              placeholder="Type a colour name"
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add(typed);
                }
              }}
            />
            <button type="button" onClick={() => add(typed)} disabled={!typed.trim()}>
              Add
            </button>
            <label className="visual-colour-input" title="Pick a custom colour">
              <input
                type="color"
                value={picked}
                onChange={(event) => setPicked(event.target.value)}
              />
              <span>Pick colour</span>
            </label>
            <button type="button" onClick={() => add(picked)}>
              Add picked
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

function PoInvoiceModal({
  data,
  close,
  save,
}: {
  data: any;
  close: () => void;
  save: (poId: number, body: any) => Promise<void>;
}) {
  const eligible = data.pos.filter((po: any) => ["draft", "ordered"].includes(po.status));
  const [poId, setPoId] = useState<number>(Number(eligible[0]?.id || 0));
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [rates, setRates] = useState<Record<string,number>>({});
  const [busy, setBusy] = useState(false);
  const po = eligible.find((item: any) => Number(item.id) === poId);
  const lines = useMemo(() => {
    if (!po) return [];
    const order = data.orders.find((item: any) => Number(item.customer_po_id) === poId);
    if (order)
      return order.lines
        .filter((line: any) => Number(line.remaining_quantity) > 0)
        .map((line: any) => ({
          article_id: Number(line.article_id),
          article_code: line.article_code,
          article_name: line.article_name,
          size_label: line.size_label,
          remaining: Number(line.remaining_quantity),
          rate: Number(line.rate),
          fixed_rate: line.fixed_rate,
        }));
    const expanded: any[] = [];
    po.lines.forEach((line: any) => {
      const article = data.articles.find((a: any) => Number(a.id) === Number(line.article_id));
      const set = article?.sets.find((s: any) => Number(s.id) === Number(line.set_template_id));
      if (line.order_mode === "size") {
        const item = set?.items.find((i: any) => Number(i.id) === Number(line.set_item_id));
        if (item)
          expanded.push({
            article_id: Number(line.article_id),
            article_code: line.article_code,
            article_name: line.article_name,
            size_label: item.size_label,
            remaining: Number(line.pieces),
            fixed_rate: fixedItemRate(line,item),
            rate: givenItemRate(line,item),
          });
      } else
        set?.items.forEach((item: any) =>
          expanded.push({
            article_id: Number(line.article_id),
            article_code: line.article_code,
            article_name: line.article_name,
            size_label: item.size_label,
            remaining: Number(item.quantity) * Number(line.sets),
            fixed_rate: fixedItemRate(line,item),
            rate: givenItemRate(line,item),
          }),
        );
    });
    const grouped = new Map<string, any>();
    expanded.forEach((line) => {
      const key = `${line.article_id}|${line.size_label}`;
      if (grouped.has(key)) grouped.get(key).remaining += line.remaining;
      else grouped.set(key, { ...line });
    });
    return [...grouped.values()];
  }, [po, poId, data.orders, data.articles]);
  useEffect(() => {
    setRates({});
    setQuantities(
      Object.fromEntries(
        lines.map((line: any) => [`${line.article_id}|${line.size_label}`, line.remaining]),
      ),
    );
  }, [poId, lines.length]);
  const total = lines.reduce(
    (sum: number, line: any) =>
      sum + Number(quantities[`${line.article_id}|${line.size_label}`] || 0) * Number(rates[`${line.article_id}|${line.size_label}`] ?? line.rate),
    0,
  );
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className="modal po-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await save(poId, {
              invoice_date: f.get("invoice_date"),
              sale_type: f.get("sale_type"),
              lines: lines.map((line: any) => ({
                article_id: line.article_id,
                size_label: line.size_label,
                rate: rates[`${line.article_id}|${line.size_label}`] ?? null,
                quantity: Number(quantities[`${line.article_id}|${line.size_label}`] || 0),
              })),
            });
          } finally {
            setBusy(false);
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>PO FULFILMENT</span>
          <h2>Create invoice from customer PO</h2>
        </div>
        <div className="popup-body">
          <p>
            Select the supplied quantities. Any quantity left below the ordered amount remains
            pending for a later invoice.
          </p>
          {eligible.length === 0 ? (
            <div className="error">There are no open customer POs available for invoicing.</div>
          ) : (
            <>
              <div className="form-row">
                <label>
                  Customer PO
                  <select value={poId} onChange={(e) => setPoId(Number(e.target.value))}>
                    {eligible.map((item: any) => (
                      <option value={item.id} key={item.id}>
                        {item.number} — {item.customer_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sale type
                  <select
                    name="sale_type"
                    defaultValue={po?.sale_type === "cash" ? "cash" : "credit"}
                    key={`${poId}-type`}
                  >
                    <option value="cash">Cash sale</option>
                    <option value="credit">Credit sale</option>
                  </select>
                </label>
                <label>
                  Invoice date
                  <input
                    name="invoice_date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>
              </div>
              <div className="dispatch-lines">
                <div className="dispatch-line head">
                  <b>Article</b>
                  <b>Size</b>
                  <b>Ordered / pending</b>
                  <b>Supply now</b>
                  <b>Rate</b>
                </div>
                {lines.map((line: any) => {
                  const key = `${line.article_id}|${line.size_label}`;
                  return (
                    <div className="dispatch-line" key={key}>
                      <span>
                        <b>{line.article_code}</b>
                        <small>{line.article_name}</small>
                      </span>
                      <span>{line.size_label}</span>
                      <span>{line.remaining}</span>
                      <input
                        type="number"
                        min="0"
                        max={line.remaining}
                        step="0.01"
                        value={quantities[key] ?? 0}
                        onChange={(e) =>
                          setQuantities((current) => ({
                            ...current,
                            [key]: Number(e.target.value),
                          }))
                        }
                      />
                      <label>Fixed: {line.fixed_rate == null ? "Not recorded" : money(line.fixed_rate)}<input aria-label={`Given rate for ${line.article_code} size ${line.size_label}`} type="number" min="0" step="0.01" value={rates[key] ?? line.rate} onChange={e=>setRates(all=>({...all,[key]:Number(e.target.value)}))} /></label>
                    </div>
                  );
                })}
              </div>
              <div className="po-grand-total">
                <span>Invoice total for supplied goods</span>
                <strong>{money(total)}</strong>
              </div>
            </>
          )}
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy || !eligible.length || total <= 0}>
              {busy ? <Loader2 /> : <Check />} Create invoice
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function DispatchInvoiceModal({
  order,
  close,
  save,
}: {
  order: any;
  close: () => void;
  save: (body: any) => Promise<void>;
}) {
  const available = order.lines.filter((line: any) => Number(line.remaining_quantity) > 0);
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(available.map((line: any) => [line.id, Number(line.remaining_quantity)])),
  );
  const [rates, setRates] = useState<Record<number,number>>(Object.fromEntries(available.map((line: any)=>[line.id,Number(line.rate)])));
  const [busy, setBusy] = useState(false);
  const total = available.reduce(
    (sum: number, line: any) => sum + Number(quantities[line.id] || 0) * Number(rates[line.id] ?? line.rate),
    0,
  );
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className="modal dispatch-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await save({
              invoice_date: f.get("invoice_date"),
              lines: available.map((line: any) => ({
                sales_order_size_line_id: line.id,
                quantity: Number(quantities[line.id] || 0),
                rate: rates[line.id],
              })),
            });
          } finally {
            setBusy(false);
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>PARTIAL FULFILMENT</span>
          <h2>Dispatch and create invoice</h2>
        </div>
        <div className="popup-body">
          <p>
            {order.number} — {order.customer_name}. Enter only the quantity being sent now; the
            balance remains as backorder.
          </p>
          <label>
            Invoice / dispatch date
            <input name="invoice_date" type="date" required />
          </label>
          <div className="dispatch-lines">
            <div className="dispatch-head">
              <b>Article / size</b>
              <b>Ordered</b>
              <b>Already invoiced</b>
              <b>Remaining</b>
              <b>Dispatch now</b>
              <b>Amount</b>
            </div>
            {available.map((line: any) => (
              <div className="dispatch-row" key={line.id}>
                <span>
                  <b>{line.article_code}</b>
                  <small>Fixed rate: {line.fixed_rate == null ? "Not recorded" : money(line.fixed_rate)}</small>
                  <label>Given rate<input type="number" min="0" step="0.01" value={rates[line.id]} onChange={e => setRates(all=>({...all,[line.id]:Number(e.target.value)}))} required /></label>
                  <small>
                    {line.article_name} · Size {line.size_label}
                  </small>
                </span>
                <span>{Number(line.quantity)}</span>
                <span>{Number(line.invoiced_quantity)}</span>
                <span>{Number(line.remaining_quantity)}</span>
                <input
                  type="number"
                  min="0"
                  max={Number(line.remaining_quantity)}
                  step="1"
                  value={quantities[line.id] || 0}
                  onChange={(e) =>
                    setQuantities((all) => ({ ...all, [line.id]: Number(e.target.value) }))
                  }
                />
                <b>{money(Number(quantities[line.id] || 0) * Number(rates[line.id] ?? line.rate))}</b>
              </div>
            ))}
          </div>
          <div className="po-grand-total">
            <span>Invoice total for this dispatch</span>
            <strong>{money(total)}</strong>
          </div>
        </div>
        <div className="popup-footer">
          <div className="modal-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy || total <= 0}>
              <Check /> Create partial invoice
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function OrderCustomerPicker({
  customers,
  selectedId,
  select,
}: {
  customers: any[];
  selectedId: number;
  select: (id: number) => void;
}) {
  const labelFor = (customer: any) =>
    `${customer.code} — ${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}`;
  const [query, setQuery] = useState(() => {
    const customer = customers.find((item) => Number(item.id) === selectedId);
    return customer ? labelFor(customer) : "";
  });
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.setCustomValidity(selectedId ? "" : "Choose a customer from the suggestions.");
  }, [selectedId, query]);
  return (
    <label className="easy-customer-picker">
      Customer
      <input
        ref={input}
        list="order-customer-options"
        type="text"
        value={query}
        required
        placeholder="Type customer name, code or phone"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          const customer = customers.find((item) => labelFor(item) === event.target.value);
          select(customer ? Number(customer.id) : 0);
        }}
      />
      <datalist id="order-customer-options">
        {customers.map((customer) => (
          <option key={customer.id} value={labelFor(customer)} />
        ))}
      </datalist>
      <small>Type to search, then choose a customer.</small>
    </label>
  );
}

function SalesCreateModal({
  type,
  data,
  initial,
  currentUser,
  close,
  save,
}: {
  type: string;
  data: any;
  initial?: any;
  currentUser?: Profile["user"];
  close: () => void;
  save: (path: string, body: any, method?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const isEasyOrder = type === "po" || type === "sales_order";
  const [submitError, setSubmitError] = useState("");
  const [orderStep, setOrderStep] = useState(1);
  const [orderStepError, setOrderStepError] = useState("");
  const [orderReview, setOrderReview] = useState<Record<string, string>>({});
  const orderForm = useRef<HTMLFormElement>(null);
  const [commissionBasis, setCommissionBasis] = useState(
    Number(initial?.amount ?? initial?.basis_amount ?? 0),
  );
  const [commissionRate, setCommissionRate] = useState(Number(initial?.commission_rate ?? 0));
  const calculatedCommission = Math.round(commissionBasis * commissionRate * 100) / 100;
  const [newCustomer, setNewCustomer] = useState(isEasyOrder && !data.customers?.length);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    Number(initial?.customer_id || (isEasyOrder ? 0 : data.customers?.[0]?.id) || 0),
  );
  const [selectedRepId, setSelectedRepId] = useState(
    Number(currentUser?.sales_rep_id || initial?.sales_rep_id || data.reps?.[0]?.id || 0),
  );
  const [poSaleType, setPoSaleType] = useState(initial?.sale_type || "credit");
  const [poCashAmount, setPoCashAmount] = useState(Number(initial?.cash_amount || 0));
  const [invoiceDiscount, setInvoiceDiscount] = useState(Number(initial?.discount || 0));
  const [invoiceTaxMode, setInvoiceTaxMode] = useState(
    initial ? initial.tax_type || "fixed" : "percentage",
  );
  const [invoiceTax, setInvoiceTax] = useState(
    Number(initial?.tax_type === "percentage" ? initial?.tax_rate : initial?.tax || 0),
  );
  const readAdjustments = (value: any, amount: any, description: any) => {
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (Array.isArray(parsed) && parsed.length)
        return parsed.map((row: any) => ({
          description: String(row.description || ""),
          type: row.type === "percentage" ? "percentage" : "fixed",
          value: Number(row.value || 0),
        }));
    } catch {
      /* Fall back to legacy aggregate columns. */
    }
    return Number(amount || 0) > 0
      ? [{ description: String(description || ""), type: "fixed", value: Number(amount) }]
      : [];
  };
  const [invoiceCharges, setInvoiceCharges] = useState<any[]>(
    readAdjustments(
      initial?.charge_adjustments,
      initial?.other_charges,
      initial?.other_charges_description,
    ),
  );
  const [invoiceDeductions, setInvoiceDeductions] = useState<any[]>(
    readAdjustments(
      initial?.deduction_adjustments,
      initial?.other_deduction,
      initial?.other_deduction_description,
    ),
  );
  const [setTypes, setSetTypes] = useState<any[]>([
    ...(initial?.sets?.length
      ? initial.sets.map((set: any) => ({
          ...set,
          items: set.items.map((item: any) => ({ ...item })),
        }))
      : [
          {
            name: "Standard Set",
            items: [
              {
                size_label: "",
                item_code: "",
                colours: "",
                production_cost: null,
                quantity: 2,
                unit_price: 0,
              },
            ],
          },
        ]),
  ]);
  const firstArticle =
    data.articles?.find(
      (article: any) =>
        article.status !== "inactive" &&
        article.sets?.some((set: any) => set.status !== "inactive" && Number(set.set_price) > 0),
    ) || data.articles?.[0];
  const firstSet =
    firstArticle?.sets?.find(
      (set: any) => set.status !== "inactive" && Number(set.set_price) > 0,
    ) || firstArticle?.sets?.[0];
  const firstSetId = Number(firstSet?.id || 0);
  const firstArticleId = Number(firstArticle?.id || 0);
  const firstItemId = Number(firstSet?.items?.[0]?.id || 0);
  const [inventoryArticleId, setInventoryArticleId] = useState(firstArticleId);
  const [expandedPoLine, setExpandedPoLine] = useState<number | null>(null);
  const [poLines, setPoLines] = useState<any[]>([
    ...(initial?.lines?.length
      ? initial.lines.map((line: any) => ({
          article_id: Number(line.article_id),
          custom_rate: line.custom_rate,
          fixed_rates: line.fixed_rates,
          order_mode: (line.order_mode || "badge") === "size" ? "custom" : "badge",
          set_template_id: Number(line.set_template_id || 0),
          set_item_id: Number(line.set_item_id || 0),
          colour: line.colour || "",
          selected_colours: line.colour ? [line.colour] : [],
          quantity: Number((line.order_mode || "badge") === "badge" ? line.sets : line.pieces),
          custom_sizes:
            (line.order_mode || "badge") === "size"
              ? { [Number(line.set_item_id)]: Number(line.pieces) }
              : {},
          custom_colours:
            (line.order_mode || "badge") === "size" && line.colour
              ? { [Number(line.set_item_id)]: [line.colour] }
              : {},
          custom_colour_quantities:
            (line.order_mode || "badge") === "size" && line.colour
              ? { [Number(line.set_item_id)]: { [line.colour]: Number(line.pieces) } }
              : {},
        }))
      : [
          {
            article_id: firstArticleId,
            colour: "",
            selected_colours: [],
            order_mode: "badge",
            set_template_id: firstSetId,
            set_item_id: firstItemId,
            quantity: 1,
          },
        ]),
  ]);
  const invoicableArticles = (data.articles || []).filter(
    (article: any) =>
      article.status !== "inactive" &&
      (article.sets || []).some(
        (set: any) =>
          set.status !== "inactive" &&
          (set.items || []).length > 0 &&
          (Number(set.set_price || 0) > 0 ||
            set.items.some((item: any) => Number(item.unit_price || 0) > 0)),
      ),
  );
  const defaultInvoiceArticle = invoicableArticles[0] || data.articles?.[0];
  const defaultInvoiceSet =
    defaultInvoiceArticle?.sets?.find(
      (set: any) =>
        set.status !== "inactive" &&
        (Number(set.set_price || 0) > 0 ||
          set.items?.some((item: any) => Number(item.unit_price || 0) > 0)),
    ) || defaultInvoiceArticle?.sets?.[0];
  const [invoiceLines, setInvoiceLines] = useState<any[]>(
    initial?.lines?.length
      ? [...new Set(initial.lines.map((line: any) => Number(line.article_id)))].map(
          (articleId: any) => {
            const article = data.articles.find(
              (item: any) => Number(item.id) === Number(articleId),
            );
            const set =
              article?.sets?.find((item: any) => item.status !== "inactive") || article?.sets?.[0];
            const firstStoredLine = initial.lines.find(
              (item: any) => Number(item.article_id) === Number(articleId),
            );
            const matchingItem = set?.items?.find(
              (item: any) => item.size_label === firstStoredLine?.size_label,
            );
            return {
              article_id: Number(articleId),
              set_template_id: Number(set?.id || 0),
              colour: firstStoredLine?.colour || "",
              given_rates: Object.fromEntries((set?.items || []).map((item: any)=>[item.id, initial.lines.find((stored: any)=>Number(stored.article_id)===Number(articleId) && stored.size_label===item.size_label)?.rate ?? item.unit_price])),
              fixed_rates: Object.fromEntries((set?.items || []).map((item: any)=>[item.id, initial.lines.find((stored: any)=>Number(stored.article_id)===Number(articleId) && stored.size_label===item.size_label)?.fixed_rate ?? item.unit_price])),
              sets: Math.max(
                1,
                Number(firstStoredLine?.quantity || 1) /
                  Math.max(1, Number(matchingItem?.quantity || 1)),
              ),
              order_mode: "badge",
              custom_sizes: {},
              custom_colours: {},
              custom_colour_quantities: {},
            };
          },
        )
      : [
          {
            article_id: Number(defaultInvoiceArticle?.id || 0),
            set_template_id: Number(defaultInvoiceSet?.id || 0),
            colour: "",
            sets: 1,
            order_mode: "badge",
            custom_sizes: {},
            custom_colours: {},
            custom_colour_quantities: {},
          },
        ],
  );
  const addInvoiceArticle = () =>
    setInvoiceLines((lines) => [
      ...lines,
      {
        article_id: Number(defaultInvoiceArticle?.id || 0),
        set_template_id: Number(defaultInvoiceSet?.id || 0),
        colour: "",
        sets: 1,
        order_mode: "badge",
        custom_sizes: {},
        custom_colours: {},
        custom_colour_quantities: {},
      },
    ]);
  const availableSets = (data.articles || []).flatMap((article: any) =>
    article.sets
      .filter((set: any) => set.status !== "inactive")
      .map((set: any) => ({ ...set, article })),
  );
  const poFixedTotal = (line: any) => {
    if (line.order_mode === "custom") {
      const items = data.articles.flatMap((article: any) =>
        article.sets.flatMap((set: any) => set.items),
      );
      return Object.entries(line.custom_sizes || {}).reduce(
        (total: number, [itemId, quantity]: any) => {
          const colourQuantities = Object.values(
            line.custom_colour_quantities?.[itemId] || {},
          ).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
          return (
            total +
            Number(items.find((item: any) => Number(item.id) === Number(itemId))?.unit_price || 0) *
              (colourQuantities || Number(quantity || 0))
          );
        },
        0,
      );
    }
    const colourMultiplier = Math.max(1, Number(line.selected_colours?.length || 0));
    return (
      Number(
        availableSets.find((set: any) => Number(set.id) === Number(line.set_template_id))
          ?.set_price || 0,
      ) *
      Number(line.quantity || 0) *
      colourMultiplier
    );
  };
  const poLinePieces = (line: any) => {
    if (line.order_mode === "custom") return Object.entries(line.custom_sizes || {}).reduce((sum: number,[id,qty]: any) => sum + (Object.values(line.custom_colour_quantities?.[id] || {}).reduce((a: number,b: any)=>a+Number(b||0),0) || Number(qty||0)),0);
    return Number(availableSets.find((set: any)=>Number(set.id)===Number(line.set_template_id))?.pieces || 0)*Number(line.quantity||0)*Math.max(1,Number(line.selected_colours?.length||0));
  };
  const poLineTotal = (line: any) => line.custom_rate == null ? poFixedTotal(line) : Number(line.custom_rate)*poLinePieces(line);
  const poGrandTotal = poLines.reduce((total: number, line: any) => total + poLineTotal(line), 0);
  const poTotalPieces = poLines.reduce((total: number, line: any) => {
    if (line.order_mode === "custom") {
      return (
        total +
        Object.entries(line.custom_sizes || {}).reduce(
          (lineTotal: number, [itemId, quantity]: any) => {
            const colourTotal = Object.values(line.custom_colour_quantities?.[itemId] || {}).reduce(
              (sum: number, value: any) => sum + Number(value || 0),
              0,
            );
            return lineTotal + (colourTotal || Number(quantity || 0));
          },
          0,
        )
      );
    }
    const set = availableSets.find(
      (value: any) => Number(value.id) === Number(line.set_template_id),
    );
    return (
      total +
      Number(set?.pieces || 0) *
        Number(line.quantity || 0) *
        Math.max(1, Number(line.selected_colours?.length || 0))
    );
  }, 0);
  const visibleReps = data.reps.filter(
    (rep: any) => rep.status === "active" || Number(rep.id) === selectedRepId,
  );
  const expandedInvoiceLines = invoiceLines.flatMap((line: any) => {
    const article = data.articles.find((item: any) => Number(item.id) === Number(line.article_id));
    const set =
      article?.sets?.find((item: any) => Number(item.id) === Number(line.set_template_id)) ||
      article?.sets?.[0];
    if (line.order_mode === "custom")
      return (set?.items || []).flatMap((item: any) => {
        const fallbackQuantity = Number(line.custom_sizes?.[item.id] || 0);
        const selectedColours = line.custom_colours?.[item.id] || [];
        if (selectedColours.length)
          return selectedColours
            .map((colour: string) => ({
              article_id: Number(line.article_id),
              set_item_id: item.id,
              size_label: item.size_label,
              colour,
              quantity: Number(line.custom_colour_quantities?.[item.id]?.[colour] || 0),
              fixed_rate: Number(line.fixed_rates?.[item.id] ?? item.unit_price),
              rate: Number(line.custom_rate ?? line.given_rates?.[item.id] ?? item.unit_price),
            }))
            .filter((entry: any) => entry.quantity > 0);
        return fallbackQuantity > 0
          ? [
              {
                article_id: Number(line.article_id),
              set_item_id: item.id,
                size_label: item.size_label,
                colour: null,
                quantity: fallbackQuantity,
                fixed_rate: Number(line.fixed_rates?.[item.id] ?? item.unit_price),
              rate: Number(line.custom_rate ?? line.given_rates?.[item.id] ?? item.unit_price),
              },
            ]
          : [];
      });
    return (set?.items || []).map((item: any) => ({
      article_id: Number(line.article_id),
              set_item_id: item.id,
      size_label: item.size_label,
      colour: line.colour || null,
      quantity: Number(item.quantity) * Number(line.sets || 0),
      fixed_rate: Number(line.fixed_rates?.[item.id] ?? item.unit_price),
              rate: Number(line.custom_rate ?? line.given_rates?.[item.id] ?? item.unit_price),
    }));
  });
  const invoiceSubtotal = expandedInvoiceLines.reduce(
    (total: number, line: any) => total + Number(line.quantity || 0) * Number(line.rate || 0),
    0,
  );
  const adjustmentAmount = (row: any) =>
    row.type === "percentage"
      ? Math.round(invoiceSubtotal * Number(row.value || 0) * 100) / 10000
      : Number(row.value || 0);
  const invoiceOtherDeduction = invoiceDeductions.reduce(
    (sum, row) => sum + adjustmentAmount(row),
    0,
  );
  const invoiceOtherCharges = invoiceCharges.reduce((sum, row) => sum + adjustmentAmount(row), 0);
  const invoiceTaxBase = Math.max(0, invoiceSubtotal - invoiceDiscount - invoiceOtherDeduction);
  const invoiceTaxAmount =
    invoiceTaxMode === "percentage"
      ? Math.round(invoiceTaxBase * invoiceTax * 100) / 10000
      : invoiceTax;
  const invoiceTotal = Math.max(0, invoiceTaxBase + invoiceTaxAmount + invoiceOtherCharges);
  const validateOrderStep = (form: HTMLFormElement, step: number) => {
    const fields = form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      `.order-step[data-step="${step}"] input, .order-step[data-step="${step}"] select`,
    );
    for (const field of fields) {
      if (!field.disabled && !field.checkValidity()) {
        setOrderStep(step);
        window.requestAnimationFrame(() => field.reportValidity());
        return false;
      }
    }
    if (step === 2 && poLines.some((line: any) => poLineTotal(line) <= 0)) {
      setOrderStep(2);
      setOrderStepError("Choose a priced article and enter quantities for every item.");
      return false;
    }
    if (
      step === 2 &&
      poLines.some(
        (line: any) =>
          line.order_mode === "custom" &&
          Object.entries(line.custom_sizes || {}).some(
            ([id, quantity]: any) =>
              Number(quantity) > 0 &&
              data.articles
                .flatMap((article: any) => article.sets.flatMap((set: any) => set.items))
                .find((item: any) => Number(item.id) === Number(id))?.colours &&
              !line.custom_colours?.[id]?.length,
          ),
      )
    ) {
      setOrderStep(2);
      setOrderStepError("Choose a colour for each selected size.");
      return false;
    }
    return true;
  };
  const advanceOrder = () => {
    const form = orderForm.current;
    if (!form || !validateOrderStep(form, orderStep)) return;
    setOrderStepError("");
    const values = new FormData(form);
    setOrderReview(
      Object.fromEntries(
        ["customer_name", "po_date", "customer_po_reference"].map((key) => [
          key,
          String(values.get(key) || ""),
        ]),
      ),
    );
    setOrderStep((current) => Math.min(3, current + 1));
    form.querySelector(".popup-body")?.scrollTo(0, 0);
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isEasyOrder && orderStep < 3) {
      advanceOrder();
      return;
    }
    if (
      isEasyOrder &&
      (!validateOrderStep(e.currentTarget, 1) || !validateOrderStep(e.currentTarget, 2))
    )
      return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    let path = "",
      body: any = {};
    if (type === "customer") {
      path = initial ? `customers/${initial.id}` : "customers";
      body = {
        code: f.get("code"),
        name: f.get("name"),
        tin: f.get("tin"),
        phone: f.get("phone"),
        address: f.get("address"),
        credit_days: Number(f.get("credit_days")),
        credit_limit: Number(f.get("credit_limit")),
        ...(!initial ? { opening_balance: Number(f.get("opening_balance") || 0), opening_type: f.get("opening_type"), opening_date: f.get("opening_date") || null, opening_due_date: f.get("opening_due_date") || null, opening_account_id: f.get("opening_account_id") ? Number(f.get("opening_account_id")) : null } : {}),
        status: initial?.status || "active",
      };
    } else if (type === "rep") {
      path = initial ? `sales-reps/${initial.id}` : "sales-reps";
      body = {
        code: f.get("code"),
        name: f.get("name"),
        manager_name: f.get("manager_name"),
        channel: f.get("channel"),
        default_commission_rate: Number(f.get("default_commission_rate")),
        status: initial?.status || "active",
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
    } else if (type === "po" || type === "sales_order") {
      path =
        type === "sales_order"
          ? "sales-orders/manual"
          : initial
            ? `customer-pos/${initial.id}`
            : "customer-pos";
      body = {
        customer_id: newCustomer ? null : selectedCustomerId,
        customer_name: newCustomer ? f.get("customer_name") : null,
        customer_phone: newCustomer ? f.get("customer_phone") : null,
        customer_address: newCustomer ? f.get("customer_address") : null,
        customer_credit_days: newCustomer ? Number(f.get("customer_credit_days") || 30) : null,
        sales_rep_id: Number(currentUser?.sales_rep_id || selectedRepId),
        customer_po_reference: f.get("customer_po_reference"),
        po_date: f.get("po_date"),
        sale_type: f.get("sale_type"),
        cash_amount:
          poSaleType === "mixed" ? poCashAmount : poSaleType === "cash" ? poGrandTotal : 0,
        opening_balance: newCustomer ? Number(f.get("opening_balance") || 0) : 0,
        opening_type: f.get("opening_type"), opening_date: f.get("opening_date") || null, opening_due_date: f.get("opening_due_date") || null, opening_account_id: f.get("opening_account_id") ? Number(f.get("opening_account_id")) : null,
        lines: poLines.flatMap((line: any) =>
          line.order_mode === "custom"
            ? Object.entries(line.custom_sizes || {})
                .filter(([, quantity]: any) => Number(quantity) > 0)
                .flatMap(([itemId, quantity]: any) => {
                  const item = data.articles
                    .flatMap((article: any) => article.sets.flatMap((set: any) => set.items))
                    .find((value: any) => Number(value.id) === Number(itemId));
                  const colours = line.custom_colours?.[itemId]?.length
                    ? line.custom_colours[itemId]
                    : [null];
                  return colours.map((colour: string | null) => ({
                    article_id: line.article_id,
                    colour,
                    order_mode: "size",
                    set_template_id: item?.set_template_id,
                    rate: line.custom_rate ?? null,
                    set_item_id: Number(itemId),
                    quantity: colour
                      ? Number(line.custom_colour_quantities?.[itemId]?.[colour] || 1)
                      : Number(quantity),
                  }));
                })
            : line.selected_colours?.length
              ? line.selected_colours.map((colour: string) => ({
                  ...line,
                  rate: line.custom_rate ?? null,
                  colour,
                  selected_colours: undefined,
                }))
              : [{ ...line, rate: line.custom_rate ?? null, colour: null, selected_colours: undefined }],
        ),
      };
      if (
        poLines.some(
          (line: any) =>
            line.order_mode === "custom" &&
            !Object.values(line.custom_sizes || {}).some((quantity: any) => Number(quantity) > 0),
        )
      ) {
        showNotice("Select at least one size for every customized article.");
        setBusy(false);
        return;
      }
      const allItems = data.articles.flatMap((article: any) =>
        article.sets.flatMap((set: any) => set.items),
      );
      if (
        poLines.some(
          (line: any) =>
            line.order_mode === "custom" &&
            Object.entries(line.custom_sizes || {}).some(
              ([itemId, quantity]: any) =>
                Number(quantity) > 0 &&
                String(
                  allItems.find((item: any) => Number(item.id) === Number(itemId))?.colours || "",
                ).trim() &&
                !(line.custom_colours?.[itemId] || []).length,
            ),
        )
      ) {
        showNotice("Choose at least one colour for every selected size.");
        setBusy(false);
        return;
      }
    } else if (type === "invoice") {
      if (
        invoiceLines.some((line: any) => {
          const article = data.articles.find(
            (item: any) => Number(item.id) === Number(line.article_id),
          );
          const set =
            article?.sets?.find((item: any) => Number(item.id) === Number(line.set_template_id)) ||
            article?.sets?.[0];
          return (
            line.order_mode !== "custom" &&
            (set?.items || []).some((item: any) => splitColours(item.colours || "").length) &&
            !line.colour
          );
        })
      ) {
        showNotice("Select a colour for every invoice article.");
        setBusy(false);
        return;
      }
      if (
        invoiceLines.some(
          (line: any) =>
            line.order_mode === "custom" &&
            !Object.values(line.custom_sizes || {}).some((quantity: any) => Number(quantity) > 0),
        )
      ) {
        showNotice("Select at least one size for every customized invoice article.");
        setBusy(false);
        return;
      }
      if (
        invoiceLines.some((line: any) => {
          if (line.order_mode !== "custom") return false;
          const article = data.articles.find(
            (item: any) => Number(item.id) === Number(line.article_id),
          );
          const set =
            article?.sets?.find((item: any) => Number(item.id) === Number(line.set_template_id)) ||
            article?.sets?.[0];
          return (set?.items || []).some(
            (item: any) =>
              Number(line.custom_sizes?.[item.id] || 0) > 0 &&
              splitColours(item.colours || "").length > 0 &&
              !(line.custom_colours?.[item.id] || []).length,
          );
        })
      ) {
        showNotice("Choose at least one colour for every selected invoice size.");
        setBusy(false);
        return;
      }
      path = initial ? `sales-invoices/${initial.id}` : "sales-invoices/manual";
      body = {
        customer_id: Number(f.get("customer_id")),
        sales_rep_id: Number(currentUser?.sales_rep_id || selectedRepId),
        invoice_date: f.get("invoice_date"),
        due_date: f.get("due_date") || null,
        sale_type: f.get("sale_type"),
        reference: f.get("reference"),
        discount: Number(f.get("discount") || 0),
        other_deduction: invoiceOtherDeduction,
        other_deduction_description: invoiceDeductions
          .filter((row) => Number(row.value) > 0)
          .map((row) => row.description)
          .filter(Boolean)
          .join(", "),
        deduction_adjustments: invoiceDeductions.filter((row) => Number(row.value) > 0),
        tax_type: invoiceTaxMode,
        tax_rate: invoiceTaxMode === "percentage" ? invoiceTax : 0,
        tax: invoiceTaxAmount,
        other_charges: invoiceOtherCharges,
        other_charges_description: invoiceCharges
          .filter((row) => Number(row.value) > 0)
          .map((row) => row.description)
          .filter(Boolean)
          .join(", "),
        charge_adjustments: invoiceCharges.filter((row) => Number(row.value) > 0),
        lines: expandedInvoiceLines,
      };
    } else if (type === "finished_stock") {
      path = "finished-stock-adjustments";
      body = {
        article_id: Number(f.get("article_id")),
        size_label: f.get("size_label"),
        quantity: Number(f.get("quantity")),
        adjustment_type: f.get("adjustment_type"),
        occurred_at: f.get("occurred_at"),
      };
    } else if (type === "commission") {
      path = initial
        ? initial.source_type === "manual"
          ? `commissions/manual/${initial.manual_id}`
          : `commissions/${initial.id}`
        : "commissions/manual";
      body = {
        sales_rep_id: Number(f.get("sales_rep_id")),
        customer_id: f.get("customer_id") ? Number(f.get("customer_id")) : null,
        invoice_id: f.get("invoice_id") ? Number(f.get("invoice_id")) : null,
        receipt_id: f.get("receipt_id") ? Number(f.get("receipt_id")) : null,
        commission_date: f.get("commission_date"),
        basis_amount: Number(f.get("basis_amount") || 0),
        commission_rate: Number(f.get("commission_rate") || 0),
        commission_amount: Number(f.get("commission_amount")),
        commission_status: f.get("commission_status") || "eligible",
        notes: f.get("notes"),
      };
    } else {
      path = "customer-receipts";
      body = {
        invoice_id: Number(f.get("invoice_id")),
        collector_sales_rep_id: Number(f.get("collector_sales_rep_id")),
        payment_account_id: Number(f.get("payment_account_id")) || null,
        receipt_date: f.get("receipt_date"),
        collection_type: f.get("collection_type"),
        payment_method: f.get("payment_method"),
        commission_decision: f.get("commission_decision"),
        reference: f.get("reference"),
        amount: Number(f.get("amount")),
      };
    }
    try {
      await save(
        path,
        body,
        initial && ["article", "po", "customer", "rep", "commission", "invoice"].includes(type)
          ? "PUT"
          : "POST",
      );
    } catch (error) {
      setSubmitError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="backdrop" onMouseDown={close}>
      <form
        className={`modal ${type === "po" || type === "sales_order" || type === "invoice" ? "po-modal" : type === "article" ? "price-modal" : type === "commission" ? "commission-modal" : type === "receipt" ? "collection-modal" : ""}`}
        ref={orderForm}
        noValidate={isEasyOrder}
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>SALES MASTER AND TRANSACTION</span>
          <h2>
            {type === "po"
              ? initial
                ? `Manage ${initial.number}`
                : "New Customer PO"
              : type === "sales_order"
                ? "Create Sales Order"
                : type === "invoice"
                  ? initial
                    ? `Edit ${initial.number}`
                    : "Create Manual Invoice"
                  : type === "commission"
                    ? initial
                      ? "Edit Commission"
                      : "Add Manual Commission"
                    : type === "finished_stock"
                      ? "Adjust Finished Goods Stock"
                      : type === "receipt"
                        ? "Record Customer Collection"
                        : initial && type === "article"
                          ? "Edit article and set types"
                          : `Add ${type}`}
          </h2>
        </div>
        <div className="popup-body">
          {type === "customer" ? (
            <>
              <div className="form-row">
                <label>
                  Customer code
                  <input name="code" defaultValue={initial?.code} required />
                </label>
                <label>
                  Customer name
                  <input name="name" defaultValue={initial?.name} required />
                </label>
                <label>
                  TIN
                  <input name="tin" defaultValue={initial?.tin} />
                </label>
                <label>
                  Phone
                  <input name="phone" defaultValue={initial?.phone} />
                </label>
                <label>
                  Credit days
                  <input
                    name="credit_days"
                    type="number"
                    defaultValue={initial?.credit_days ?? 30}
                    required
                  />
                </label>
                <label>
                  Credit limit
                  <input
                    name="credit_limit"
                    type="number"
                    defaultValue={initial?.credit_limit ?? 0}
                    required
                  />
                </label>
              </div>
              <label>
                Address
                <input name="address" defaultValue={initial?.address} />
              </label>
              {!initial && <CustomerOpeningFields accounts={data.opening_accounts || []} />}
            </>
          ) : type === "rep" ? (
            <>
              <div className="form-row">
                <label>
                  Rep code
                  <input name="code" defaultValue={initial?.code} required />
                </label>
                <label>
                  Name
                  <input name="name" defaultValue={initial?.name} required />
                </label>
                <label>
                  Sales manager
                  <input name="manager_name" defaultValue={initial?.manager_name} />
                </label>
                <label>
                  Channel
                  <select name="channel" defaultValue={initial?.channel || "direct_sales"}>
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
                  defaultValue={initial?.default_commission_rate ?? 0}
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
                                i === setIndex ? { ...x, name: e.target.value } : x,
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
                          onClick={() => setSetTypes((all) => all.filter((_, i) => i !== setIndex))}
                        >
                          <Trash2 />
                        </button>
                      )}
                    </div>
                    <div className="set-size-head price-list-grid">
                      <span>Size</span>
                      <span>Item code</span>
                      <span>Colours</span>
                      <span>Production cost</span>
                      <span>Pieces in set</span>
                      <span>Selling price</span>
                      <span></span>
                    </div>
                    {set.items.map((item: any, itemIndex: number) => (
                      <div className="set-size-row price-list-grid" key={itemIndex}>
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
                                        j === itemIndex ? { ...v, size_label: e.target.value } : v,
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                          required
                        />
                        <input
                          placeholder="Item code"
                          value={item.item_code || ""}
                          onChange={(e) =>
                            setSetTypes((all) =>
                              all.map((x, i) =>
                                i === setIndex
                                  ? {
                                      ...x,
                                      items: x.items.map((v: any, j: number) =>
                                        j === itemIndex ? { ...v, item_code: e.target.value } : v,
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                        <ColourMultiPicker
                          value={splitColours(item.colours || "")}
                          allowCustom
                          label="Select or type colours"
                          onChange={(colours) =>
                            setSetTypes((all) =>
                              all.map((x, i) =>
                                i === setIndex
                                  ? {
                                      ...x,
                                      items: x.items.map((v: any, j: number) =>
                                        j === itemIndex ? { ...v, colours: colours.join(", ") } : v,
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Cost"
                          value={item.production_cost ?? ""}
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
                                              production_cost:
                                                e.target.value === ""
                                                  ? null
                                                  : Number(e.target.value),
                                            }
                                          : v,
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
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
                                      items: x.items.filter((_: any, j: number) => j !== itemIndex),
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
                                      item_code: "",
                                      colours: "",
                                      production_cost: null,
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
                        items: [
                          {
                            size_label: "",
                            item_code: "",
                            colours: "",
                            production_cost: null,
                            quantity: 1,
                            unit_price: 0,
                          },
                        ],
                      },
                    ])
                  }
                >
                  <Plus /> Add another set type
                </button>
              </div>
            </>
          ) : type === "finished_stock" ? (
            <>
              <div className="form-row">
                <label>
                  Article
                  <select
                    name="article_id"
                    value={inventoryArticleId}
                    onChange={(event) => setInventoryArticleId(Number(event.target.value))}
                    required
                  >
                    {data.articles.map((article: any) => (
                      <option value={article.id} key={article.id}>
                        {article.code} — {article.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Size
                  <select name="size_label" required>
                    {[
                      ...new Set(
                        (
                          data.articles.find(
                            (article: any) => Number(article.id) === inventoryArticleId,
                          )?.sets || []
                        ).flatMap((set: any) => set.items.map((item: any) => item.size_label)),
                      ),
                    ].map((size: any) => (
                      <option value={size} key={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Adjustment
                  <select name="adjustment_type">
                    <option value="increase">Increase / stock in</option>
                    <option value="decrease">Decrease / stock out</option>
                  </select>
                </label>
                <label>
                  Quantity
                  <input name="quantity" type="number" min="0.01" step="0.01" required />
                </label>
                <label>
                  Date
                  <input
                    name="occurred_at"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>
              </div>
              <p className="report-note">
                Invoices reduce this stock automatically. Deleting an invoice returns the exact
                article and size quantities.
              </p>
            </>
          ) : type === "po" || type === "sales_order" ? (
            <>
              <nav className="easy-order-steps" aria-label="Order progress">
                {["Customer", "Items", "Review"].map((label, index) => (
                  <span
                    key={label}
                    className={
                      orderStep === index + 1 ? "active" : orderStep > index + 1 ? "complete" : ""
                    }
                    aria-current={orderStep === index + 1 ? "step" : undefined}
                  >
                    <b>{orderStep > index + 1 ? <Check size={14} /> : index + 1}</b>
                    {label}
                  </span>
                ))}
              </nav>
              {orderStepError && (
                <div className="error" role="alert">
                  {orderStepError}
                </div>
              )}
              <fieldset className="order-step" data-step="1" hidden={orderStep !== 1}>
                <legend>Who is this order for?</legend>
                <p>Choose a customer and check the order details.</p>
                <div className="form-row">
                  {!initial && (
                    <div className="customer-mode-switch" role="group" aria-label="Customer type">
                      <button
                        type="button"
                        className={!newCustomer ? "active" : ""}
                        onClick={() => setNewCustomer(false)}
                      >
                        Existing customer
                      </button>
                      <button
                        type="button"
                        className={newCustomer ? "active" : ""}
                        onClick={() => setNewCustomer(true)}
                      >
                        <Plus /> New customer
                      </button>
                    </div>
                  )}
                  {!newCustomer && (
                    <OrderCustomerPicker
                      customers={data.customers}
                      selectedId={selectedCustomerId}
                      select={setSelectedCustomerId}
                    />
                  )}
                  {newCustomer && (
                    <>
                      <div className="customer-mode-row">
                        <b>New customer details</b>
                      </div>
                      <label>
                        New customer name
                        <input
                          name="customer_name"
                          required
                          placeholder="Customer or company name"
                        />
                      </label>
                      <label>
                        Phone
                        <input name="customer_phone" placeholder="Contact number" />
                      </label>
                      <label>
                        Credit days
                        <input
                          name="customer_credit_days"
                          type="number"
                          min="0"
                          max="365"
                          defaultValue="30"
                          required
                        />
                      </label>
                      <label>
                        Address
                        <input name="customer_address" placeholder="Billing or delivery address" />
                      </label>
                      <CustomerOpeningFields accounts={data.opening_accounts || []} />
                    </>
                  )}
                  <label>
                    Salesperson
                    {currentUser?.sales_rep_id ? (
                      <>
                        <input type="hidden" name="sales_rep_id" value={currentUser.sales_rep_id} />
                        <div className="locked-salesperson">
                          <ShieldCheck />
                          <span>
                            <b>
                              {currentUser.sales_rep_code} — {currentUser.sales_rep_name}
                            </b>
                            <small>Automatically assigned from your login</small>
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <select
                          name="sales_rep_id"
                          value={selectedRepId}
                          onChange={(event) => setSelectedRepId(Number(event.target.value))}
                          required
                        >
                          {visibleReps.map((x: any) => (
                            <option value={x.id} key={x.id}>
                              {x.code} — {x.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </label>
                  <label>
                    Customer reference (optional)
                    <input
                      name="customer_po_reference"
                      defaultValue={initial?.customer_po_reference}
                    />
                  </label>
                  <label>
                    {type === "sales_order" ? "Order date" : "PO date"}
                    <input
                      name="po_date"
                      type="date"
                      defaultValue={
                        initial?.po_date ||
                        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" })
                      }
                      required
                    />
                  </label>
                  <label>
                    Sale type
                    <select
                      name="sale_type"
                      value={poSaleType}
                      onChange={(event) => setPoSaleType(event.target.value)}
                    >
                      <option value="credit">Credit sale</option>
                      <option value="cash">Cash sale</option>
                      <option value="mixed">Part cash / credit</option>
                    </select>
                  </label>
                </div>
              </fieldset>
              <fieldset className="order-step" data-step="2" hidden={orderStep !== 2}>
                <legend>Add the items</legend>
                <p>
                  Choose an article, colours and number of sets. Use Customize only when you need
                  specific sizes.
                </p>
                {poSaleType === "mixed" && (
                  <div className="form-row payment-split">
                    <label>
                      Cash payment amount
                      <input
                        name="cash_amount"
                        type="number"
                        min="0.01"
                        max={Math.max(0.01, poGrandTotal - 0.01)}
                        step="0.01"
                        value={poCashAmount}
                        onChange={(event) => setPoCashAmount(Number(event.target.value))}
                        required
                      />
                    </label>
                    <label>
                      Credit balance
                      <input
                        type="text"
                        value={money(Math.max(0, poGrandTotal - poCashAmount))}
                        readOnly
                      />
                    </label>
                  </div>
                )}
                {poSaleType === "cash" && (
                  <p className="report-note">
                    Order amount payable in cash: <b>{money(poGrandTotal)}</b>.
                  </p>
                )}
                {poSaleType === "credit" && (
                  <p className="report-note">
                    Order amount payable on credit: <b>{money(poGrandTotal)}</b>.
                  </p>
                )}
                <div className="po-lines">
                  <div className="po-lines-head">
                    <div>
                      <b>Order items</b>
                      <small>Add one or more articles below.</small>
                    </div>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() =>
                        setPoLines((lines) => [
                          ...lines,
                          {
                            article_id: firstArticleId,
                            colour: "",
                            selected_colours: [],
                            order_mode: "badge",
                            set_template_id: firstSetId,
                            set_item_id: firstItemId,
                            quantity: 1,
                          },
                        ])
                      }
                    >
                      <Plus /> Add article
                    </button>
                  </div>
                  {poLines.map((line, index) => {
                    const selectedArticle = data.articles.find(
                      (article: any) => Number(article.id) === Number(line.article_id),
                    );
                    const selectableItems = (selectedArticle?.sets || [])
                      .filter((set: any) => set.status !== "inactive")
                      .flatMap((set: any) => set.items);
                    const selectedSizeCount = Object.values(line.custom_sizes || {}).filter(
                      (quantity: any) => Number(quantity) > 0,
                    ).length;
                    return (
                      <div className="po-line" key={index}>
                        <label>
                          Article
                          <div className="article-picker-control">
                            <ArticleSearchPicker
                              articles={data.articles}
                              selectedId={Number(line.article_id)}
                              listId={`po-article-options-${index}`}
                              onSelect={(article) => {
                                const set = article?.sets?.find(
                                  (s: any) => s.status !== "inactive",
                                );
                                setPoLines((lines) =>
                                  lines.map((x, i) =>
                                    i === index
                                      ? {
                                          ...x,
                                          article_id: Number(article.id),
                                          colour: "",
                                          selected_colours: [],
                                          set_template_id: Number(set?.id || 0),
                                          set_item_id: Number(set?.items?.[0]?.id || 0),
                                          custom_sizes: {},
                                          custom_colours: {},
                                          custom_colour_quantities: {},
                                        }
                                      : x,
                                  ),
                                );
                              }}
                            />
                            <button
                              type="button"
                              className={`article-details-button ${expandedPoLine === index ? "active" : ""}`}
                              aria-expanded={expandedPoLine === index}
                              title={
                                expandedPoLine === index
                                  ? "Hide article details"
                                  : "Show article details"
                              }
                              onClick={() =>
                                setExpandedPoLine(expandedPoLine === index ? null : index)
                              }
                            >
                              <Eye />
                              <span>Details</span>
                              <ChevronDown />
                            </button>
                          </div>
                        </label>
                        <div className="order-method-field">
                          <span>Order method</span>
                          <div
                            className="order-method-options"
                            role="group"
                            aria-label="Order method"
                          >
                            <button
                              type="button"
                              className={line.order_mode === "badge" ? "active" : ""}
                              aria-pressed={line.order_mode === "badge"}
                              onClick={() =>
                                setPoLines((lines) =>
                                  lines.map((x, i) =>
                                    i === index ? { ...x, order_mode: "badge" } : x,
                                  ),
                                )
                              }
                            >
                              <ClipboardCheck />
                              <span>
                                <b>Complete set</b>
                                <small>Default pack</small>
                              </span>
                            </button>
                            <button
                              type="button"
                              className={line.order_mode === "custom" ? "active" : ""}
                              aria-pressed={line.order_mode === "custom"}
                              onClick={() =>
                                setPoLines((lines) =>
                                  lines.map((x, i) =>
                                    i === index
                                      ? {
                                          ...x,
                                          order_mode: "custom",
                                          custom_sizes: Object.keys(x.custom_sizes || {}).length
                                            ? x.custom_sizes
                                            : {},
                                        }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <Settings />
                              <span>
                                <b>Customize</b>
                                <small>Sizes & colours</small>
                              </span>
                            </button>
                          </div>
                        </div>
                        <label>
                          {line.order_mode === "custom" ? "Colours" : "Colour / variant"}
                          {line.order_mode === "custom" ? (
                            <div className="custom-size-summary">Choose colours per size below</div>
                          ) : (
                            <ColourMultiPicker
                              value={line.selected_colours || []}
                              options={
                                [
                                  ...new Set(
                                    (
                                      data.articles.find(
                                        (a: any) => Number(a.id) === Number(line.article_id),
                                      )?.sets || []
                                    ).flatMap((set: any) =>
                                      set.items.flatMap((item: any) =>
                                        splitColours(item.colours || ""),
                                      ),
                                    ),
                                  ),
                                ] as string[]
                              }
                              label="Any / not specified"
                              onChange={(colours) =>
                                setPoLines((lines) =>
                                  lines.map((x, i) =>
                                    i === index
                                      ? {
                                          ...x,
                                          selected_colours: colours,
                                          colour: colours[0] || "",
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                          )}
                        </label>
                          <RateFields items={selectableItems} rate={line.custom_rate} change={rate => setPoLines(lines => lines.map((value,i) => i === index ? {...value,custom_rate:rate} : value))} />
                        <label>
                          {line.order_mode === "badge" ? "Set template" : "Selected sizes"}
                      {line.order_mode === "badge" ? (
                            <select
                              value={line.set_template_id}
                              onChange={(e) =>
                                setPoLines((lines) =>
                                  lines.map((x, i) =>
                                    i === index
                                      ? { ...x, set_template_id: Number(e.target.value) }
                                      : x,
                                  ),
                                )
                              }
                              required
                            >
                              {data.articles
                                .find((a: any) => Number(a.id) === Number(line.article_id))
                                ?.sets.filter((s: any) => s.status !== "inactive")
                                .map((set: any) => (
                                  <option value={set.id} key={set.id}>
                                    {set.name} ({set.pieces} pcs · {money(set.set_price)})
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <div className="custom-size-summary">
                              {selectedSizeCount
                                ? `${selectedSizeCount} size${selectedSizeCount === 1 ? "" : "s"} selected`
                                : "Select sizes below"}
                            </div>
                          )}
                        </label>
                        {line.order_mode === "badge" ? (
                          <label>
                            Number of sets
                            <input
                              type="number"
                              step="1"
                              min="1"
                              value={line.quantity}
                              onChange={(e) =>
                                setPoLines((lines) =>
                                  lines.map((x, i) =>
                                    i === index ? { ...x, quantity: Number(e.target.value) } : x,
                                  ),
                                )
                              }
                              required
                            />
                          </label>
                        ) : (
                          <div className="custom-size-summary pieces-summary">
                            <small>Total pieces</small>
                            <b>
                              {Object.entries(line.custom_sizes || {}).reduce(
                                (sum: number, [itemId, quantity]: any) => {
                                  const colourTotal = Object.values(
                                    line.custom_colour_quantities?.[itemId] || {},
                                  ).reduce(
                                    (subtotal: number, value: any) => subtotal + Number(value || 0),
                                    0,
                                  );
                                  return sum + (colourTotal || Number(quantity || 0));
                                },
                                0,
                              )}
                            </b>
                          </div>
                        )}
                        <div className="po-line-total">
                          <small>Line total</small>
                          <b>{money(poLineTotal(line))}</b>
                        </div>
                        <button
                          type="button"
                          className="icon-action delete"
                          title="Remove article"
                          disabled={poLines.length === 1}
                          onClick={() => setPoLines((lines) => lines.filter((_, i) => i !== index))}
                        >
                          <Trash2 />
                        </button>
                        {line.order_mode === "custom" && (
                          <div className="custom-size-picker">
                            <div className="custom-size-head">
                              <b>Select</b>
                              <b>Size</b>
                              <b>Item code</b>
                              <b>Colour quantities</b>
                              <b>Price</b>
                              <b>Available</b>
                              <b>Size total</b>
                            </div>
                            {selectableItems.map((item: any) => {
                              const quantity = Number(line.custom_sizes?.[item.id] || 0);
                              const itemColours = [
                                ...new Set(
                                  String(item.colours || "")
                                    .split(",")
                                    .map((colour: string) => colour.trim())
                                    .filter(Boolean),
                                ),
                              ] as string[];
                              const chosenColours = line.custom_colours?.[item.id] || [];
                              const sizeTotal =
                                Object.values(
                                  line.custom_colour_quantities?.[item.id] || {},
                                ).reduce(
                                  (sum: number, value: any) => sum + Number(value || 0),
                                  0,
                                ) || quantity;
                              return (
                                <div
                                  className={`custom-size-row ${quantity > 0 ? "selected" : ""}`}
                                  key={item.id}
                                >
                                  <input
                                    type="checkbox"
                                    aria-label={`Select size ${item.size_label}`}
                                    checked={quantity > 0}
                                    onChange={(event) =>
                                      setPoLines((lines) =>
                                        lines.map((value, i) =>
                                          i === index
                                            ? {
                                                ...value,
                                                custom_sizes: {
                                                  ...(value.custom_sizes || {}),
                                                  [item.id]: event.target.checked ? 1 : 0,
                                                },
                                                custom_colours: {
                                                  ...(value.custom_colours || {}),
                                                  [item.id]:
                                                    event.target.checked && itemColours.length
                                                      ? [itemColours[0]]
                                                      : [],
                                                },
                                                custom_colour_quantities: {
                                                  ...(value.custom_colour_quantities || {}),
                                                  [item.id]:
                                                    event.target.checked && itemColours.length
                                                      ? { [itemColours[0]]: 1 }
                                                      : {},
                                                },
                                              }
                                            : value,
                                        ),
                                      )
                                    }
                                  />
                                  <b>{item.size_label}</b>
                                  <span>{item.item_code || "—"}</span>
                                  <div className="size-colour-options">
                                    {itemColours.length ? (
                                      itemColours.map((colour: string) => (
                                        <label
                                          className={
                                            chosenColours.includes(colour) ? "selected" : ""
                                          }
                                          key={colour}
                                        >
                                          <input
                                            type="checkbox"
                                            aria-label={`${colour} for size ${item.size_label}`}
                                            disabled={quantity <= 0}
                                            checked={chosenColours.includes(colour)}
                                            onChange={(event) =>
                                              setPoLines((lines) =>
                                                lines.map((value, i) => {
                                                  if (i !== index) return value;
                                                  const current =
                                                    value.custom_colours?.[item.id] || [];
                                                  return {
                                                    ...value,
                                                    custom_colours: {
                                                      ...(value.custom_colours || {}),
                                                      [item.id]: event.target.checked
                                                        ? [...new Set([...current, colour])]
                                                        : current.filter(
                                                            (entry: string) => entry !== colour,
                                                          ),
                                                    },
                                                    custom_colour_quantities: {
                                                      ...(value.custom_colour_quantities || {}),
                                                      [item.id]: {
                                                        ...(value.custom_colour_quantities?.[
                                                          item.id
                                                        ] || {}),
                                                        [colour]: event.target.checked ? 1 : 0,
                                                      },
                                                    },
                                                  };
                                                }),
                                              )
                                            }
                                          />
                                          <i
                                            className="colour-swatch"
                                            style={{ background: colourHex(colour) }}
                                            aria-hidden="true"
                                          />
                                          <span>{colour}</span>
                                          {chosenColours.includes(colour) && (
                                            <input
                                              aria-label={`${colour} pieces for size ${item.size_label}`}
                                              type="number"
                                              min="1"
                                              step="1"
                                              value={Number(
                                                line.custom_colour_quantities?.[item.id]?.[
                                                  colour
                                                ] || 1,
                                              )}
                                              onChange={(event) =>
                                                setPoLines((lines) =>
                                                  lines.map((value, i) =>
                                                    i === index
                                                      ? {
                                                          ...value,
                                                          custom_colour_quantities: {
                                                            ...(value.custom_colour_quantities ||
                                                              {}),
                                                            [item.id]: {
                                                              ...(value.custom_colour_quantities?.[
                                                                item.id
                                                              ] || {}),
                                                              [colour]: Number(event.target.value),
                                                            },
                                                          },
                                                        }
                                                      : value,
                                                  ),
                                                )
                                              }
                                            />
                                          )}
                                        </label>
                                      ))
                                    ) : (
                                      <small>No colour specified</small>
                                    )}
                                  </div>
                                  <span>{money(item.unit_price)}</span>
                                  <span>
                                    {Number(
                                      (data.finished_stock || []).find(
                                        (stock: any) =>
                                          Number(stock.article_id) === Number(line.article_id) &&
                                          stock.size_label === item.size_label,
                                      )?.quantity || 0,
                                    ).toLocaleString()}
                                  </span>
                                  {itemColours.length ? (
                                    <b>{sizeTotal}</b>
                                  ) : (
                                    <input
                                      aria-label={`Pieces for size ${item.size_label}`}
                                      type="number"
                                      min="1"
                                      step="1"
                                      disabled={quantity <= 0}
                                      value={quantity > 0 ? quantity : 1}
                                      onChange={(event) =>
                                        setPoLines((lines) =>
                                          lines.map((value, i) =>
                                            i === index
                                              ? {
                                                  ...value,
                                                  custom_sizes: {
                                                    ...(value.custom_sizes || {}),
                                                    [item.id]: Number(event.target.value),
                                                  },
                                                }
                                              : value,
                                          ),
                                        )
                                      }
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {expandedPoLine === index && (
                          <div className="po-article-details">
                            <div className="po-detail-head">
                              <b>Size</b>
                              <b>Item code</b>
                              <b>Colours</b>
                              <b>Pieces/set</b>
                              <b>Price</b>
                              <b>Available stock</b>
                            </div>
                            {(
                              data.articles.find(
                                (article: any) => Number(article.id) === Number(line.article_id),
                              )?.sets || []
                            )
                              .flatMap((set: any) => set.items)
                              .filter(
                                (item: any) =>
                                  !(line.selected_colours || []).length ||
                                  (line.selected_colours || []).some((selected: string) =>
                                    splitColours(item.colours || "").some(
                                      (colour) => colour.toLowerCase() === selected.toLowerCase(),
                                    ),
                                  ),
                              )
                              .map((item: any) => (
                                <div className="po-detail-row" key={item.id}>
                                  <span>{item.size_label}</span>
                                  <span>{item.item_code || "—"}</span>
                                  <span>
                                    {(line.selected_colours || []).join(", ") ||
                                      item.colours ||
                                      "—"}
                                  </span>
                                  <span>{item.quantity}</span>
                                  <span>{money(item.unit_price)}</span>
                                  <span>
                                    {Number(
                                      (data.finished_stock || []).find(
                                        (stock: any) =>
                                          Number(stock.article_id) === Number(line.article_id) &&
                                          stock.size_label === item.size_label,
                                      )?.quantity || 0,
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="po-grand-total">
                    <span>Order total</span>
                    <span className="po-total-pieces">
                      <small>Total pieces</small>
                      <b>{poTotalPieces.toLocaleString()} pcs</b>
                    </span>
                    <strong>{money(poGrandTotal)}</strong>
                  </div>
                </div>
              </fieldset>
              {orderStep === 3 && (
                <section className="easy-order-review">
                  <h3>Ready to create your order?</h3>
                  <p>Check the customer and items below. Use Back to make changes.</p>
                  <div className="easy-review-details">
                    <div>
                      <small>Customer</small>
                      <b>
                        {newCustomer
                          ? orderReview.customer_name
                          : data.customers.find(
                              (customer: any) => Number(customer.id) === selectedCustomerId,
                            )?.name}
                      </b>
                    </div>
                    <div>
                      <small>Order date</small>
                      <b>{orderReview.po_date}</b>
                    </div>
                    <div>
                      <small>Salesperson</small>
                      <b>
                        {currentUser?.sales_rep_name ||
                          data.reps.find((rep: any) => Number(rep.id) === selectedRepId)?.name}
                      </b>
                    </div>
                    <div>
                      <small>Payment</small>
                      <b>
                        {poSaleType === "mixed"
                          ? `Cash ${money(poCashAmount)} · Credit ${money(poGrandTotal - poCashAmount)}`
                          : poSaleType === "cash"
                            ? "Cash"
                            : "Credit"}
                      </b>
                    </div>
                    {orderReview.customer_po_reference && (
                      <div>
                        <small>Customer reference</small>
                        <b>{orderReview.customer_po_reference}</b>
                      </div>
                    )}
                  </div>
                  <div className="easy-review-items">
                    {poLines.map((line: any, index: number) => {
                      const article = data.articles.find(
                        (item: any) => Number(item.id) === Number(line.article_id),
                      );
                      return (
                        <div key={index}>
                          <span>
                            <b>
                              {article?.code} · {article?.name}
                            </b>
                            <small>
                              {line.order_mode === "custom"
                                ? "Custom sizes and colours"
                                : `${line.quantity} set(s) · ${(line.selected_colours || []).join(", ") || "No colour specified"}`}
                            </small>
                          </span>
                          <strong>{money(poLineTotal(line))}</strong>
                        </div>
                      );
                    })}
                  </div>
                  <div className="po-grand-total">
                    <span>{poTotalPieces.toLocaleString()} pieces</span>
                    <strong>{money(poGrandTotal)}</strong>
                  </div>
                </section>
              )}
            </>
          ) : type === "invoice" ? (
            <>
              <div className="form-row">
                <label>
                  Customer
                  <select name="customer_id" defaultValue={initial?.customer_id} required>
                    {data.customers.map((customer: any) => (
                      <option value={customer.id} key={customer.id}>
                        {customer.code} — {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Salesperson
                  {currentUser?.sales_rep_id ? (
                    <>
                      <input type="hidden" name="sales_rep_id" value={currentUser.sales_rep_id} />
                      <div className="locked-salesperson">
                        <ShieldCheck />
                        <span>
                          <b>
                            {currentUser.sales_rep_code} — {currentUser.sales_rep_name}
                          </b>
                          <small>Automatically assigned from your login</small>
                        </span>
                      </div>
                    </>
                  ) : (
                    <select
                      name="sales_rep_id"
                      value={selectedRepId}
                      onChange={(event) => setSelectedRepId(Number(event.target.value))}
                      required
                    >
                      {data.reps
                        .filter((rep: any) => rep.status === "active")
                        .map((rep: any) => (
                          <option value={rep.id} key={rep.id}>
                            {rep.code} — {rep.name}
                          </option>
                        ))}
                    </select>
                  )}
                </label>
                <label>
                  Invoice date
                  <input
                    name="invoice_date"
                    type="date"
                    required
                    defaultValue={initial?.invoice_date || new Date().toISOString().slice(0, 10)}
                  />
                </label>
                <label>
                  Due date
                  <input name="due_date" type="date" defaultValue={initial?.due_date} />
                </label>
                <label>
                  Sale type
                  <select name="sale_type" defaultValue={initial?.sale_type || "credit"}>
                    <option value="credit">Credit sale</option>
                    <option value="cash">Cash sale</option>
                    <option value="mixed">Mixed payment</option>
                  </select>
                </label>
                <label>
                  Reference
                  <input
                    name="reference"
                    defaultValue={initial?.reference}
                    placeholder="Customer reference / note"
                  />
                </label>
              </div>
              <div className="po-lines">
                <div className="po-lines-head">
                  <div>
                    <b>Invoice items</b>
                    <small>
                      Use the default complete set or customize exact sizes, colours and quantities.
                    </small>
                  </div>
                  <button type="button" className="secondary-action" onClick={addInvoiceArticle}>
                    <Plus /> Add article
                  </button>
                </div>
                {invoiceLines.map((line, index) => {
                  const article = data.articles.find(
                    (item: any) => Number(item.id) === Number(line.article_id),
                  );
                  const set =
                    article?.sets?.find(
                      (item: any) => Number(item.id) === Number(line.set_template_id),
                    ) || article?.sets?.[0];
                  const colours = [
                    ...new Set(
                      (set?.items || [])
                        .flatMap((item: any) => String(item.colours || "").split(","))
                        .map((colour: any) => String(colour).trim())
                        .filter(Boolean),
                    ),
                  ] as string[];
                  const piecesPerSet = Number(
                    set?.pieces ||
                      (set?.items || []).reduce(
                        (sum: number, item: any) => sum + Number(item.quantity || 0),
                        0,
                      ),
                  );
                  const setPrice = line.custom_rate != null ? Number(line.custom_rate)*piecesPerSet : Number(
                    set?.set_price ||
                      (set?.items || []).reduce(
                        (sum: number, item: any) =>
                          sum + Number(item.quantity || 0) * Number(line.custom_rate ?? line.given_rates?.[item.id] ?? item.unit_price ?? 0),
                        0,
                      ),
                  );
                  const customPieces = (set?.items || []).reduce(
                    (sum: number, item: any) =>
                      sum +
                      (Object.values(line.custom_colour_quantities?.[item.id] || {}).reduce(
                        (subtotal: number, quantity: any) => subtotal + Number(quantity || 0),
                        0,
                      ) || Number(line.custom_sizes?.[item.id] || 0)),
                    0,
                  );
                  const customTotal = (set?.items || []).reduce(
                    (sum: number, item: any) =>
                      sum +
                      Number(item.unit_price || 0) *
                        (Object.values(line.custom_colour_quantities?.[item.id] || {}).reduce(
                          (subtotal: number, quantity: any) => subtotal + Number(quantity || 0),
                          0,
                        ) || Number(line.custom_sizes?.[item.id] || 0)),
                    0,
                  );
                  const stockForSize = (size: any) =>
                    Number(
                      (data.finished_stock || []).find(
                        (stock: any) =>
                          Number(stock.article_id) === Number(line.article_id) &&
                          String(stock.size_label) === String(size),
                      )?.quantity || 0,
                    );
                  return (
                    <div className="invoice-item-card" key={index}>
                      <div className="invoice-item-header">
                        <label>
                          Article
                          <ArticleSearchPicker
                            key={`${index}-${line.article_id}`}
                            articles={invoicableArticles}
                            selectedId={Number(line.article_id)}
                            listId={`invoice-article-options-${index}`}
                            onSelect={(nextArticle) => {
                              const nextSet =
                                nextArticle?.sets?.find(
                                  (item: any) =>
                                    item.status !== "inactive" &&
                                    (Number(item.set_price || 0) > 0 ||
                                      item.items?.some(
                                        (entry: any) => Number(entry.unit_price || 0) > 0,
                                      )),
                                ) || nextArticle?.sets?.[0];
                              setInvoiceLines((lines) =>
                                lines.map((value, i) =>
                                  i === index
                                    ? {
                                        ...value,
                                        article_id: Number(nextArticle.id),
                                        set_template_id: Number(nextSet?.id || 0),
                                        colour: "",
                                        custom_sizes: {},
                                        custom_colours: {},
                                        custom_colour_quantities: {},
                                      }
                                    : value,
                                ),
                              );
                            }}
                          />
                        </label>
                        <div className="order-method-field">
                          <span>Order method</span>
                          <div className="order-method-options">
                            <button
                              type="button"
                              className={line.order_mode !== "custom" ? "active" : ""}
                              onClick={() =>
                                setInvoiceLines((lines) =>
                                  lines.map((value, i) =>
                                    i === index ? { ...value, order_mode: "badge" } : value,
                                  ),
                                )
                              }
                            >
                              <ClipboardCheck />
                              <span>
                                <b>Complete set</b>
                                <small>Default pack</small>
                              </span>
                            </button>
                            <button
                              type="button"
                              className={line.order_mode === "custom" ? "active" : ""}
                              onClick={() =>
                                setInvoiceLines((lines) =>
                                  lines.map((value, i) =>
                                    i === index ? { ...value, order_mode: "custom" } : value,
                                  ),
                                )
                              }
                            >
                              <Settings />
                              <span>
                                <b>Customize</b>
                                <small>Sizes & colours</small>
                              </span>
                            </button>
                          </div>
                        </div>
                        <div className="invoice-line-amount">
                          <small>Line total</small>
                          <b>
                            {money(
                              line.order_mode === "custom"
                                ? customTotal
                                : Number(line.sets || 0) * setPrice,
                            )}
                          </b>
                        </div>
                        <button
                          type="button"
                          title="Remove invoice item"
                          className="icon-action delete"
                          disabled={invoiceLines.length === 1}
                          onClick={() =>
                            setInvoiceLines((lines) => lines.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 />
                        </button>
                      </div>
                      <RateFields items={set?.items || []} rate={line.custom_rate} change={rate => setInvoiceLines(lines => lines.map((value,i) => i === index ? {...value,custom_rate:rate} : value))} />
                      {line.order_mode !== "custom" ? (
                        <div className="invoice-complete-controls">
                          <label>
                            Colour / variant
                            <ColourMultiPicker
                              key={`${line.article_id}-${line.set_template_id}`}
                              value={line.colour ? [line.colour] : []}
                              options={colours}
                              label="Select colour"
                              onChange={(selected) =>
                                setInvoiceLines((lines) =>
                                  lines.map((value, i) =>
                                    i === index
                                      ? { ...value, colour: selected[selected.length - 1] || "" }
                                      : value,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label>
                            Number of sets
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={line.sets}
                              onChange={(e) =>
                                setInvoiceLines((lines) =>
                                  lines.map((value, i) =>
                                    i === index
                                      ? { ...value, sets: Number(e.target.value) }
                                      : value,
                                  ),
                                )
                              }
                              required
                            />
                          </label>
                          <div className="invoice-piece-total">
                            <small>Total quantity</small>
                            <b>{Number(line.sets || 0) * piecesPerSet} pcs</b>
                            <span>{piecesPerSet} pieces per set</span>
                          </div>
                          <details className="invoice-breakdown-details">
                            <summary>
                              View set breakdown <ChevronDown />
                            </summary>
                            <div className="invoice-size-breakdown">
                              {(set?.items || []).map((item: any) => (
                                <span className="invoice-size-chip" key={item.id}>
                                  <b>Size {item.size_label}</b>
                                  <small>
                                    {Number(item.quantity || 0) * Number(line.sets || 0)} pcs
                                  </small>
                                </span>
                              ))}
                            </div>
                          </details>
                        </div>
                      ) : (
                        <div className="invoice-customize">
                          <div className="invoice-custom-head">
                            <b>Select</b>
                            <b>Size</b>
                            <b>Item code</b>
                            <b>Colour and quantity</b>
                            <b>Rate</b>
                          </div>
                          {(set?.items || []).map((item: any) => {
                            const itemColours = splitColours(item.colours || "");
                            const selected = line.custom_colours?.[item.id] || [];
                            const active = Number(line.custom_sizes?.[item.id] || 0) > 0;
                            return (
                              <div
                                className={`invoice-custom-row ${active ? "selected" : ""}`}
                                key={item.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={(event) =>
                                    setInvoiceLines((lines) =>
                                      lines.map((value, i) =>
                                        i === index
                                          ? {
                                              ...value,
                                              custom_sizes: {
                                                ...(value.custom_sizes || {}),
                                                [item.id]: event.target.checked ? 1 : 0,
                                              },
                                              custom_colours: {
                                                ...(value.custom_colours || {}),
                                                [item.id]:
                                                  event.target.checked && itemColours.length
                                                    ? [itemColours[0]]
                                                    : [],
                                              },
                                              custom_colour_quantities: {
                                                ...(value.custom_colour_quantities || {}),
                                                [item.id]:
                                                  event.target.checked && itemColours.length
                                                    ? { [itemColours[0]]: 1 }
                                                    : {},
                                              },
                                            }
                                          : value,
                                      ),
                                    )
                                  }
                                />
                                <b>{item.size_label}</b>
                                <span>{item.item_code || "—"}</span>
                                <div className="size-colour-options">
                                  {itemColours.map((colour: string) => (
                                    <label
                                      className={selected.includes(colour) ? "selected" : ""}
                                      key={colour}
                                    >
                                      <input
                                        type="checkbox"
                                        disabled={!active}
                                        checked={selected.includes(colour)}
                                        onChange={(event) =>
                                          setInvoiceLines((lines) =>
                                            lines.map((value, i) => {
                                              if (i !== index) return value;
                                              const current = value.custom_colours?.[item.id] || [];
                                              return {
                                                ...value,
                                                custom_colours: {
                                                  ...(value.custom_colours || {}),
                                                  [item.id]: event.target.checked
                                                    ? [...new Set([...current, colour])]
                                                    : current.filter(
                                                        (entry: string) => entry !== colour,
                                                      ),
                                                },
                                                custom_colour_quantities: {
                                                  ...(value.custom_colour_quantities || {}),
                                                  [item.id]: {
                                                    ...(value.custom_colour_quantities?.[item.id] ||
                                                      {}),
                                                    [colour]: event.target.checked ? 1 : 0,
                                                  },
                                                },
                                              };
                                            }),
                                          )
                                        }
                                      />
                                      <i
                                        className="colour-swatch"
                                        style={{ background: colourHex(colour) }}
                                      />
                                      <span>{colour}</span>
                                      {selected.includes(colour) && (
                                        <input
                                          type="number"
                                          min="1"
                                          value={Number(
                                            line.custom_colour_quantities?.[item.id]?.[colour] || 1,
                                          )}
                                          onChange={(event) =>
                                            setInvoiceLines((lines) =>
                                              lines.map((value, i) =>
                                                i === index
                                                  ? {
                                                      ...value,
                                                      custom_colour_quantities: {
                                                        ...(value.custom_colour_quantities || {}),
                                                        [item.id]: {
                                                          ...(value.custom_colour_quantities?.[
                                                            item.id
                                                          ] || {}),
                                                          [colour]: Number(event.target.value),
                                                        },
                                                      },
                                                    }
                                                  : value,
                                              ),
                                            )
                                          }
                                        />
                                      )}
                                    </label>
                                  ))}
                                </div>
                                <span>{money(item.unit_price)}</span>
                              </div>
                            );
                          })}
                          <div className="invoice-custom-footer">
                            <span>Customized total</span>
                            <b>{customPieces} pcs</b>
                            <strong>{money(customTotal)}</strong>
                          </div>
                        </div>
                      )}
                      <div className="invoice-stock-strip">
                        <b>Available stock</b>
                        {(set?.items || []).map((item: any) => (
                          <span
                            className={stockForSize(item.size_label) > 0 ? "available" : "empty"}
                            key={`stock-${item.id}`}
                          >
                            <small>Size {item.size_label}</small>
                            <strong>{stockForSize(item.size_label)} pcs</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="invoice-add-sticky">
                  <button type="button" className="secondary-action" onClick={addInvoiceArticle}>
                    <Plus /> Add another article
                  </button>
                </div>
                <div className="invoice-summary">
                  <div className="invoice-adjustments extended">
                    <label>
                      Discount
                      <input
                        name="discount"
                        type="number"
                        min="0"
                        max={invoiceSubtotal}
                        step="0.01"
                        value={invoiceDiscount}
                        onChange={(event) => setInvoiceDiscount(Number(event.target.value))}
                      />
                    </label>
                    <div className="invoice-adjustment-list">
                      <div className="invoice-adjustment-title">
                        <b>Other deductions</b>
                        <button
                          type="button"
                          onClick={() =>
                            setInvoiceDeductions((rows) => [
                              ...rows,
                              { description: "", type: "fixed", value: 0 },
                            ])
                          }
                        >
                          <Plus /> Add deduction
                        </button>
                      </div>
                      {invoiceDeductions.map((row, index) => (
                        <div className="invoice-adjustment-row" key={`deduction-${index}`}>
                          <label>
                            Reason
                            <input
                              maxLength={120}
                              value={row.description}
                              onChange={(event) =>
                                setInvoiceDeductions((rows) =>
                                  rows.map((item, i) =>
                                    i === index
                                      ? { ...item, description: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="e.g. Promotional allowance"
                              required={Number(row.value) > 0}
                            />
                          </label>
                          <label>
                            Type
                            <select
                              value={row.type}
                              onChange={(event) =>
                                setInvoiceDeductions((rows) =>
                                  rows.map((item, i) =>
                                    i === index ? { ...item, type: event.target.value } : item,
                                  ),
                                )
                              }
                            >
                              <option value="fixed">Fixed (LKR)</option>
                              <option value="percentage">Percentage (%)</option>
                            </select>
                          </label>
                          <label>
                            Value
                            <input
                              type="number"
                              min="0"
                              max={row.type === "percentage" ? 100 : undefined}
                              step="0.01"
                              value={row.value}
                              onChange={(event) =>
                                setInvoiceDeductions((rows) =>
                                  rows.map((item, i) =>
                                    i === index
                                      ? { ...item, value: Number(event.target.value) }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <small>{money(adjustmentAmount(row))}</small>
                          </label>
                          <button
                            type="button"
                            className="icon-action delete"
                            title="Remove deduction"
                            onClick={() =>
                              setInvoiceDeductions((rows) => rows.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                    <label>
                      Tax calculation
                      <select
                        value={invoiceTaxMode}
                        onChange={(event) => {
                          setInvoiceTaxMode(event.target.value);
                          setInvoiceTax(0);
                        }}
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed amount (LKR)</option>
                      </select>
                    </label>
                    <label>
                      {invoiceTaxMode === "percentage" ? "Tax rate (%)" : "Tax amount (LKR)"}
                      <input
                        name="tax_input"
                        type="number"
                        min="0"
                        max={invoiceTaxMode === "percentage" ? 100 : undefined}
                        step="0.01"
                        value={invoiceTax}
                        onChange={(event) => setInvoiceTax(Number(event.target.value))}
                      />
                    </label>
                    <div className="invoice-adjustment-list">
                      <div className="invoice-adjustment-title">
                        <b>Other charges</b>
                        <button
                          type="button"
                          onClick={() =>
                            setInvoiceCharges((rows) => [
                              ...rows,
                              { description: "", type: "fixed", value: 0 },
                            ])
                          }
                        >
                          <Plus /> Add charge
                        </button>
                      </div>
                      {invoiceCharges.map((row, index) => (
                        <div className="invoice-adjustment-row" key={`charge-${index}`}>
                          <label>
                            Description
                            <input
                              maxLength={120}
                              value={row.description}
                              onChange={(event) =>
                                setInvoiceCharges((rows) =>
                                  rows.map((item, i) =>
                                    i === index
                                      ? { ...item, description: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="e.g. Delivery or packaging"
                              required={Number(row.value) > 0}
                            />
                          </label>
                          <label>
                            Type
                            <select
                              value={row.type}
                              onChange={(event) =>
                                setInvoiceCharges((rows) =>
                                  rows.map((item, i) =>
                                    i === index ? { ...item, type: event.target.value } : item,
                                  ),
                                )
                              }
                            >
                              <option value="fixed">Fixed (LKR)</option>
                              <option value="percentage">Percentage (%)</option>
                            </select>
                          </label>
                          <label>
                            Value
                            <input
                              type="number"
                              min="0"
                              max={row.type === "percentage" ? 100 : undefined}
                              step="0.01"
                              value={row.value}
                              onChange={(event) =>
                                setInvoiceCharges((rows) =>
                                  rows.map((item, i) =>
                                    i === index
                                      ? { ...item, value: Number(event.target.value) }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <small>{money(adjustmentAmount(row))}</small>
                          </label>
                          <button
                            type="button"
                            className="icon-action delete"
                            title="Remove charge"
                            onClick={() =>
                              setInvoiceCharges((rows) => rows.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="invoice-totals extended">
                    <span>
                      <small>Subtotal</small>
                      <b>{money(invoiceSubtotal)}</b>
                    </span>
                    <span>
                      <small>Discount</small>
                      <b>− {money(invoiceDiscount)}</b>
                    </span>
                    {invoiceDeductions.map((row, index) => (
                      <span key={`deduction-total-${index}`}>
                        <small>
                          {row.description || `Deduction ${index + 1}`}
                          {row.type === "percentage" ? ` (${row.value}%)` : ""}
                        </small>
                        <b>− {money(adjustmentAmount(row))}</b>
                      </span>
                    ))}
                    <span>
                      <small>Tax {invoiceTaxMode === "percentage" ? `(${invoiceTax}%)` : ""}</small>
                      <b>+ {money(invoiceTaxAmount)}</b>
                    </span>
                    {invoiceCharges.map((row, index) => (
                      <span key={`charge-total-${index}`}>
                        <small>
                          {row.description || `Charge ${index + 1}`}
                          {row.type === "percentage" ? ` (${row.value}%)` : ""}
                        </small>
                        <b>+ {money(adjustmentAmount(row))}</b>
                      </span>
                    ))}
                    <strong>
                      <small>Invoice total</small>
                      {money(invoiceTotal)}
                    </strong>
                  </div>
                </div>
              </div>
            </>
          ) : type === "commission" ? (
            <div className="commission-body">
              <section className="commission-section">
                <h3>Commission details</h3>
                <p>Choose who receives the commission and when.</p>
                <div className="form-row">
                  <label>
                    Salesperson
                    <select name="sales_rep_id" required defaultValue={initial?.sales_rep_id}>
                      {data.reps.map((rep: any) => (
                        <option value={rep.id} key={rep.id}>
                          {rep.code} — {rep.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Commission date
                    <input
                      name="commission_date"
                      type="date"
                      required
                      defaultValue={initial?.receipt_date || new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                </div>
              </section>
              <section className="commission-section">
                <h3>
                  Linked records <span>Optional</span>
                </h3>
                <div className="commission-links">
                  <label>
                    Customer
                    <select name="customer_id" defaultValue={initial?.customer_id || ""}>
                      <option value="">Not linked</option>
                      {data.customers.map((customer: any) => (
                        <option value={customer.id} key={customer.id}>
                          {customer.code} — {customer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Invoice
                    <select name="invoice_id" defaultValue={initial?.invoice_id || ""}>
                      <option value="">Not linked</option>
                      {data.invoices.map((invoice: any) => (
                        <option value={invoice.id} key={invoice.id}>
                          {invoice.number} — {invoice.customer_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Receipt
                    <select name="receipt_id" defaultValue={initial?.receipt_id || ""}>
                      <option value="">Not linked</option>
                      {data.receipts.map((receipt: any) => (
                        <option value={receipt.id} key={receipt.id}>
                          {receipt.number} — {receipt.customer_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section className="commission-section commission-calculation">
                <h3>Calculate commission</h3>
                <p>Quantity multiplied by the rate per piece.</p>
                <div className="form-row">
                  <label>
                    Quantity (pieces)
                    <input
                      name="basis_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={commissionBasis}
                      onChange={(event) => setCommissionBasis(Number(event.target.value))}
                      required
                    />
                  </label>
                  <label>
                    Rate per piece
                    <input
                      name="commission_rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={commissionRate}
                      onChange={(event) => setCommissionRate(Number(event.target.value))}
                      required
                    />
                  </label>
                  <label className="commission-result">
                    Total commission (LKR)
                    <input
                      name="commission_amount"
                      type="number"
                      value={calculatedCommission}
                      readOnly
                      required
                    />
                  </label>
                  {initial?.source_type === "automatic" && (
                    <label>
                      Status
                      <select
                        name="commission_status"
                        defaultValue={initial?.commission_status || "eligible"}
                      >
                        <option value="eligible">Eligible</option>
                        <option value="blocked_late">Blocked late</option>
                        <option value="void">Void</option>
                      </select>
                    </label>
                  )}
                </div>
              </section>
              <section className="commission-section">
                <label>
                  Notes <span className="commission-optional">Optional</span>
                  <input
                    name="notes"
                    maxLength={255}
                    defaultValue={initial?.notes}
                    placeholder="Reason or approval reference"
                  />
                </label>
              </section>
              <p className="report-note">
                {initial?.source_type === "automatic"
                  ? "Changes update the commission portion of the linked receipt journal without changing the customer payment."
                  : "Saving posts the commission expense and commission payable journal automatically."}
              </p>
            </div>
          ) : (
            <>
              <CollectionFields data={data} initial={initial} user={currentUser} busy={busy} />
              {submitError && (
                <div className="error" role="alert">
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>
        <div className="popup-footer">
          <div className="actions">
            {isEasyOrder && (
              <div className="easy-order-footer-total">
                <small>Order total · {poTotalPieces.toLocaleString()} pieces</small>
                <strong>{money(poGrandTotal)}</strong>
              </div>
            )}
            <button type="button" onClick={close}>
              Cancel
            </button>
            {isEasyOrder && orderStep > 1 && (
              <button
                type="button"
                className="easy-order-back"
                disabled={busy}
                onClick={() => {
                  setOrderStep((current) => current - 1);
                  setOrderStepError("");
                  orderForm.current?.querySelector(".popup-body")?.scrollTo(0, 0);
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
            {isEasyOrder && orderStep < 3 ? (
              <button type="button" className="primary" onClick={advanceOrder}>
                {orderStep === 1 ? "Next: add items" : "Next: review order"}
                <ChevronRight />
              </button>
            ) : (
              <button
                className="primary"
                disabled={
                  busy ||
                  (type === "receipt" &&
                    !data.invoices.some((invoice: any) => Number(invoice.outstanding) > 0))
                }
              >
                {busy ? <Loader2 /> : <Check />}{" "}
                {type === "invoice"
                  ? initial
                    ? "Save invoice"
                    : "Create invoice"
                  : type === "sales_order"
                    ? "Create sales order"
                    : type === "po"
                      ? initial
                        ? "Save PO changes"
                        : "Create customer PO"
                      : type === "commission"
                        ? "Post commission"
                        : type === "receipt"
                          ? "Record payment"
                          : "Save"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
function Dashboard({ data, go }: { data: Workspace; go: (x: string) => void }) {
  const approved = data.purchase_orders.filter(
    (x) => x.status === "approved" || x.status === "part_received",
  );
  const stockValue = data.stock.reduce((s, x) => s + Number(x.quantity) * Number(x.unit_cost), 0);
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
    heads = ["Document", "Supplier", "Order Date", "Expected", "Total", "Status", "Actions"];
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
  else heads = ["Journal", "Posting Date", "Description", "Debit", "Credit", "Status", "Actions"];
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
                    {money(row.lines.reduce((s: number, l: JournalLine) => s + Number(l.debit), 0))}
                  </td>
                  <td>
                    {money(
                      row.lines.reduce((s: number, l: JournalLine) => s + Number(l.credit), 0),
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
                    (row.status === "approved" || row.status === "part_received") && (
                      <span className="ready">Ready</span>
                    )}
                  <button className="icon-action view" title="View" onClick={() => view(row)}>
                    <Eye />
                  </button>
                  {(page !== "General Ledger" || row.source_type === "manual_journal") && (
                    <>
                      <button className="icon-action edit" title="Edit" onClick={() => edit(row)}>
                        <Pencil />
                      </button>
                      <button
                        className="icon-action delete"
                        title="Delete"
                        onClick={() => remove(row)}
                      >
                        <Trash2 />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordView({ page, row, close }: { page: string; row: any; close: () => void }) {
  const hidden = ["id", "lines", "items", "review_changes", "created_at", "updated_at"];
  return (
    <div className="backdrop" onMouseDown={close}>
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>RECORD DETAILS</span>
          <h2>{page}</h2>
        </div>
        <div className="popup-body">
          <div className="detail-grid">
            {Object.entries(row)
              .filter(([k]) => !hidden.includes(k))
              .map(([k, v]) => (
                <div key={k}>
                  <small>{k.replace(/_/g, " ")}</small>
                  <b>
                    {typeof v === "number" &&
                    ["total", "salary", "cost", "debit", "credit"].some((x) => k.includes(x))
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
                    {line.article_name
                      ? `${line.article_code} — ${line.article_name}${line.order_mode === "size" && line.size_label ? ` — Size ${line.size_label}` : line.set_name ? ` — ${line.set_name}` : ""}`
                      : line.material_name || line.account_name || line.name}
                  </span>
                  <b>
                    {line.article_name
                      ? `${line.order_mode === "size" ? `${Number(line.pieces)} pieces` : `${Number(line.sets)} badges / ${Number(line.pieces)} pieces`} · ${money(line.line_total)}`
                      : line.net_salary
                        ? `Net ${money(line.net_salary)}`
                        : line.quantity
                          ? `${line.quantity} × ${money(line.unit_cost)}`
                          : `Dr ${money(line.debit)} / Cr ${money(line.credit)}`}
                  </b>
                </div>
              ))}
            </div>
          )}
          {row.review_changes?.length > 0 && (
            <section className="review-change-history">
              <h3>Order review changes</h3>
              <p>Reasons recorded when this sales order was created.</p>
              {row.review_changes.map((change: any, index: number) => (
                <article key={index}>
                  <div>
                    <b>
                      Size {change.size_label}
                      {change.colour ? ` · ${change.colour}` : ""}
                    </b>
                    <span>
                      {change.action === "removed" ? "Removed" : "Quantity edited"} ·{" "}
                      {Number(change.original_quantity)} → {Number(change.quantity)} pieces
                    </span>
                  </div>
                  <p>{change.reason}</p>
                </article>
              ))}
            </section>
          )}
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" onClick={close}>
              Close
            </button>
          </div>
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
        const line = order.lines.find((x) => x.id === Number(f.get("line_id")))!;
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
      if (type === "journal")
        await submit("/journals", {
          posting_date: f.get("posting_date"),
          description: f.get("description"),
          lines: [
            { account_code: f.get("debit_account"), debit: Number(f.get("amount")), credit: 0 },
            { account_code: f.get("credit_account"), debit: 0, credit: Number(f.get("amount")) },
          ],
        });
      if (type === "stock_adjustment")
        await submit("/stock-adjustments", {
          material_id: Number(f.get("material_id")),
          batch_number: f.get("batch_number"),
          adjustment_date: f.get("adjustment_date"),
          adjustment_type: f.get("adjustment_type"),
          quantity: Number(f.get("quantity")),
          unit_cost: Number(f.get("unit_cost")),
          reason: f.get("reason"),
        });
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
            : type === "grn"
              ? "Receive Goods"
              : type === "stock_adjustment"
                ? "Manual Stock Adjustment"
                : "New Journal Entry"
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
              <input name="payment_days" required type="number" min="0" defaultValue="30" />
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
              <input name="quantity" required type="number" min="0.0001" step="0.0001" />
            </label>
            <label>
              Unit cost (LKR)
              <input name="unit_cost" required type="number" min="0" step="0.01" />
            </label>
          </div>
        </>
      ) : type === "grn" ? (
        <GrnFields orders={approved} />
      ) : type === "stock_adjustment" ? (
        <>
          <div className="form-row">
            <label>
              Material
              <select name="material_id" required defaultValue="">
                <option value="" disabled>
                  Select material
                </option>
                {data.materials.map((material) => (
                  <option value={material.id} key={material.id}>
                    {material.code} — {material.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Batch number
              <input name="batch_number" required maxLength={80} />
            </label>
            <label>
              Adjustment date
              <input
                name="adjustment_date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Adjustment type
              <select name="adjustment_type" defaultValue="increase">
                <option value="increase">Increase stock</option>
                <option value="decrease">Decrease stock</option>
              </select>
            </label>
            <label>
              Quantity
              <input name="quantity" type="number" min="0.0001" step="0.0001" required />
            </label>
            <label>
              Unit cost
              <input name="unit_cost" type="number" min="0" step="0.0001" required />
            </label>
          </div>
          <label>
            Reason
            <input
              name="reason"
              required
              maxLength={255}
              placeholder="Physical count, damage, opening balance…"
            />
          </label>
          <p className="report-note">
            This adjustment updates batch stock and posts a balanced inventory journal.
          </p>
        </>
      ) : (
        <>
          <div className="form-row">
            <label>
              Posting date
              <input
                name="posting_date"
                required
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Amount (LKR)
              <input name="amount" required type="number" min="0.01" step="0.01" />
            </label>
          </div>
          <label>
            Description
            <input name="description" required maxLength={255} />
          </label>
          <div className="form-row">
            <label>
              Debit account
              <select name="debit_account" required defaultValue="">
                <option value="" disabled>
                  Select account
                </option>
                {data.accounts.map((account) => (
                  <option value={account.code} key={account.id}>
                    {account.code} — {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Credit account
              <select name="credit_account" required defaultValue="">
                <option value="" disabled>
                  Select account
                </option>
                {data.accounts.map((account) => (
                  <option value={account.code} key={account.id}>
                    {account.code} — {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
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
          description: f.get("description"),
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
            <input name="batch_number" required defaultValue={row.batch_number} />
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
            <input type="date" value={row.posting_date} disabled />
          </label>
          <label>
            Description
            <input name="description" required defaultValue={row.description} />
          </label>
          <label>
            Status
            <input value="Posted" disabled />
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
              <input name="order_date" required type="date" defaultValue={row.order_date} />
            </label>
            <label>
              Expected date
              <input name="expected_date" type="date" defaultValue={row.expected_date} />
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

function AccessPage({ token, currentUserId, search = "" }: { token: string; currentUserId: number; search?: string }) {
  const [data, setData] = useState<any>({ users: [], roles: [], permissions: [] });
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(`${API}/access`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || "Unable to load access control");
    setData(j);
  }, [token]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const isRole = tab === "roles";
    const body = isRole
      ? {
          code: f.get("code"),
          name: f.get("name"),
          permission_ids: data.permissions
            .filter((p: any) => f.get(`permission_${p.id}`))
            .map((p: any) => p.id),
        }
      : {
          name: f.get("name"),
          email: f.get("email"),
          role_id: Number(f.get("role_id")),
          sales_rep_id: f.get("sales_rep_id") ? Number(f.get("sales_rep_id")) : null,
          password: f.get("password") || null,
          active: f.get("active") === "on",
        };
    const base = isRole ? "roles" : "users",
      method = editing ? "PUT" : "POST",
      url = `${API}/${base}${editing ? `/${editing.id}` : ""}`;
    const r = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(
        j.message ||
          Object.values(j.errors || {})
            .flat()
            .join(" ") ||
          "Save failed",
      );
      return;
    }
    setEditing(null);
    setCreating(false);
    setError("");
    await load();
  };
  const remove = async (row: any) => {
    if (!confirm(`Delete ${row.name}?`)) return;
    const base = tab === "roles" ? "roles" : "users";
    const r = await fetch(`${API}/${base}/${row.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.message || "Delete failed");
      return;
    }
    await load();
  };
  const record = editing || {};
  return (
    <>
      <div className="heading">
        <div>
          <span>ADMINISTRATION</span>
          <h1>Access Control</h1>
          <p>Manage authorized users, roles and action permissions.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus /> Add {tab === "users" ? "user" : "role"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="report-tabs">
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Users <small>{data.users.length}</small>
        </button>
        <button className={tab === "roles" ? "active" : ""} onClick={() => setTab("roles")}>
          Roles and permissions <small>{data.roles.length}</small>
        </button>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              {(tab === "users"
                ? ["User", "Email", "Role", "Linked salesperson", "Status"]
                : ["Role", "Code", "Permissions", "Assigned users"]
              ).map((h) => (
                <th key={h}>{h}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(tab === "users" ? data.users : data.roles).filter((row: any) => matchesSearch(row, search)).map((row: any) => (
              <tr key={row.id}>
                {tab === "users" ? (
                  <>
                    <td>
                      <b>{row.name}</b>
                      {row.id === currentUserId && (
                        <small>
                          <br />
                          Current user
                        </small>
                      )}
                    </td>
                    <td>{row.email}</td>
                    <td>{row.role_name}</td>
                    <td>{row.sales_rep_name || "Not linked"}</td>
                    <td>{status(row.active ? "active" : "inactive")}</td>
                  </>
                ) : (
                  <>
                    <td>
                      <b>{row.name}</b>
                    </td>
                    <td>{row.code}</td>
                    <td>{row.permission_ids.length} permissions</td>
                    <td>{data.users.filter((u: any) => u.role_id === row.id).length}</td>
                  </>
                )}
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-action edit"
                      onClick={() => {
                        setCreating(false);
                        setEditing(row);
                      }}
                    >
                      <Pencil />
                    </button>
                    <button
                      className="icon-action delete"
                      disabled={tab === "users" && row.id === currentUserId}
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
      {(creating || editing) && (
        <div
          className="backdrop"
          onMouseDown={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          <form
            className="modal"
            onSubmit={save}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Business record dialog"
          >
            <div className="popup-header">
              <button
                type="button"
                className="close"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                aria-label="Close dialog"
              >
                <X />
              </button>
              <span>ACCESS ADMINISTRATION</span>
              <h2>
                {editing ? "Edit" : "Add"} {tab === "users" ? "user" : "role"}
              </h2>
            </div>
            <div className="popup-body">
              {tab === "users" ? (
                <>
                  <div className="form-row">
                    <label>
                      Name
                      <input name="name" defaultValue={record.name} required />
                    </label>
                    <label>
                      Email
                      <input name="email" type="email" defaultValue={record.email} required />
                    </label>
                    <label>
                      Role
                      <select name="role_id" defaultValue={record.role_id} required>
                        {data.roles.map((role: any) => (
                          <option value={role.id} key={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Linked salesperson
                      <select name="sales_rep_id" defaultValue={record.sales_rep_id || ""}>
                        <option value="">Not a salesperson login</option>
                        {(data.sales_reps || []).map((rep: any) => (
                          <option value={rep.id} key={rep.id}>
                            {rep.code} — {rep.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Password
                      <input
                        name="password"
                        type="password"
                        minLength={8}
                        required={!editing}
                        placeholder={
                          editing ? "Leave blank to keep current password" : "Minimum 8 characters"
                        }
                      />
                    </label>
                  </div>
                  <p className="report-note">
                    For a salesperson login, choose the Salesperson role and link the matching
                    salesperson profile. Their sales documents will then use that identity
                    automatically.
                  </p>
                  <label className="access-check">
                    <input
                      name="active"
                      type="checkbox"
                      defaultChecked={editing ? Boolean(record.active) : true}
                    />{" "}
                    Active account
                  </label>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <label>
                      Role name
                      <input name="name" defaultValue={record.name} required />
                    </label>
                    <label>
                      Role code
                      <input
                        name="code"
                        defaultValue={record.code}
                        pattern="[A-Za-z0-9_-]+"
                        required
                        readOnly={record.code === "administrator"}
                      />
                    </label>
                  </div>
                  <div className="permission-grid">
                    {data.permissions.map((permission: any) => (
                      <label className="access-check" key={permission.id}>
                        <input
                          name={`permission_${permission.id}`}
                          type="checkbox"
                          defaultChecked={record.permission_ids?.includes(permission.id)}
                        />{" "}
                        <span>
                          <b>{permission.name}</b>
                          <small>{permission.code}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="popup-footer">
              <div className="actions">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setEditing(null);
                  }}
                >
                  Cancel
                </button>
                <button className="primary">
                  <Check /> Save
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
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
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>CONTROLLED TRANSACTION</span>
          <h2>{title}</h2>
        </div>
        <div className="popup-body">
          <p>Review the information before saving this business record.</p>
          {children}
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? <Loader2 /> : <Check />}
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
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
          <input name="quantity" required type="number" min="0.0001" step="0.0001" />
        </label>
        <label>
          Batch number
          <input name="batch_number" required placeholder="RM-261013-A" />
        </label>
      </div>
    </>
  );
}

function Login({ onLogin }: { onLogin: (result: Profile & { token: string }) => void }) {
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
          <input name="email" type="email" required defaultValue="admin@aerosoft360.lk" />
        </label>
        <label>
          Password
          <input name="password" type="password" required defaultValue="Admin@123" />
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
function EmployeesPage({ token, search = "" }: { token: string; search?: string }) {
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
    if (!(await confirmDialog(`Delete employee ${employee.name}?`))) return;
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
          <p>Employee profiles, salary settings and complete payroll history.</p>
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
              <b>{data.employees.filter((item: any) => item.status === "active").length}</b>
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
                {data.employees.filter((employee: any) => matchesSearch(employee, search)).map((employee: any) => (
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
          employees={[editing, ...data.employees.filter((item: any) => item.id !== editing?.id)]}
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
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>EMPLOYEE PROFILE</span>
          <h2>{employee.name}</h2>
        </div>
        <div className="popup-body">
          <p>
            {employee.employee_no} · {employee.department} · {employee.designation}
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
                      <td>{money(Number(item.allowances) + Number(item.incentive))}</td>
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
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button onClick={close}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
function PayrollPage({ token, go, search = "" }: { token: string; go: (page: string) => void; search?: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [viewing, setViewing] = useState<any>(null),
    [editing, setEditing] = useState<any>(null),
    [editType, setEditType] = useState(""),
    [attendanceOpen, setAttendanceOpen] = useState(false),
    [attendanceHistoryOpen, setAttendanceHistoryOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [editingPayrollItem, setEditingPayrollItem] = useState<any>(null),
    [calculating, setCalculating] = useState<number | null>(null),
    [payrollTable, setPayrollTable] = useState<"runs" | "employees">("runs"),
    [expandedPayrollRuns, setExpandedPayrollRuns] = useState<Set<number>>(new Set());
  const loadPayroll = useCallback(() => {
    fetch(`${API}/payroll`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError("Unable to load payroll."));
  }, [token]);
  useEffect(loadPayroll, [loadPayroll]);
  const remove = async (type: string, row: any) => {
    if (!(await confirmDialog(`Delete ${type} ${row.name || row.number}?`))) return;
    const path = type === "employee" ? `employees/${row.id}` : `payroll-runs/${row.id}`;
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
  const togglePayrollRun = (id: number) => {
    setExpandedPayrollRuns((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const changePayrollItemPayment = () => go("Head Office Salaries");
  const deletePayrollItem = async (item: any) => {
    if (!confirm(`Delete ${item.name}'s pay line from this payroll month?`)) return;
    const response = await fetch(`${API}/payroll-items/${item.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const json = await response.json();
    if (!response.ok) return setError(json.message || "Employee pay line delete failed.");
    loadPayroll();
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
          <button className="secondary-action" onClick={() => setAttendanceHistoryOpen(true)}>
            <ClipboardCheck /> Attendance files
          </button>
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
          <div className="table-view-tabs" role="tablist" aria-label="Payroll records">
            <button
              className={payrollTable === "runs" ? "active" : ""}
              onClick={() => setPayrollTable("runs")}
            >
              Payroll Runs <span>{data.runs.length}</span>
            </button>
            <button
              className={payrollTable === "employees" ? "active" : ""}
              onClick={() => setPayrollTable("employees")}
            >
              Employees <span>{data.employees.length}</span>
            </button>
          </div>
          {payrollTable === "employees" && (
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
          )}
          {payrollTable === "runs" && (
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
                  {data.runs.filter((run: any) => matchesSearch(run, search)).map((r: any) => (
                    <Fragment key={r.id}>
                      <tr>
                        <td>
                          <button
                            className="payroll-expand"
                            onClick={() => togglePayrollRun(r.id)}
                            aria-expanded={expandedPayrollRuns.has(r.id)}
                            title="Show employee pay details"
                          >
                            {expandedPayrollRuns.has(r.id) ? <ChevronDown /> : <ChevronRight />}
                            <b>{r.number}</b>
                          </button>
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
                              onClick={() => togglePayrollRun(r.id)}
                              title="Show employee pay details"
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
                      {expandedPayrollRuns.has(r.id) && (
                        <tr className="payroll-detail-row">
                          <td colSpan={7}>
                            <div className="payroll-breakdown">
                              <div className="payroll-breakdown-head">
                                <span>Employee</span>
                                <span>Basic salary</span>
                                <span>Allowance</span>
                                <span>Incentive</span>
                                <span>Commission</span>
                                <span>OT</span>
                                <span>Deductions</span>
                                <span>Net pay</span>
                                <span>Payment</span>
                                <span>Actions</span>
                              </div>
                              {(r.items || []).map((item: any) => {
                                const deductions =
                                  Number(item.epf_employee || 0) +
                                  Number(item.other_deductions || 0) +
                                  Number(item.no_pay_amount || 0);
                                return (
                                  <div className="payroll-breakdown-line" key={item.id}>
                                    <span>
                                      <b>{item.employee_no}</b>
                                      <small>{item.name}</small>
                                    </span>
                                    <span>{money(item.basic_salary)}</span>
                                    <span>{money(item.allowances)}</span>
                                    <span>{money(item.incentive)}</span>
                                    <span>{money(item.commission || 0)}</span>
                                    <span>
                                      {money(item.overtime)}
                                      <small>{Number(item.overtime_hours || 0)} hours</small>
                                    </span>
                                    <span>
                                      {money(deductions)}
                                      <small>
                                        EPF {money(item.epf_employee)} · No-pay{" "}
                                        {money(item.no_pay_amount || 0)}
                                      </small>
                                    </span>
                                    <span>
                                      <b>{money(item.net_salary)}</b>
                                    </span>
                                    <span>
                                      {status(item.payment_status || "unpaid")}
                                      {item.paid_at && (
                                        <small>{String(item.paid_at).slice(0, 10)}</small>
                                      )}
                                    </span>
                                    <span className="row-actions">
                                      <button
                                        className={`icon-action ${item.payment_status === "paid" ? "view" : "approve"}`}
                                        title={
                                          item.payment_status === "paid"
                                            ? "Review linked salary payment"
                                            : "Record linked salary payment"
                                        }
                                        onClick={changePayrollItemPayment}
                                      >
                                        <Check />
                                      </button>
                                      <button
                                        className="icon-action edit"
                                        title="Edit employee pay"
                                        onClick={() => setEditingPayrollItem(item)}
                                      >
                                        <Pencil />
                                      </button>
                                      <button
                                        className="icon-action delete"
                                        title="Delete employee pay"
                                        onClick={() => deletePayrollItem(item)}
                                      >
                                        <Trash2 />
                                      </button>
                                    </span>
                                  </div>
                                );
                              })}
                              {!r.items?.length && (
                                <div className="payroll-empty">
                                  No employee pay lines are recorded for this payroll run.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {viewing && <RecordView page="Payroll" row={viewing} close={() => setViewing(null)} />}{" "}
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
      {editingPayrollItem && (
        <PayrollItemEditModal
          item={editingPayrollItem}
          token={token}
          close={() => setEditingPayrollItem(null)}
          saved={() => {
            setEditingPayrollItem(null);
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
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>ATTENDANCE MANAGEMENT</span>
          <div className="attendance-modal-heading">
            <div>
              <h2>Attendance files</h2>
              <p>Review imported attendance separately before creating payroll.</p>
            </div>
            <button type="button" className="primary" onClick={upload}>
              <FileUp /> Upload attendance
            </button>
          </div>
        </div>
        <div className="popup-body">
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
                              {calculating === item.id ? <Loader2 /> : <Check />} Calculate payroll
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
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" onClick={close}>
              Close
            </button>
          </div>
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
  const employee = employees.find((item) => String(item.id) === employeeId) || employees[0];
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
      const response = await fetch(`${API}/employees/${employeeId}/payroll-settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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
      <form
        key={employeeId}
        className="modal payroll-settings-modal"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>MANUAL SALARY MASTER</span>
          <h2>Payroll settings</h2>
        </div>
        <div className="popup-body">
          <p>
            Maintain salary values manually. Attendance uploads provide only paid days, no-pay days
            and overtime hours.
          </p>
          {error && <div className="error">{error}</div>}
          <label>
            Employee
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
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
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? <Loader2 /> : <Check />} Save settings
            </button>
          </div>
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
        const firstValidationError = json.errors ? Object.values(json.errors).flat()[0] : null;
        throw new Error(
          String(firstValidationError || json.message || "Attendance upload failed."),
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
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>ATTENDANCE IMPORT</span>
          <h2>Upload attendance sheet</h2>
        </div>
        <div className="popup-body">
          <p>
            Upload CSV, XLS or XLSX from the attendance system. Required columns: <b>employee_no</b>
            , <b>date</b>, <b>status</b>. Optional: <b>overtime_hours</b>.
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
          <p>Accepted statuses: present, absent, paid_leave, holiday, off, half_day and no_pay.</p>
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? <Loader2 /> : <FileUp />} {busy ? "Validating..." : "Upload and validate"}
            </button>
          </div>
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
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>PAYROLL RECORD</span>
          <h2>
            {type === "employee" && !row.id
              ? "Add Employee"
              : `Edit ${type === "employee" ? "Employee" : "Payroll Run"}`}
          </h2>
        </div>
        <div className="popup-body">
          {error && <div className="error">{error}</div>}
          {type === "employee" ? (
            <>
              <label>
                Employee number
                <input name="employee_no" required defaultValue={row.employee_no} />
              </label>
              <label>
                Name
                <input name="name" required defaultValue={row.name} />
              </label>
              <div className="form-row">
                <label>
                  Department
                  <input name="department" required defaultValue={row.department} />
                </label>
                <label>
                  Designation
                  <input name="designation" required defaultValue={row.designation} />
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
                  <input name="period_start" type="date" required defaultValue={row.period_start} />
                </label>
                <label>
                  Period end
                  <input name="period_end" type="date" required defaultValue={row.period_end} />
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
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : type === "employee" && !row.id ? "Add employee" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
function PayrollItemEditModal({
  item,
  token,
  close,
  saved,
}: {
  item: any;
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
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name) || 0);
    const body = {
      basic_salary: number("basic_salary"),
      allowances: number("allowances"),
      incentive: number("incentive"),
      commission: number("commission"),
      overtime_hours: number("overtime_hours"),
      overtime: number("overtime"),
      epf_employee: number("epf_employee"),
      other_deductions: number("other_deductions"),
      no_pay_amount: number("no_pay_amount"),
    };
    try {
      const response = await fetch(`${API}/payroll-items/${item.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          json.message ||
            Object.values(json.errors || {})
              .flat()
              .join(" ") ||
            "Update failed.",
        );
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
        role="dialog"
        aria-modal="true"
        aria-label="Business record dialog"
      >
        <div className="popup-header">
          <button type="button" className="close" onClick={close} aria-label="Close dialog">
            <X />
          </button>
          <span>EMPLOYEE MONTHLY PAY</span>
          <h2>Edit {item.name}</h2>
        </div>
        <div className="popup-body">
          {error && <div className="error">{error}</div>}
          <div className="form-row">
            <label>
              Basic salary
              <input
                name="basic_salary"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.basic_salary}
                required
              />
            </label>
            <label>
              Allowance
              <input
                name="allowances"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.allowances}
                required
              />
            </label>
            <label>
              Incentive
              <input
                name="incentive"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.incentive}
                required
              />
            </label>
            <label>
              Commission
              <input
                name="commission"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.commission || 0}
                required
              />
            </label>
            <label>
              OT hours
              <input
                name="overtime_hours"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.overtime_hours || 0}
                required
              />
            </label>
            <label>
              OT payment
              <input
                name="overtime"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.overtime}
                required
              />
            </label>
            <label>
              EPF deduction
              <input
                name="epf_employee"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.epf_employee}
                required
              />
            </label>
            <label>
              Other deductions
              <input
                name="other_deductions"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.other_deductions}
                required
              />
            </label>
            <label>
              No-pay deduction
              <input
                name="no_pay_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={item.no_pay_amount || 0}
                required
              />
            </label>
          </div>
        </div>
        <div className="popup-footer">
          <div className="actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save and recalculate"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
function ReportsPage({ token, search = "", requestedReport = "" }: { token: string; search?: string; requestedReport?: string }) {
  const now = new Date(),
    [from, setFrom] = useState(`${now.getFullYear()}-01-01`),
    [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null),
    [financial, setFinancial] = useState<any>(null),
    [aging, setAging] = useState<any>(null),
    [retail, setRetail] = useState<any>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(requestedReport);
  useEffect(() => { if (requestedReport) setSelected(requestedReport); }, [requestedReport]);
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
      fetch(`${API}/reports/retail?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
      .then(async ([a, b, c, d]) => {
        if (!a.ok || !b.ok || !c.ok || !d.ok) throw new Error();
        setData(await a.json());
        setFinancial(await b.json());
        setAging(await c.json());
        setRetail(await d.json());
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
    a.download = isAging ? `Accounts_Payable_Aging_${to}.xls` : `AeroSoft360_${report}_${to}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const reportGroups = [
    {
      title: "Retail operations",
      reports: [
        ["sales_report", "Sales report"],
        ["product_sales", "Product sales report"],
        ["receipt_report", "Receipt report"],
        ["customer_report", "Customer report"],
        ["product_report", "Product report"],
      ],
    },
    {
      title: "Purchasing & inventory",
      reports: [
        ["purchase_report", "Purchase report"],
        ["product_purchase", "Product purchase report"],
        ["supplier_report", "Supplier report"],
        ["inventory_balance", "Inventory closing balance"],
        ["inventory_movement", "Inventory movement report"],
      ],
    },
    {
      title: "Finance",
      reports: [
        ["summary", "Finance overview"],
        ["profit_loss", "Profit & loss statement"],
        ["balance_sheet", "Balance sheet"],
        ["cash_flow", "Cash flow"],
        ["trial_balance", "Trial balance"],
        ["aging", "Supplier aging report"],
      ],
    },
  ];
  const pendingReports = [
    "Stock adjustment report",
    "Stock transfer report",
    "Supplier payment report",
    "Expense analysis report",
    "Product margin report",
  ];
  const financialKeys = [
    "summary",
    "profit_loss",
    "balance_sheet",
    "cash_flow",
    "trial_balance",
    "aging",
  ];
  const selectedGroup = reportGroups.find((group) =>
    group.reports.some(([key]) => key === selected),
  );
  const selectedLabel = selectedGroup?.reports.find(([key]) => key === selected)?.[1];
  const downloadExcel = () => {
    if (financialKeys.includes(selected)) {
      download();
      return;
    }
    const rows = retail?.[selected] || [];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columns.map(escapeCell).join("\t"),
      ...rows.map((row: any) => columns.map((key) => escapeCell(row[key])).join("\t")),
    ].join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `AeroSoft360_${selected}_${to}.xls`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const reportReady = Boolean(
    data &&
      financial &&
      aging &&
      retail &&
      !error &&
      financial.period?.from === from &&
      financial.period?.to === to &&
      retail.period?.from === from &&
      retail.period?.to === to &&
      aging.as_of === to,
  );
  const downloadPdf = () => {
    const source = document.querySelector<HTMLElement>(".report-output");
    if (!source || !reportReady) return;
    if (
      !printReport({
        key: selected,
        title: selectedLabel || "Report",
        group: selectedGroup?.title || "Finance",
        from,
        to,
        source,
      })
    ) {
      setError("Allow pop-ups to download this report as PDF.");
    }
  };
  if (!selected)
    return (
      <>
        <div className="heading">
          <div>
            <span>FINANCE AND MANAGEMENT ACCOUNTING</span>
            <h1>Reports</h1>
            <p>Select a report to open its dedicated page.</p>
          </div>
        </div>
        <div className="report-catalog">
          {!reportGroups.some(group => group.reports.some(([key, label]) => matchesSearch([group.title, label, reportSearchCatalog.find(report => report[0] === key)], search))) && <p role="status">No reports match this search. Clear the search to see all reports.</p>}
          {reportGroups.filter(group => group.reports.some(([key, label]) => matchesSearch([group.title, label, reportSearchCatalog.find(report => report[0] === key)], search))).map((group) => (
            <section key={group.title}>
              <h2>{group.title}</h2>
              <div className="report-menu">
                {group.reports.filter(([key, label]) => matchesSearch([group.title, label, reportSearchCatalog.find(report => report[0] === key)], search)).map(([key, label]) => (
                  <button onClick={() => setSelected(key)} key={key}>
                    <FileText />
                    <span>{label}</span>
                    <small>Open report →</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <section className="report-roadmap">
          <div>
            <span>NEXT FINANCE CONTROLS</span>
            <h2>Reports waiting for source transactions</h2>
            <p>
              These activate after their entry and approval workflows are added, keeping every
              balance auditable.
            </p>
          </div>
          <div className="pending-report-list">
            {pendingReports.filter(name => matchesSearch(name, search)).map((name) => (
              <span key={name}>
                {name}
                <small>Requires module</small>
              </span>
            ))}
          </div>
        </section>
      </>
    );
  return (
    <>
      <button className="report-back" onClick={() => setSelected("")}>
        <ArrowLeft /> Back to reports
      </button>
      <div className="heading report-page-heading">
        <div>
          <span>{selectedGroup?.title.toUpperCase()}</span>
          <h1>{selectedLabel}</h1>
          <p>View the report for the selected accounting period.</p>
        </div>
        <div className="report-downloads">
          <button onClick={downloadPdf} disabled={!reportReady}>
            <FileDown /> Download PDF
          </button>
          <button className="primary" onClick={downloadExcel} disabled={!reportReady}>
            <FileText /> Download Excel
          </button>
        </div>
      </div>
      <div className="report-filters">
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={load}>Apply period</button>
      </div>
      {error && <div className="error">{error}</div>}
      {!data || !financial || !aging || !retail ? (
        <div className="loading">
          <Loader2 /> Loading reports…
        </div>
      ) : (
        <div className="report-output">
          {selected === "summary" && (
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
          )}
          {selected === "aging" ? (
            <AgingReportView aging={aging} />
          ) : !financialKeys.includes(selected) ? (
            <RetailReportView
              reportKey={selected}
              title={selectedLabel || "Report"}
              rows={retail[selected] || []}
            />
          ) : (
            <FinancialReportView selected={selected} financial={financial} />
          )}
          {selected === "summary" && (
            <div className="panels report-management-panels">
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
          )}
        </div>
      )}
    </>
  );
}
function RetailReportView({
  reportKey,
  title,
  rows,
}: {
  reportKey: string;
  title: string;
  rows: any[];
}) {
  const totals = reportTotals(reportKey, rows);
  const tableRef = useRef<HTMLDivElement>(null);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const currencyColumns = [
    "total",
    "sales",
    "outstanding",
    "value",
    "unit_cost",
    "production_cost",
    "line_total",
    "rate",
    "amount",
    "received_amount",
    "credit_limit",
    "selling_price",
  ];
  const display = (key: string, value: any) =>
    currencyColumns.includes(key)
      ? money(value || 0)
      : value === null || value === ""
        ? "—"
        : String(value);
  return (
    <div className="retail-report">
      <div className="report-title-row">
        <div>
          <span>LIVE SOURCE REPORT</span>
          <h2>{title}</h2>
        </div>
        <div className="report-table-actions">
          <strong>{rows.length} records</strong>
          <button
            aria-label="Scroll table left"
            onClick={() => tableRef.current?.scrollBy({ left: -480, behavior: "smooth" })}
          >
            <ChevronLeft />
          </button>
          <button
            aria-label="Scroll table right"
            onClick={() => tableRef.current?.scrollBy({ left: 480, behavior: "smooth" })}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="table-card scrollable-report-table" ref={tableRef}>
        <table>
          <thead>
            <tr>
              {columns.map((key) => (
                <th
                  key={key}
                  className={
                    currencyColumns.includes(key) || key in totals ? "report-number" : undefined
                  }
                >
                  {key.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={Math.max(1, columns.length)}>No records in the selected period.</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((key) => (
                    <td
                      key={key}
                      className={
                        currencyColumns.includes(key) || key in totals ? "report-number" : undefined
                      }
                    >
                      {display(key, row[key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {rows.length > 0 && columns.some((key) => key in totals) && (
              <tr className="report-totals">
                {columns.map((key, index) => (
                  <td key={key} className={key in totals ? "report-number" : "report-totals-label"}>
                    {key in totals ? display(key, totals[key]) : index === 0 ? "Report total" : ""}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="report-note">
        {reportKey === "product_report" || reportKey === "inventory_balance"
          ? "Current snapshot from system records at the time of generation."
          : "Figures are read directly from system records for the selected reporting period."}
      </p>
    </div>
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
                <td colSpan={7}>No outstanding supplier invoices as of {aging.as_of}.</td>
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
            {aging.rows.length > 0 && (
              <tr className="report-totals">
                <td colSpan={6}>Total outstanding</td>
                <td className="report-number">{money(totals.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="report-note">
        Based on posted goods receipts and each supplier’s payment terms. Posted supplier payment
        vouchers reduce the outstanding balance; cancelled payments are restored from their
        cancellation date.
      </p>
    </div>
  );
}
function FinancialReportView({ selected, financial }: { selected: string; financial: any }) {
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
              (x: any) => [`${x.code} ${x.account}`, x.amount] as [string, number],
            ),
            ["Total assets", financial.balance_sheet.assets_total],
          ]}
        />
        <Statement
          title="Liabilities"
          rows={[
            ...financial.balance_sheet.liabilities.map(
              (x: any) => [`${x.code} ${x.account}`, x.amount] as [string, number],
            ),
            ["Total liabilities", financial.balance_sheet.liabilities_total],
          ]}
        />
        <Statement
          title="Equity"
          rows={[
            ...financial.balance_sheet.equity.map(
              (x: any) => [`${x.code} ${x.account}`, x.amount] as [string, number],
            ),
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
            ["Opening cash balance", financial.cash_flow.opening_balance],
            ["Operating activities", financial.cash_flow.operating],
            ["Investing activities", financial.cash_flow.investing],
            ["Financing activities", financial.cash_flow.financing],
            ["Needs classification", financial.cash_flow.unclassified],
            ["Net cash change", financial.cash_flow.net_change],
            ["Closing cash balance", financial.cash_flow.closing_balance],
            ["Reconciliation difference", financial.cash_flow.reconciliation_difference],
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
            <tr className="report-totals">
              <td colSpan={3}>Trial balance totals</td>
              <td className="report-number">
                {money(
                  financial.trial_balance.reduce(
                    (sum: number, row: any) => sum + Number(row.debit),
                    0,
                  ),
                )}
              </td>
              <td className="report-number">
                {money(
                  financial.trial_balance.reduce(
                    (sum: number, row: any) => sum + Number(row.credit),
                    0,
                  ),
                )}
              </td>
              <td className="report-number">
                {money(
                  financial.trial_balance.reduce(
                    (sum: number, row: any) => sum + Number(row.balance),
                    0,
                  ),
                )}
              </td>
            </tr>
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
          ["Opening cash balance", financial.cash_flow.opening_balance],
          ["Operating activities", financial.cash_flow.operating],
          ["Investing activities", financial.cash_flow.investing],
          ["Financing activities", financial.cash_flow.financing],
          ["Needs classification", financial.cash_flow.unclassified],
          ["Net cash change", financial.cash_flow.net_change],
          ["Closing cash balance", financial.cash_flow.closing_balance],
          ["Reconciliation difference", financial.cash_flow.reconciliation_difference],
        ]}
      />
    </div>
  );
}
function Statement({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <section className="statement">
      <h2>{title}</h2>
      {rows.map(([label, value], i) => (
        <div className={i === rows.length - 1 ? "statement-total" : ""} key={label}>
          <span>{label}</span>
          <b>{money(value)}</b>
        </div>
      ))}
    </section>
  );
}
