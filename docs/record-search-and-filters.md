# Search and filters across workspaces

Read-only lists use `FilteredRecords`, which filters source records before rendering. It supports an all-word search, multiple combined field conditions, exact dropdown choices, free-text fields, date ranges, numeric ranges, missing values, reset, result counts and CSV download of matching rows. Existing top-bar search and page selections still limit the starting dataset. It does not fetch a separate copy of the data or change record IDs, actions or saved business values.

Coverage includes customer and sales registers, pricing, suppliers, purchasing, receiving history, raw and finished stock, accounts and account ledgers, cash movement detail, vouchers, returns, employees, payroll and attendance history, access records, report tables, financial statement lines, dashboard recent activity and POS products. The shared WorkflowTable also supplies these controls to customer profile tabs, subledgers, classifications, quotations, recurring entries, cashier closings, import history and serial or warranty registers. Reports have a local name search and category selector on their catalog page.

Filters apply immediately. Multiple conditions use AND. Numeric and date boundaries are inclusive; a date is compared using its business date without timezone conversion. Blank due dates are not treated as overdue dates and can be selected using Not set. Reset clears this panel, while existing top search and page selectors remain independent.

The matching-row CSV uses the same filtered records. Parent page exports retain their original scope; the filter panel states this when active. Operational report table totals, supplier-aging table totals and trial-balance table totals use the displayed rows. Financial statement values and ledger running balances are not recalculated when hiding rows. Summary cards remain the full selected period or account. Print reports omit the input controls and show the rendered record selection.

Transaction input tables and complete invoice or voucher documents are intentionally not filtered: hiding an input line must not suggest that it was removed from a transaction, and filtering an official bill must not change its printed content.

Verification: `node frontend/tests/verify-record-filters.cjs`, `node frontend/tests/verify-search.cjs`, and `npm --prefix frontend run build`.
