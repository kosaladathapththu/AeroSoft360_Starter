# AeroSoft360_Starter

## Local demonstration data

The frontend includes clearly fictional KPI and module records. Records added with **New Demo Record** last only for the current browser session and are not posted to accounting.

After copying `backend-overlay/` into a full Laravel application and configuring its database, local developers may load the matching backend dataset:

```powershell
php artisan migrate
php artisan db:seed --class=AeroSoftDemoSeeder
```

The seeder creates fictional masters, stock, a PO/GRN, invoice/receipt, commission and balanced journal. It also creates `demo.admin@example.test` with the local-only password `AeroSoft360-Demo!`. The seeder refuses to run when Laravel is in the `production` environment.

Never use the demonstration records as production opening balances or migrate them into the live company database.

