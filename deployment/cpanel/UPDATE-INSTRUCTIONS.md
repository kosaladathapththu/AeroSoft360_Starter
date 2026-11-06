# AeroSoft360 — existing cPanel installation update

Target: https://erp.supuncompanies.com
Account: /home/camymarket

This ZIP updates the application files. Creating it does not deploy anything.
It contains the new Supun Group portal, four company logos, the separate Y-mac
login, upcoming pages for the other companies, and the current ERP code.
This release also includes the latest invoice layout, compact workflow links,
shared record pagination and customer-first collections with multi-invoice
allocations, commission selection and dated cheque clearance/return tracking.
Only Y-mac accepts the existing AeroSoft360 credentials. Other companies do
not yet have hosted ERP systems or login accounts through this portal.

## 1. Back up before replacing files

Download a fresh database backup from the live system. In cPanel, back up the
two existing folders below as well. Keep backups outside public directories.
Keep the current private `.env` and APP_KEY unchanged.

    /home/camymarket/aerosoft360
    /home/camymarket/erp.supuncompanies.com

## 2. Upload and extract

Upload this ZIP into `/home/camymarket`, then extract into `/home/camymarket`.
Choose overwrite for the matching application files. The ZIP already has
the two directory names directly inside it:

    aerosoft360/                 private backend application code
    erp.supuncompanies.com/      public built website, assets and brands

Do not extract into `public_html`, into either existing application folder,
or into the Camy website. Do not delete or replace whole live directories.
Use the account owner and normal permissions (typically files 0644 and
directories 0755); preserve the private environment file's restrictions.

This update deliberately excludes `.env`, environment templates, database
SQL files, bootstrap cache contents and the entire runtime storage folder.
It preserves the live users, passwords, customer records, balances, uploads,
sessions and application key. Uploading code does not update database data.
Do not import SQL, reset the database, seed data or regenerate APP_KEY.
This release REQUIRES the specific new migration in step 3. It adds collection
history tables and account 1120 (Cheques in Hand), without rewriting invoices
or earlier receipts. Stop and resolve any account-code conflict reported by it.

## 3. Clear cached application configuration

In cPanel Terminal, use the PHP binary matching the ERP domain:

    cd /home/camymarket/aerosoft360
    /opt/cpanel/ea-php82/root/usr/bin/php artisan config:clear
    /opt/cpanel/ea-php82/root/usr/bin/php artisan migrate --path=database/migrations/2026_11_06_000001_create_customer_collections.php --force
    /opt/cpanel/ea-php82/root/usr/bin/php artisan route:clear
    /opt/cpanel/ea-php82/root/usr/bin/php artisan view:clear

The commands above assume the ERP still uses PHP 8.2 as previously configured.
If MultiPHP Manager shows a different version, use its corresponding binary.
If PHP OPcache continues serving old backend code, reload the ERP's PHP-FPM
pool through the server administrator. Do not restart unrelated applications.

## 4. Verify the update

1. Open https://erp.supuncompanies.com in a private browser window, or sign
   out of the ERP first. Existing signed-in sessions still open the ERP.
2. The home page should show Y-mac, Supun Traders, Fuji Industries and Camy
   Smart with their logos. Check on a phone too.
3. Y-mac should open its separate login page. Sign in with an existing account
   and verify the dashboard and customer balances.
4. Each other company should show “Hosting is upcoming” with no password form.
5. In Collections, open Record collection. Choose a customer, enter the amount,
   tick invoices and verify full/partial settlements before saving. Cheques use
   the Cheques & collections tab for dated clearance or a reasoned return.
   Pending cheques must not increase available cash. Test in staging first.
   Check invoice entry starts without a preselected article.
6. Check existing reports, downloads and the database backup function.
7. Use Ctrl+F5 if the browser displays the previous page. Keep old hashed
   assets temporarily so already open browser sessions continue to work.

If checks fail, restore the previous application files from your backup.
Do not restore or overwrite the business database for a presentation-only
rollback. Keep the live environment and storage intact.

The existing Laravel 9 backend remains outside vendor security support.
This update does not upgrade the framework or certify the whole installation
as security-audited. A supported-framework upgrade remains separate work.
