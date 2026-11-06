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
const pack = Array.from({length:5}, (_,i)=>({id:i+1, size_label:String(28+i), quantity:2, unit_price:75}));
assert.equal(output.setPricing({},pack).fixed,750,'Excel piece price times ten pieces gives the complete set price');
assert.equal(output.setPricing({},[...pack,{id:6,quantity:2,unit_price:75}]).fixed,900,'Twelve-piece set uses twelve times the unit price');
assert.equal(output.setPricing({},pack.map(p=>({...p,unit_price:1075}))).fixed,10750,'1075 is per piece, not the price of a whole set');
const negotiated=output.setPricing({custom_rate:80},pack);
assert.equal(negotiated.given,800,'Invoice-specific piece rate applies to every piece in a complete set');
assert.equal(negotiated.fixed,750,'Negotiated invoice rate preserves fixed set total');
assert.equal(output.setPricing({order_mode:'custom',given_rates:{1:80}},pack).given,760,'Customized price changes only the selected size');
assert.equal(output.givenItemRate({order_mode:'badge',custom_rate:90,given_rates:{1:80}},pack[0]),90,'Uniform complete-set invoice rate takes precedence over old size allocations');
assert.equal(output.fixedItemRate({}, {id:1,fixed_rate:75,unit_price:100}),75,'Read-only fixed snapshots survive catalog changes');
console.log('8 piece/set pricing checks passed.');
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
