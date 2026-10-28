import reportStyles from "./report-print.css?inline";

type PrintReport = {
  key: string;
  title: string;
  group: string;
  from: string;
  to: string;
  source: HTMLElement;
};

const company = "SUPUN AEROSOFT (PVT) LTD";

// Only additive fields belong in totals. Never add prices, rates or credit limits.
export const reportTotalColumns: Record<string, string[]> = {
  sales_report: ["total", "received_amount", "outstanding"],
  product_sales: ["quantity", "line_total"],
  receipt_report: ["amount"],
  customer_report: ["invoices", "sales", "outstanding"],
  purchase_report: ["total"],
  product_purchase: ["quantity", "line_total"],
  supplier_report: ["documents", "total"],
  inventory_balance: ["quantity", "value"],
};

export function reportTotals(key: string, rows: Record<string, unknown>[]) {
  return Object.fromEntries(
    (reportTotalColumns[key] || []).map((column) => [
      column,
      rows.reduce((sum, row) => sum + (Number(row[column]) || 0), 0),
    ]),
  );
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00+05:30`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  });

// Stock/master product reports are current snapshots, not period-filtered transactions.
const snapshotReports = new Set(["product_report", "inventory_balance"]);

export function buildReportDocument(report: PrintReport, generated = new Date()): string {
  const content = report.source.cloneNode(true) as HTMLElement;
  content
    .querySelectorAll("button, input, select, svg, .report-title-row")
    .forEach((node) => node.remove());
  const tables = [...content.querySelectorAll("table")];
  for (const table of tables) {
    const headers = [...(table.tHead?.rows[0]?.cells || [])];
    headers.forEach((header, index) => {
      if (
        /^(debit|credit|balance|outstanding|days overdue)$/i.test(header.textContent?.trim() || "")
      ) {
        header.classList.add("report-number");
        table
          .querySelectorAll("tbody tr")
          .forEach((row) => row.children[index]?.classList.add("report-number"));
      }
    });
  }
  const columnCount = Math.max(
    0,
    ...tables.map((table) => table.tHead?.rows[0]?.cells.length || 0),
  );
  const landscape = columnCount > 7 || report.key === "summary";
  const generatedAt = generated.toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const period = snapshotReports.has(report.key)
    ? `Current snapshot · Generated ${generatedAt} (Sri Lanka)`
    : report.key === "aging"
      ? `As at ${formatDate(report.to)}`
      : `${formatDate(report.from)} – ${formatDate(report.to)}`;
  const recordCount = tables.reduce(
    (count, table) =>
      count +
      [...table.tBodies].reduce(
        (total, body) =>
          total +
          [...body.rows].filter(
            (row) => !row.classList.contains("report-totals") && !row.querySelector("td[colspan]"),
          ).length,
        0,
      ),
    0,
  );
  const reference = `${report.key.toUpperCase().replace(/_/g, "-")}/${report.to}`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(report.title)} - AeroSoft360</title>
<style>${reportStyles}
@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm 12mm 18mm;
  @bottom-left { content: "SUPUN AEROSOFT (PVT) LTD | AeroSoft360 ERP"; font: 8pt Arial, sans-serif; color: #52616c; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Arial, sans-serif; color: #52616c; }
}</style></head>
<body class="${landscape ? "landscape" : "portrait"}${columnCount > 10 ? " wide-report" : ""}">
<table class="report-sheet"><thead><tr><td>
  <header class="document-header">
    <div class="brand"><span class="brand-mark">A</span><div><strong>${company}</strong><span>318, K. Cyril C. Perera Mawatha, Colombo 13</span></div></div>
    <div class="document-label">${escapeHtml(report.group)}<span>AeroSoft360 ERP</span></div>
  </header>
  <section class="document-heading"><div><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(period)}</p></div><div class="document-meta"><span>Currency: LKR</span><span>${recordCount ? `${recordCount} record${recordCount === 1 ? "" : "s"}` : "System report"}</span></div></section>
  <div class="document-reference"><span>Report reference: ${escapeHtml(reference)}</span><span>Generated: ${escapeHtml(generatedAt)} (Sri Lanka)</span></div>
</td></tr></thead><tbody><tr><td class="document-content">${content.innerHTML}
<footer class="document-end"><strong>End of report</strong><span>Generated by AeroSoft360 ERP · Amounts shown in LKR unless otherwise stated.</span></footer>
</td></tr></tbody></table>
</body></html>`;
}

export function printReport(report: PrintReport): boolean {
  const popup = window.open("", "_blank", "width=1200,height=850");
  if (!popup) return false;
  popup.document.write(buildReportDocument(report));
  popup.document.close();
  popup.addEventListener("afterprint", () => popup.close(), { once: true });
  // Wait for layout/fonts before opening the native print / Save as PDF dialog.
  void popup.document.fonts.ready.then(() => {
    if (popup.closed) return;
    popup.focus();
    popup.requestAnimationFrame(() => popup.print());
  });
  return true;
}
