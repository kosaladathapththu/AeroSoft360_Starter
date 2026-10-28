const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const output = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../src/search.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  { exports: output },
);
const match = output.matchesSearch;
const customer = { code: "CUS-002", name: "City Footwear", phone: "0771234567", status: "active" };
assert.ok(match(customer, "city"));
assert.ok(match(customer, " FOOTWEAR   city "));
assert.ok(match(customer, "CUS 002"));
assert.ok(match(customer, "077123"));
assert.ok(!match(customer, "Fuji"));
assert.ok(!match(customer, "name"), "Object field names must not create false matches");
assert.ok(match(customer, "  "));
assert.ok(
  match(
    { lines: [{ article: "Sandal", colour: "Brown" }], amount: 2800, empty: null },
    "brown 2800",
  ),
);
assert.ok(match({ name: "Café" }, "cafe"));
assert.ok(match({ name: "Chart of Accounts", group: "Finance & Reports" }, "chart accounts"));
assert.ok(!match({ name: "Customers" }, "chart accounts"));
console.log("11 search checks passed.");
const catalog = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../src/search-catalog.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  { exports: catalog },
);
const findReport = (query) =>
  catalog.reportSearchCatalog
    .filter((row) => match(["Reports", ...row], query))
    .map((row) => row[0]);
assert.ok(findReport("p&l").includes("profit_loss"));
assert.ok(findReport("ageing payable").includes("aging"));
assert.ok(findReport("stock valuation").includes("inventory_balance"));
assert.ok(findReport("cashflow").includes("cash_flow"));
assert.equal(findReport("reports").length, 16);
assert.ok(match(catalog.pageSearchKeywords["Head Office Salaries"], "salary payment"));
assert.ok(match(catalog.pageSearchKeywords["Serials & Warranty"], "warranties repair"));
console.log("7 report and feature discovery checks passed.");
