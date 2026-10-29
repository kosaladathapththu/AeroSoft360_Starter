const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const output = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../src/rates.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  { exports: output },
);
const line = { fixed_rates: '{"1":1400}', custom_rate: 1250 };
const item = { id: 1, unit_price: 1800 };
assert.equal(
  output.fixedItemRate(line, item),
  1400,
  "A saved PO uses the original fixed price after catalog changes",
);
assert.equal(
  output.givenItemRate(line, item) * 4,
  5000,
  "Four pieces are billed at the negotiated rate",
);
assert.equal(
  output.fixedItemRate(line, item) * 4,
  5600,
  "Fixed total remains available for comparison",
);
assert.equal(
  output.givenItemRate({ ...line, custom_rate: null }, item),
  1400,
  "Clearing a given rate uses the saved fixed price",
);
assert.equal(
  output.givenItemRate({ ...line, custom_rate: 0 }, item),
  0,
  "An explicitly free item does not fall back to catalog price",
);
console.log("5 price display checks passed.");
