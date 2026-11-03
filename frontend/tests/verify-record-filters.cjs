const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const result = {};
  cache[name] = result;
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src", name + ".ts"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { exports: result, require: (file) => load(file.replace("./", "")) },
  );
  return result;
}
const { filterRecords, recordFields } = load("record-filters");
const records = [
  {
    id: 1,
    customer: "City Footwear",
    status: "active",
    invoice_date: "2026-11-01",
    due_date: null,
    total: "1000.25",
    credit_days: null,
    lines: [{ name: "Brown Sandal" }],
  },
  {
    id: 2,
    customer: "Caf\u00e9 Footwear",
    status: "inactive",
    invoice_date: "2026-11-03T23:00:00+05:30",
    due_date: "2026-12-03",
    total: "2500.00",
    credit_days: null,
  },
  {
    id: 3,
    customer: "City Retail",
    status: "active",
    invoice_date: "2026-10-31",
    due_date: "2026-11-03",
    total: "0",
    credit_days: null,
  },
];
const fields = recordFields(records);
const rule = (key, value = "", from = "", to = "") => ({ key, value, from, to });
const ids = (rows) => Array.from(rows, (r) => r.id);
const apply = (query = "", conditions = []) =>
  ids(filterRecords(records, query, conditions, fields));
assert.deepEqual(apply("FOOTWEAR city"), [1], "Search requires all words in any order");
assert.deepEqual(apply("cafe"), [2], "Diacritics do not prevent matching");
assert.deepEqual(apply("sandal brown"), [1], "Article detail remains searchable");
assert.deepEqual(apply("", [rule("status", "=active")]), [1, 3], "Active does not match inactive");
assert.deepEqual(
  apply("", [rule("invoice_date", "", "2026-11-01", "2026-11-03")]),
  [1, 2],
  "Date boundaries include both days without timezone shifts",
);
assert.deepEqual(apply("", [rule("total", "", "0", "0")]), [3], "Zero is a valid amount boundary");
assert.deepEqual(
  apply("", [rule("total", "", "1000.25", "2500")]),
  [1, 2],
  "Decimal amounts compare numerically",
);
assert.deepEqual(
  apply("city", [rule("status", "=active"), rule("total", "", "100", "2000")]),
  [1],
  "Query and multiple filters combine with AND",
);
assert.deepEqual(
  apply("", [rule("due_date", "__blank__")]),
  [1],
  "Unknown due dates can be selected explicitly",
);
assert.deepEqual(
  apply("", [rule("due_date", "", "2026-11-01", "2026-12-31")]),
  [2, 3],
  "Missing dates do not satisfy a range",
);
assert.deepEqual(
  apply("", [rule("total", "", "3000", "100")]),
  [],
  "Reversed boundaries match no records",
);
assert.deepEqual(apply("", []), [1, 2, 3], "Reset restores the selected dataset");
assert.deepEqual(ids(filterRecords([], "city", [], fields)), [], "Empty datasets are safe");
assert.ok(
  fields.some((f) => f.key === "credit_days"),
  "All-blank credit days remain available as a filter",
);
assert.equal(fields.find((f) => f.key === "total").kind, "number");
assert.equal(fields.find((f) => f.key === "invoice_date").kind, "date");
assert.ok(!fields.some((f) => f.key === "id" || f.key === "lines"));
const privateFields = recordFields([
  { name: "Staff", password: "private", token: "private", role_id: 3 },
]);
assert.deepEqual(
  Array.from(privateFields, (f) => f.key),
  ["name"],
  "Exports and field options exclude internal IDs and secrets",
);
const copy = JSON.stringify(records);
assert.equal(
  filterRecords(records, "city", [], fields)[0],
  records[0],
  "Actions receive the original record object",
);
assert.equal(
  JSON.stringify(records),
  copy,
  "Filtering does not mutate saved amounts or source records",
);
console.log("20 record filtering checks passed.");

// Render the real reusable panel without a browser or business database.
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const panel = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/FilteredRecords.tsx"), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  {
    exports: panel,
    require: (file) =>
      file === "./record-filters"
        ? load("record-filters")
        : file === "./finance-utils"
          ? { financeCsv() {} }
          : file.endsWith(".css")
            ? {}
            : require(file),
  },
);
const markup = renderToStaticMarkup(
  React.createElement(panel.default, {
    records,
    title: "invoices",
    children: (rows) =>
      React.createElement(
        "table",
        null,
        React.createElement(
          "tbody",
          null,
          rows.map((row) =>
            React.createElement(
              "tr",
              { key: row.id },
              React.createElement("td", null, row.customer),
            ),
          ),
        ),
      ),
  }),
);
assert.ok(markup.includes('type="search"') && markup.includes("Search and filter invoices"));
assert.ok(markup.includes("Add filter") && markup.includes("Download matching rows"));
assert.ok(
  markup.indexOf("</section>") < markup.indexOf("<table>"),
  "Controls render outside the table, not inside a table body",
);
assert.equal(
  (markup.match(/<tr>/g) || []).length,
  3,
  "The panel initially displays the complete source selection",
);
console.log("4 filter panel rendering checks passed.");
