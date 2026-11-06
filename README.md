# AeroSoft360

AeroSoft360 is being rebuilt as a database-backed finance, manufacturing and management ERP for Supun AeroSoft (Pvt) Ltd.

The current milestone implements the first controlled transaction flow:

`Supplier -> Purchase Order -> Approval -> GRN -> Raw Material Batch Stock -> General Ledger`

## Local setup

Backend requirements for the current XAMPP development environment: PHP 8.0+, Composer and MariaDB/MySQL.

```powershell
cd backend
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

Set the MySQL connection in `backend/.env` before migration.

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite, normally `http://127.0.0.1:5173`.

## Payment vouchers

Payment vouchers are available in **Finance & Reports → Payment Vouchers**. Create an expense payment or select a posted supplier receipt, save a draft, then review and post it. Posting debits the expense or supplier payable account and credits the selected cash/bank account. Drafts do not affect the ledger. Supplier payments reduce the payable aging report. Posted vouchers are locked; cancellation requires a reason and date and creates a reversal journal. Every voucher can be printed or saved as PDF from its preview.

For an existing installation, run `php artisan migrate` after updating to create the payment voucher tables. Creating, editing, posting, and cancelling vouchers require `accounting.manage`; viewing and printing use `workspace.view`.

## Development access profiles

| Profile | Email | Password | Access |
|---|---|---|---|
| Administrator | `admin@aerosoft360.lk` | `Admin@123` | All current actions |
| Reporting | `reports@aerosoft360.lk` | `Report@123` | View and reporting only |
| Stock operator | `stock@aerosoft360.lk` | `Stock@123` | View, GRN and stock updates |
| System viewer | `viewer@aerosoft360.lk` | `Viewer@123` | Full-system read-only view |

These are local development credentials and must be replaced before production deployment.

## Verification

```powershell
cd backend
php artisan test --filter=ProcureToStockTest
```

The test verifies partial receipt, batch stock, balanced accounting, and rollback when received quantity exceeds the PO balance.

## Chart of Accounts and Cash Flow

Open **Finance & Reports > Chart of Accounts** to create accounts, mark cash/bank accounts, assign cash-flow activities, view dated balances and account ledgers, or download CSV reports. Account changes require a reason and retain an audit record. Used account structures are protected; system accounts stay active. Deactivate other accounts instead of deleting their history.

**Finance & Reports > Cash Flow** shows posted cash movements, opening and closing balances, operating/investing/financing activities, and a ledger reconciliation. Unclassified movements remain visible. Internal transfers are excluded from external receipts/payments. Mixed journal counterpart amounts are allocated proportionally, with cent rounding preserved. The financial statements and spreadsheet export use this same calculation.

Payment vouchers use active cash/bank and expense accounts from this chart. Customer collections include a **Deposit to** account; posting credits receivables and debits that selected cash/bank account. Drafts and unpaid invoices do not affect cash flow; voucher cancellation affects cash on its reversal date. Apply migrations with `php artisan migrate` when updating another installation.

Additional isolated checks (in-memory SQLite):

```powershell
php tests/verify_chart_and_cash_flow.php
php tests/verify_payment_vouchers.php
php tests/verify_collection_payment.php
```

## Connected business workflows

The additional modules use the existing AeroSoft360 records and posting services:

| Location | Module | Connections |
|---|---|---|
| Sales | Point of Sale | One atomic checkout creates the customer PO, sales order, invoice, stock/serial issue, collection and accounting journals. Repeated checkout references do not duplicate a sale. |
| Sales | Quotations | Customer, salesperson, article and size pricing snapshots; one conversion into a linked PO and sales order. Invoicing continues through the existing dispatch workflow. |
| People & Products | Categories, Brands, Units | Shared classifications assigned to the original article/pricing records. Changes require a reason. Existing classifications are retained. |
| Purchasing & Inventory | Supplier Invoices | Registers the supplier bill against one posted GRN and supplies its due date to aging. The GRN already created inventory and liability, so invoice registration does not post them twice. |
| Purchasing & Inventory | Purchase Returns | Uses original GRN lines and available batch stock; reduces inventory and supplier liability. Reasoned, dated reversals restore both. Returns cannot exceed unpaid supplier balances. |
| Purchasing & Inventory | Bulk Inventory Import | CSV preview and atomic additions to existing raw-material batches or finished article sizes. Raw material additions use the existing stock adjustment journals. A retry of the same import reference is idempotent. |
| Purchasing & Inventory | Inventory Operations / Stock Ledgers | Existing receiving, stock, return and adjustment screens, plus dated quantity ledgers by product and batch/size. |
| Purchasing & Inventory | Serials & Warranty | Registers identifiers against existing stock, issues serials with invoices, derives the customer and warranty dates from the invoice, and records reasoned service claims/outcomes. Invoice bills include issued serials and warranty dates. |
| Finance & Reports | Customer / Supplier Ledgers | Posted invoices, collections, GRNs, supplier payments, returns and reversals, with opening/closing balances and source-module links. Unassigned manual control-account entries remain in General Ledger. |
| Finance & Reports | All Payables | All liability account balances plus supplier-document aging, including returns, payments and their reversal dates. |
| Finance & Reports | Cashier Closing | Dated cash/bank ledger reconciliation and physical/reconciled count. Differences require explanations; reopening requires a reason. Later backdated ledger changes are flagged. A cash count does not silently post an adjustment. |
| Finance & Reports | Head Office Salaries | Department-filtered existing payroll lines. Payment debits salaries payable and credits the selected cash/bank account; reversal restores both. Historical paid flags are preserved without paying them again. Posted payroll is locked to its journal. |
| Finance & Reports | Head Office Expenses | Administrative expense account 5400 linked to the original expense payment vouchers. |
| Finance & Reports | Recurring Journals | Reviewed monthly, quarterly or annual templates. Each due date posts once to an open accounting period, retaining the original month-end anchor. Stopping a template requires a reason. |

Existing Customers, Suppliers, Pricing List, Purchase Orders, Receive Goods, stock screens, Payroll, Payment Vouchers, Chart of Accounts, General Ledger and Reports remain the primary records. The screenshot's “Bill to Invoice” is represented by **Supplier Invoices**, and “Current Stock” by the existing raw/finished stock screens.

Serial tracking is optional per article. Enable **Require serials when invoicing this article** in Categories / Brands / Units product classification to enforce a serial for every sold piece. Register serials for available stock before dispatch, or explicitly attach serials to an existing invoice within its original product/size quantity. Registering/attaching serials never adds or issues stock again. Issued serial/warranty history protects the original invoice against editing/deletion. Warranty claim outcomes do not automatically issue replacements or refunds; stock and accounting movements must use their corresponding workflows.

Apply the three `2026_10_28_000003` through `000005` migrations when updating another installation. The workflow migration can resume after partially completed MySQL DDL without dropping existing tables.

Additional regression commands:

```powershell
php backend/tests/verify_connected_workflows.php
node frontend/tests/verify-stock-import.cjs
node frontend/tests/verify-report-print.cjs
```

All PHP integration fixtures use an in-memory SQLite database, not business records.
