# Business overview dashboard

The dashboard prioritizes live receivables, overdue debt, period collections and sales, posted cash/bank balances and supplier payables. The 7, 30 and 90 day presets include today in Sri Lanka time. Balances, stock and unfinished tasks remain current snapshots; only activity measures and recent documents use the selected period.

Opening receivables are shown separately and never included as new sales. AR and aging use invoices less posted dated allocations and return credits, excluding future and void documents. Unknown due dates are a separate Terms not set band. Cash includes posted cash/bank journal lines through today. Supplier payables reuse the existing supplier-aging calculation, including payment and return adjustments.

Attention tasks link to the relevant sales, purchasing, inventory or finance page. Stock counts distinguish positive quantities up to five pieces per article size, recorded quantities at or below zero, and catalogue sizes with no stock record. Five pieces is the visible dashboard alert threshold, not a configured reorder policy. Duplicate active set templates do not multiply the stock counts.

The sales and collection lines are separate activity measures; collections can settle older invoices. Period return credits are displayed separately rather than rewriting historical sales values. The chart offers an expandable searchable table of the same daily figures. A zero-activity period shows an empty state rather than invented activity.

Priority customers are the top five outstanding balances. Recent activity contains up to eight invoices or collections from the selected period, excluding opening documents. Both lists keep search, field filters and matching-row CSV downloads. The top search also filters attention tasks, and the attention area has an area selector. KPI cards open their matching modules; shortcuts provide access to collections, POS, purchasing, vouchers, inventory and reports. Creating a sales order is shown only to users with accounting permission and loads order-entry data before displaying the form.

Implementation: `DashboardService.php` supplies the existing authenticated dashboard route. `DashboardOverview.tsx` and `dashboard.css` contain the scoped layout. Refresh and period changes abort obsolete requests so an earlier response cannot overwrite a later selection. No migrations, seeders or business writes are required.

Checks: `php backend/tests/verify_dashboard.php` uses SQLite memory only. `node frontend/tests/verify-dashboard.cjs` checks server-rendered states and accessible chart data. `npm --prefix frontend run build` checks TypeScript and the production bundle. The layout was reviewed using isolated desktop and mobile static fixtures, not by opening a debugging session in the normal browser.
