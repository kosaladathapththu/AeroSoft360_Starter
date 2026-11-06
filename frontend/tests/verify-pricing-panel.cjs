const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const ts = require("typescript"),
  React = require("react"),
  { renderToStaticMarkup } = require("react-dom/server");
const rates = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/rates.ts"), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText,
  { exports: rates },
);
const mod = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/RateFields.tsx"), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText,
  {
    exports: mod,
    require: (name) =>
      name === "./rates"
        ? rates
        : name === "./finance-utils"
          ? { financeMoney: (value) => "LKR " + Number(value).toFixed(2) }
          : require(name),
  },
);
const pack = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  size_label: String(28 + index),
  quantity: 2,
  unit_price: 1075,
  set_name: "Price List - Variant 1",
}));
const render = (props) =>
  renderToStaticMarkup(
    React.createElement(mod.default, {
      items: pack,
      rate: null,
      change() {},
      ...props,
    }),
  );
const complete = render({ readOnly: true });
assert(complete.includes("LKR 1075.00") && complete.includes("LKR 10750.00"));
assert(
  complete.includes("Pieces per set") && complete.includes("Fixed total / set"),
);
assert(
  !complete.includes("<input"),
  "Complete-set size prices cannot be edited in ordering",
);
assert(!complete.includes("1900"), "Only selected template prices are shown");
const invoice = render({ rate: 1000 });
assert(invoice.includes("LKR 10750.00") && invoice.includes("LKR 10000.00"));
assert.equal(
  (invoice.match(/<input/g) || []).length,
  1,
  "Complete invoice has one common customer rate, not per-size inputs",
);
const customized = render({ changeItem() {}, givenRates: { 1: 1000 } });
assert(
  customized.includes("Fixed price / piece") &&
    customized.includes("Given price / piece"),
);
assert.equal((customized.match(/<input/g) || []).length, 5);
assert(
  customized.includes('value="1000"') && customized.includes("LKR 1075.00"),
);
assert(
  render({ items: [], articlePrice: 1950 }).includes(
    "No active size template is configured",
  ),
);
console.log("10 pricing panel checks passed.");
