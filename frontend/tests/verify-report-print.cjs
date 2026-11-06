// Run with: node tests/verify-report-print.cjs (no browser or business database needed).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../src/report-print.ts");
const exportsObject = {};
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(compiled, {
  exports: exportsObject,
  require: () => ({
    default: fs.readFileSync(path.resolve(__dirname, "../src/report-print.css"), "utf8"),
  }),
  Date,
  Set,
  Number,
  Object,
});
const { reportTotals, buildReportDocument } = exportsObject;
let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log(`PASS ${message}`);
}

const sales = reportTotals("sales_report", [
  { total: "343000.00", received_amount: "0", outstanding: "343000.00" },
  { total: "50000.00", received_amount: "15000.00", outstanding: "35000.00" },
]);
check(
  sales.total === 393000 && sales.received_amount === 15000 && sales.outstanding === 378000,
  "sales totals reconcile with stored invoice and receipt amounts",
);
const products = reportTotals("product_sales", [
  { quantity: 2, line_total: 2800, rate: 1400 },
  { quantity: 3, line_total: 4200, rate: 1400 },
]);
check(
  products.quantity === 5 && products.line_total === 7000 && !("rate" in products),
  "product totals add quantities and line amounts without adding unit prices",
);
check(
  !("credit_limit" in reportTotals("customer_report", [{ credit_limit: 50000 }])),
  "credit limits are not treated as report turnover",
);
check(
  Object.keys(reportTotals("product_report", [])).length === 0,
  "master product listings do not invent financial totals",
);

// A small DOM boundary fixture: content selection itself is checked in the browser.
// These checks exercise the actual document builder, date/metadata logic and row counting.
function source(columns, records) {
  const rows = Array.from({ length: records }, () => ({
    classList: { contains: () => false },
    querySelector: () => null,
  }));
  rows.push({ classList: { contains: () => true }, querySelector: () => null });
  const table = {
    tHead: {
      rows: [
        {
          cells: Array.from({ length: columns }, () => ({
            textContent: "Customer",
            classList: { add() {} },
          })),
        },
      ],
    },
    tBodies: [{ rows }],
  };
  const content = {
    innerHTML: `<table><tbody>${Array.from({ length: records }, (_, i) => `<tr><td>Record ${i + 1}</td></tr>`).join("")}</tbody></table>`,
    querySelectorAll: (selector) => (selector === "table" ? [table] : []),
  };
  return { cloneNode: () => content };
}
const options = {
  key: "sales_report",
  title: "Sales <report>",
  group: "Retail & operations",
  from: "2026-01-01",
  to: "2026-10-28",
  source: source(11, 250),
};
const generated = new Date("2026-10-28T04:00:00Z");
const html = buildReportDocument(options, generated);
check(
  html.includes("Sales &lt;report&gt;") && html.includes("Retail &amp; operations"),
  "report metadata is HTML escaped",
);
check(
  html.includes("01 Jan 2026 – 28 Oct 2026") && html.includes("28 Oct 2026, 09:30"),
  "period and generation time use Sri Lanka dates",
);
check(
  html.includes("250 records") && html.includes("Record 250"),
  "long reports include every source row and exclude totals from record counts",
);
check(html.includes("A4 landscape"), "wide tables select landscape paper");
const portrait = buildReportDocument(
  { ...options, key: "trial_balance", source: source(6, 10) },
  generated,
);
check(portrait.includes("A4 portrait"), "narrow financial reports select portrait paper");
const snapshot = buildReportDocument({ ...options, key: "inventory_balance" }, generated);
check(
  snapshot.includes("Current snapshot") && !snapshot.includes("01 Jan 2026 –"),
  "current inventory snapshots are not labelled as historical period reports",
);
const aging = buildReportDocument({ ...options, key: "aging" }, generated);
check(aging.includes("As at 28 Oct 2026"), "supplier aging uses an as-at date");
check(
  html.includes("SUPUN AEROSOFT (PVT) LTD") &&
    html.includes("End of report") &&
    html.includes("SALES-REPORT/2026-10-28"),
  "company header, report reference and end marker are present",
);
console.log(`${checks} report checks passed.`);
