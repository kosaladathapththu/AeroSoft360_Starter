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
