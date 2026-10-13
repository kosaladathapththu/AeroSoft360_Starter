# AeroSoft360 Finance, Accounting and Management ERP Blueprint

## 1. Business objective

AeroSoft360 is a single source of truth for a footwear trading and manufacturing business. It must connect suppliers, stores, production, sales representatives, customers, management and finance. Every operational transaction that has a financial effect must create a controlled accounting event instead of being re-entered by the accounts team.

The system must support both:

- **Financial accounting:** receivables, payables, cash and bank, general ledger, tax, period close and statutory statements.
- **Management accounting:** product and batch cost, department/cost-centre performance, budgets, variances, representative/customer/product profitability and management dashboards.

## 2. Users and responsibilities

| Role | Main responsibilities |
|---|---|
| Super administrator | Company setup, users, roles, numbering, workflow and system policy |
| Procurement officer | Supplier quotations, purchase requests and purchase orders |
| Storekeeper | GRN, stock transfers, issues, returns and physical counts |
| Production planner/supervisor | BOM, production orders, material consumption, output and wastage |
| Quality controller | Accept, reject, quarantine and release material/finished goods |
| Sales representative | Customer orders, collections, returns and account follow-up |
| Sales manager | Pricing, discounts, credit approval, targets and commissions |
| Cashier/collector | Cash, cheque and bank-transfer receipt entry and handover |
| Finance officer | AP, AR, journals, allocations, reconciliations and reports |
| Finance manager | Posting approval, period close, reversal and financial statements |
| HR/payroll officer | Employees, attendance, payroll inputs and payroll processing |
| Management/directors | Read-only KPI, profitability, cash flow, budgets and approvals |
| Auditor | Read-only transactions, source documents, approvals and audit history |

Permissions must be action based (`view`, `create`, `edit`, `submit`, `approve`, `post`, `reverse`, `export`) and enforced by the API. A user must not approve their own controlled transaction.

## 3. End-to-end business flow

### 3.1 Procure-to-pay

`Purchase request -> quotations/comparison -> purchase order -> approval -> GRN and quality check -> supplier invoice -> three-way match -> payable -> payment proposal -> payment approval -> bank/cash payment -> supplier allocation`

Accounting events:

- Accepted GRN: debit inventory/GRNI, credit goods-received-not-invoiced (policy dependent).
- Supplier invoice: clear GRNI and recognise input tax/payable.
- Payment: debit supplier payable, credit bank/cash.
- Purchase return: reverse inventory and the associated liability/tax through a controlled debit note.

### 3.2 Plan-to-produce

`Demand/plan -> approved BOM and routing -> production order -> material reservation -> material issue -> stage/WIP updates -> labour/overhead capture -> quality check -> accepted output/reject/rework -> finished-goods receipt -> close batch`

Accounting events:

- Material issue: raw material to WIP.
- Labour and overhead absorption: expense/control accounts to WIP.
- Finished output: WIP to finished goods at the approved costing method.
- Abnormal loss/rejection: WIP to production variance/loss.

The system must retain planned, standard and actual quantities/costs so management can see usage, yield and cost variances.

### 3.3 Order-to-cash

`Customer/representative -> quotation or customer PO -> sales order -> credit/stock check -> pick and pack -> dispatch -> sales invoice -> receivable -> collection -> receipt verification/cheque clearance -> invoice allocation -> commission eligibility`

Accounting events:

- Dispatch/invoice: debit receivable, credit sales and output tax; debit cost of sales, credit finished inventory.
- Receipt: debit cash/cheque-in-hand/bank, credit customer receivable or customer advance.
- Cheque deposit/clearance/dishonour: move balances through controlled clearing accounts.
- Return/credit note: reverse revenue/tax/receivable and, if saleable, return stock at the original cost basis.

Representative commission must be calculated only from approved rules and eligible cleared allocations, not merely from an invoice or unverified collection.

### 3.4 Record-to-report

`Subledger transaction -> accounting event -> balanced journal draft -> approval/posting -> general ledger -> reconciliation -> period close -> financial statements`

Required controls:

- Each source event posts once using a unique event key.
- Debit equals credit and only postable accounts can be used.
- Posted documents are never edited or deleted; corrections use reversal and replacement.
- Closed periods block posting except through an authorised reopen procedure.
- Every journal line links to its source document and audit history.
- Customer, supplier, inventory, bank and payroll control accounts reconcile to their subledgers.

### 3.5 Hire-to-pay

`Employee -> attendance/import -> reviewed time -> earnings/deductions -> payroll calculation -> approval -> payslip -> payment -> payroll journal -> statutory liabilities/payment`

Sri Lankan EPF, ETF, APIT and overtime rules must be effective-dated settings and confirmed by the business/accountant before production use.

### 3.6 Budget-to-performance

`Annual/period budget -> cost-centre and account allocation -> approval/version freeze -> actual postings -> variance analysis -> forecast revision`

Management views must drill from company KPI to cost centre, account and original document. Budgets and forecasts stay separate from posted actuals.

## 4. Functional modules

