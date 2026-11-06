const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const output = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../src/stock-import.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  { exports: output },
);
const parse = output.parseStockCsv;
const header = "kind,code,batch_number,size_label,quantity,unit_cost\r\n";
let checks = 0;
function check(ok, name) {
  assert.ok(ok, name);
  checks++;
  console.log(`PASS ${name}`);
}
function rejects(text, name) {
  assert.throws(() => parse(text), undefined, name);
  checks++;
  console.log(`PASS ${name}`);
}
const rows = parse(
  "\uFEFF" + header + 'raw,RAW-1,"Batch, One",,5,120.50\r\nfinished,SHOE-1,,40,3,\r\n',
);
check(
  rows.length === 2 && rows[0].batch_number === "Batch, One" && rows[0].unit_cost === 120.5,
  "BOM, quoted commas and CRLF accepted",
);
check(
  rows[1].size_label === "40" && rows[1].unit_cost === null,
  "finished size and optional cost preserved",
);
rejects(header + "raw,RAW-1,B1,,-2,10", "negative additions rejected");
rejects(header + "raw,RAW-1,B1,,2,", "raw material cost required");
rejects(header + "finished,SHOE-1,,,2,", "finished stock size required");
rejects(header + "finished,SHOE-1,,40,Infinity,", "non-finite quantities rejected");
rejects(header + "raw,RAW-1,B1,,2,10,extra", "extra columns rejected");
rejects(header + 'raw,RAW-1,"B1,,2,10', "unclosed quoted fields rejected");
rejects("code,quantity\nSHOE-1,3", "incorrect template headers rejected");
rejects(header, "empty file rejected");
rejects(
  header + Array(501).fill("finished,SHOE-1,,40,2,").join("\n"),
  "file larger than 500 records rejected",
);
console.log(`${checks} stock import checks passed.`);
