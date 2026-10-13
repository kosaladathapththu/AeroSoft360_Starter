# AeroSoft360

AeroSoft360 is being rebuilt as a database-backed finance, manufacturing and management ERP for Supun AeroSoft (Pvt) Ltd.

The current milestone implements the first controlled transaction flow:

`Supplier -> Purchase Order -> Approval -> GRN -> Raw Material Batch Stock -> General Ledger`

## Local setup

Backend requirements: PHP 8.3+, Composer and MySQL 8.

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

## Verification

```powershell
cd backend
php artisan test --filter=ProcureToStockTest
```

The test verifies partial receipt, batch stock, balanced accounting, and rollback when received quantity exceeds the PO balance.