1. **Foundation:** companies/branches, users, roles, audit, approvals, fiscal calendar, numbering, currency, tax and document attachments.
2. **Master data:** customers, suppliers, representatives, employees, products, size/colour variants, units, warehouses, locations, price lists, payment terms, chart of accounts and cost centres.
3. **Purchasing/AP:** requests, quotations, POs, GRNs, quality, supplier invoices/debit notes, three-way matching, ageing and payments.
4. **Inventory:** immutable stock ledger, lots/batches, reservations, transfers, adjustments, counts, quarantine/damage and valuation.
5. **Production:** BOM versions, routings/stages, production orders, issues, WIP, output, rework/rejects and batch costing.
6. **Sales/AR:** quotations, set templates, orders, credit checks, dispatches, invoices, returns/credit notes, price/discount rules and ageing.
7. **Collections:** cash/cheque/bank receipts, rep handovers, deposits, clearance, dishonour, allocations and customer advances.
8. **Representative management:** territories, targets, customer assignment, routes, collections and effective-dated commission schemes.
9. **Finance:** GL, journals, AP/AR control, cashbook, bank reconciliation, recurring/accrual journals, fixed assets, taxes and close.
10. **HR/payroll:** employees, attendance, leave, earnings/deductions, statutory calculations, payroll, payslips and posting.
11. **Management accounting:** cost centres, standard/actual cost, budgets, allocations, variances, contribution and profitability.
12. **Reporting:** operational dashboards, audit reports, stock valuation, AR/AP ageing, trial balance, P&L, balance sheet and cash flow.

## 5. Core document lifecycle

All controlled documents use a consistent state model:

`Draft -> Submitted -> Approved -> Posted/Completed`

Optional exits are `Rejected`, `Cancelled` and `Reversed`. Drafts may be edited; submitted documents are locked while under review; posted documents are immutable. Deletion is limited to unused drafts. Every state change records user, time, notes and document version.

## 6. Current implementation assessment

The repository is a starter, not a deployable ERP:

- The schema contains useful early foundations for roles, approvals, products, inventory movements, purchasing, sales receipts, commissions and journals.
- Production batch list/create/delete is the only real frontend-to-API transaction.
- Authentication, API permission enforcement, approval execution and separation of duties are absent.
- Supplier invoices/AP, sales orders/dispatch, returns, payments, cheque lifecycle, reconciliation, BOM execution, payroll, budgets, costing and reports are not implemented.
- Most frontend module tables are placeholders, and some demo text has character-encoding corruption.
- Company ownership is inconsistent across transaction tables, which is unsafe for multi-company use.
- Posted transaction immutability and automatic subledger-to-GL posting are not yet enforced.

The existing code should not be deleted wholesale. The Laravel/React structure, calculation services and migration concepts are reusable, but the domain model, API boundaries and UI need systematic reconstruction.

## 7. Recommended delivery sequence

### Phase 0 - policy confirmation and system skeleton

- Confirm company/branch structure, inventory costing, tax, document numbering, approval thresholds, cheque rules, commission rules and payroll rules.
- Establish authentication, company context, role permissions, audit logging, attachments, settings and fiscal periods.
- Define the accounting-event/posting engine and chart-of-accounts mapping.

### Phase 1 - finance core and masters

- Chart of accounts, cost centres, opening balances, journals, customers, suppliers, products, representatives and warehouses.
- Trial balance, general ledger, journal drill-down and period controls.

### Phase 2 - purchasing, inventory and AP

- PO, GRN, supplier invoice, three-way matching, inventory ledger, supplier ageing and payments.

### Phase 3 - sales, collections and AR

- Sales order, dispatch, invoice, returns, receipts, cheque workflow, allocations, credit control, ageing and commissions.

### Phase 4 - production and costing

- BOM/routing, orders, issues, WIP, output, waste, standard/actual batch cost and variance.

### Phase 5 - payroll, budgets and management reporting

- Attendance/payroll/statutory posting, budgets, cash forecast, profitability and executive dashboards.

### Phase 6 - hardening and go-live

- Import tools, reconciliation, access review, backup/restore, performance, security tests, user acceptance, opening balances and cutover.

## 8. Business decisions required before posting logic is final

1. Is this one legal company with branches, or multiple legal companies?
2. Is manufacturing required now, or is the first release trading/distribution only?
3. Which inventory valuation is required: FIFO, weighted average, or specific batch?
4. Is VAT/SSCL applicable, and what invoice/tax formats are required?
5. Are sales representatives employees, external agents, or both?
6. What makes commission eligible: collection date, deposit date, bank clearance date, or customer allocation date? What happens after cheque dishonour or return?
7. Are credit limits hard blocks or manager-overridable warnings?
8. What approval levels and amount thresholds apply to purchases, payments, discounts, journals and stock adjustments?
9. Which banks, payment methods and cheque-handover steps are used?
10. Which payroll rules and attendance device/file formats are authoritative?
11. What financial year, opening date and historical data must be imported?
12. Which first-release reports are mandatory for management and auditors?

## 9. Definition of a safe first release

The first release should be considered usable only when a user can authenticate, create and approve a document within their permissions, post it exactly once to balanced accounts, trace every ledger line back to the source, reverse mistakes without deleting history, reconcile subledgers to control accounts and produce a trial balance for an open/closed fiscal period.
