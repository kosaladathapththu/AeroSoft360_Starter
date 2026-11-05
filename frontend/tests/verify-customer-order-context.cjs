const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const output = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/customer-order-context.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: output });
const line = { id: 1, article_id: 22, article_code: '2206', article_name: 'Sandal', size_label: '40', colour: 'Black', quantity: 10, invoiced_quantity: 4 };
const data = {
  orders: [
    { id: 1, customer_id: 7, customer_po_id: 10, number: 'SO-1', order_date: '2026-10-01', status: 'confirmed', lines: [line] },
    { id: 2, customer_id: 8, number: 'SO-2', status: 'confirmed', lines: [line] },
    { id: 3, customer_id: 7, number: 'SO-3', status: 'cancelled', lines: [line] },
    { id: 4, customer_id: 7, number: 'SO-4', status: 'confirmed', lines: [{ ...line, invoiced_quantity: 10 }] },
  ],
  pos: [
    { id: 10, customer_id: 7, number: 'PO-10', status: 'draft', lines: [{ ...line, pieces: 10 }] },
    { id: 11, customer_id: 7, number: 'PO-11', po_date: '2026-11-01', status: 'draft', lines: [{ ...line, pieces: 3 }] },
    { id: 12, customer_id: 7, number: 'PO-12', status: 'cancelled', lines: [{ ...line, pieces: 9 }] },
  ],
};
const rows = output.pendingCustomerOrders(data, 7);
assert.equal(rows.length, 2, 'No linked PO duplication, cancelled order, supplied order, or other customer');
assert.equal(rows[0].pending, 6, 'Ten ordered minus four supplied leaves six');
assert.equal(rows[0].supplied, 4);
assert.equal(rows[0].size, '40');
assert.equal(rows[0].colour, 'Black');
assert.equal(rows[1].stage, 'Unconfirmed PO', 'Requests are distinct from confirmed commitments');
assert.equal(rows[1].pending, 3);
assert.equal(output.pendingCustomerOrders(data, 7, {poId: 10}).length, 1, 'Edited PO and its linked order are excluded');
assert.equal(output.pendingCustomerOrders(data, 7, {orderId: 1}).length, 1, 'Edited order is excluded without resurrecting linked PO');
assert.equal(output.pendingCustomerOrders(data, 0).length, 0);
assert.equal(output.pendingCustomerOrders({ orders: [{...data.orders[0], lines: [{...line, invoiced_quantity: 12}]}] }, 7).length, 0, 'Over-supplied rows do not become negative pending');
console.log('11 customer order context checks passed.');
