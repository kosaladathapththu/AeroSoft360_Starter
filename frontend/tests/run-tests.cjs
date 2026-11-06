const path = require("node:path");
const { spawnSync } = require("node:child_process");
const suites = [
  "verify-order-packs.cjs",
  "verify-collection-plan.cjs",
  "verify-display-references.cjs",
  "verify-customer-order-context.cjs",
  "verify-dashboard.cjs",
  "verify-rates.cjs",
  "verify-record-details.cjs",
  "verify-record-filters.cjs",
  "verify-report-print.cjs",
  "verify-search.cjs",
  "verify-stock-import.cjs",
  "verify-public-site.cjs",
  "verify-pricing-panel.cjs",
];
let failures = 0;
for (const suite of suites) {
  const result = spawnSync(process.execPath, [path.join(__dirname, suite)], {
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    failures++;
    console.error(`FAILED: ${suite}`);
  }
}
console.log(
  `${suites.length - failures}/${suites.length} frontend suites passed.`,
);
process.exitCode = failures ? 1 : 0;
