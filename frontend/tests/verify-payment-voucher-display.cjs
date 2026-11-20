const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = {};
function load(name) {
  if (cache[name]) return cache[name];
  const file = ['.ts', '.tsx'].map(ext => path.join(__dirname, '../src', name + ext)).find(fs.existsSync);
  const mod = cache[name] = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports: mod, require: name => name.endsWith('.css') ? {} : name.startsWith('./') ? load(name.slice(2)) : require(name) });
  return mod;
}
const { VoucherPaper } = load('PaymentVouchersPage');
const voucher = {
  number: 'PV-202611-000041', total: '33499.00', payment_date: '2026-11-19',
  payment_method: 'cash', payee: 'Courier', description: 'Delivery',
  void_date: '2026-11-19', void_reason: 'Duplicate',
  lines: [{ id: 1, account_code: '5300', account_name: 'Delivery', description: 'Courier', amount: '33499.00' }],
};
for (const status of ['draft', 'posted', 'void']) {
  const html = renderToStaticMarkup(React.createElement(VoucherPaper, { voucher: { ...voucher, status } }));
  assert(html.includes(`<dt>Total payment</dt><dd>LKR ${status === 'void' ? '0.00' : '33,499.00'}</dd>`), `${status} payment total`);
  if (status === 'void') {
    assert(html.includes('<th>Original amount (LKR)</th>'));
    assert(html.includes('<dt>Original payment</dt><dd>LKR 33,499.00</dd>'));
    assert(html.includes('<dt>Cancelled amount</dt><dd>LKR 33,499.00</dd>'));
    assert(html.includes('CANCELLED on 2026-11-19. Reason: Duplicate'));
  }
}
const revised = renderToStaticMarkup(React.createElement(VoucherPaper, { voucher: { ...voucher, status: 'void', revised_to_number: 'PV-202611-000042' } }));
assert(revised.includes('<dt>Total payment</dt><dd>LKR 0.00</dd>'));
assert(revised.includes('Replaced by PV-202611-000042'));
assert.equal(voucher.total, '33499.00');
console.log('Payment voucher totals and cancellation history display checks passed.');
