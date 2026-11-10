const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const exports = {};
  cache[name] = exports;
  const file = path.join(
    __dirname,
    "../src",
    name + (fs.existsSync(path.join(__dirname, "../src", name + ".tsx")) ? ".tsx" : ".ts"),
  );
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      exports,
      Intl,
      Date,
      require: (name) =>
        name.endsWith(".css") ? {} : name.startsWith("./") ? load(name.slice(2)) : require(name),
    },
  );
  return exports;
}
const Dashboard = load("DashboardOverview").default;
const data = {
  period: { days: 7, from: "2026-10-28", to: "2026-11-03" },
  generated_at: "2026-11-03T12:30:00+05:30",
  outstanding_total: 23120293,
  open_invoices_count: 343,
  customers_count: 159,
  opening_receivables_total: 23120293,
  sales_receivables_total: 0,
  overdue_total: 0,
  overdue_count: 0,
  terms_missing_count: 343,
  collections_total: 0,
  period_sales: 0,
  period_invoice_count: 0,
  cash_balance: 0,
  dispatch_count: 0,
  dispatch_pieces: 0,
  supplier_payables: 0,
  supplier_overdue_count: 0,
  draft_purchase_orders: 0,
  awaiting_goods: 0,
  unbilled_receipts: 0,
  period_return_credits: 0,
  stock: { pieces: 0, unrecorded: 1179, out: 0, low: 0, threshold: 5 },
  aging: { current: 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0, terms_not_set: 23120293 },
  trend: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-${index < 4 ? "10-" + (28 + index) : "11-0" + (index - 3)}`,
    sales: 0,
    collections: 0,
  })),
  top_customers: [
    {
      id: 1,
      code: "C1",
      customer: "Example Footwear Customer With A Longer Business Name",
      outstanding: 850000,
      invoices: 9,
      overdue: 0,
    },
  ],
  recent_invoices: [],
  recent_receipts: [],
};
const props = { data, days: 7, setDays() {}, refresh() {}, busy: false, go() {}, search: "" };
const render = (overrides = {}) =>
  renderToStaticMarkup(React.createElement(Dashboard, { ...props, ...overrides }));
const empty = render();
assert.ok(empty.includes("Business overview") && empty.includes("LKR 23,120,293.00"));
assert.ok(
  !empty.includes("Sales and collections"),
  "Removed activity panel stays absent",
);
assert.ok(
  empty.includes("343") && empty.includes("not overdue"),
  "Missing terms remain identifiable separately from overdue debt",
);
assert.ok(
  !empty.includes("Needs attention"),
  "Removed attention panel stays absent",
);
assert.ok(
  !empty.includes("Create sales order"),
  "Viewer does not get a transaction-create shortcut",
);
assert.ok(render({ createOrder() {} }).includes("Create sales order"));
assert.ok(empty.includes("Largest customer balances chart") && empty.includes("Receivables distribution by age"));
assert.ok(
  empty.includes("Last 7 days") && empty.includes("Last 30 days") && empty.includes("Last 90 days"),
);
assert.ok(!empty.includes("NaN") && !empty.includes("undefined"));
const live = render({
  data: {
    ...data,
    period_sales: 900,
    collections_total: 300,
    trend: data.trend.map((row, i) => ({ ...row, sales: i * 30, collections: i * 10 })),
  },
});
assert.ok(live.includes("Largest customer balances chart"));
assert.ok(
  live.includes("Receivables distribution by age") && live.includes("Sales invoiced"),
  "Retained charts and sales metrics remain available",
);
assert.ok(
  render({ search: "no-matching-task" }).includes("No matching customer balances"),
  "Top search filters retained customer chart",
);
console.log("12 dashboard presentation checks passed.");
const outIndex = process.argv.indexOf("--render-dir");
if (outIndex >= 0) {
  const out = path.resolve(process.argv[outIndex + 1]);
  fs.mkdirSync(out, { recursive: true });
  const styles = [
    "styles.css",
    "actions.css",
    "layout-fixes.css",
    "record-filters.css",
    "dashboard.css",
  ]
    .map((name) =>
      fs.readFileSync(path.join(__dirname, "../src", name), "utf8").replace(/@import[^;]+;/g, ""),
    )
    .join("\n");
  const html = `<html><head><meta charset="utf-8"><style>${styles}\n:root{font-family:Arial,sans-serif} .qa-aside{padding:26px;font:18px Arial;color:white}.qa-aside p{color:#adc3bd;font-size:14px;margin-top:30px}</style></head><body><div class="shell"><aside class="qa-aside"><b>AeroSoft360</b><p>Business overview</p><p>Sales</p><p>People and Products</p><p>Purchasing</p><p>Inventory</p><p>Finance and Reports</p></aside><main><section class="content">${render({ createOrder() {} })}</section></main></div></body></html>`;
  fs.writeFileSync(path.join(out, "dashboard.html"), html);
}
