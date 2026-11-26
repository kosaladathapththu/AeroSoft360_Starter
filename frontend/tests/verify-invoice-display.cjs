const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const file = ['.ts', '.tsx'].map(ext => path.join(__dirname, '../src', name + ext)).find(file => fs.existsSync(file));
  const mod = cache[name] = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
  } }).outputText, { exports: mod, require: name => name.endsWith('.css') ? {} : name.startsWith('./') ? load(name.slice(2)) : require(name) });
  return mod;
}
const { invoiceDisplayLines } = load('invoice-display-lines');
const lines = [
  { id: 1, article_id: 10, article_code: 'A10', article_name: 'Sandal', colour: 'Black', size_label: 'SIZE-40', quantity: 2, fixed_rate: 95, rate: 100, line_total: 200 },
  { id: 2, article_id: 10, article_code: 'A10', article_name: 'Sandal', colour: 'Black', size_label: 'SIZE-41', quantity: 3, fixed_rate: 95, rate: 100, line_total: 300 },
  { id: 3, article_id: 10, article_code: 'A10', article_name: 'Sandal', colour: 'Red', size_label: 'SIZE-40', quantity: 1, fixed_rate: 95, rate: 100, line_total: 100 },
  { id: 4, article_id: 10, article_code: 'A10', article_name: 'Sandal', colour: 'Black', size_label: 'SIZE-42', quantity: 1, fixed_rate: 95, rate: 110, line_total: 110 },
];
const before = JSON.stringify(lines), grouped = invoiceDisplayLines(lines);
assert.equal(grouped.length, 3, 'Merge sizes but preserve different colours and rates');
assert.equal(grouped[0].quantity, 5);
assert.equal(grouped[0].line_total, 500);
assert.equal(grouped.reduce((sum, line) => sum + line.line_total, 0), 710);
assert.equal(JSON.stringify(lines), before, 'Stock source lines must not change');
const { BillDocument } = load('InvoiceBill');
const html = renderToStaticMarkup(React.createElement(BillDocument, { invoice: {
  number: 'INV-TEST', lines, invoice_date: '2026-11-13', subtotal: 710, total: 710,
  serials: [{ id: 1, article_code: 'A10', size_label: 'SERIAL-SIZE', serial_number: 'SN-001', warranty_starts_on: '2026-11-13' }],
} }));
assert(!html.includes('<th>Size</th>') && !html.includes('SIZE-') && !html.includes('SERIAL-SIZE'));
assert(html.includes('Black') && html.includes('Red') && html.includes('Sandal') && html.includes('SN-001'));
assert(html.includes('7 pieces') && html.includes('3 item lines'));
console.log('8 invoice article/colour display checks passed.');
