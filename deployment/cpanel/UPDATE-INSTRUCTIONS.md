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

## Update-only package: preserve live records

This package includes the latest inventory overview, Excel stock-count templates,
preview and count updates, article/item searches, and collection corrections and
receipt improvements. It also includes the redesigned Purchasing Overview, full-page
purchase entry forms and the complete Inventory Overview list without pagination.
It contains application code and compiled website assets only.
Local test customers, stock counts, payments and other checking records are not included.
No database dump, seeders, uploaded workbook or local environment is packaged.
The inventory feature requires no new migration. The specific collection migrations
below are needed only if not already installed; Laravel skips recorded migrations.
Do not run database seeders, migrate:fresh, or import a local SQL/database file.
Your existing live business records and passwords remain in the hosted database.

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

## 3. Install collection tables and clear cached configuration

In cPanel Terminal, use the PHP binary matching the ERP domain:

    cd /home/camymarket/aerosoft360
    /opt/cpanel/ea-php82/root/usr/bin/php artisan config:clear
    /opt/cpanel/ea-php82/root/usr/bin/php artisan migrate --path=database/migrations/2026_11_06_000001_create_customer_collections.php --force
    /opt/cpanel/ea-php82/root/usr/bin/php artisan migrate --path=database/migrations/2026_11_09_000001_group_cheques_under_current_assets.php --force
    /opt/cpanel/ea-php82/root/usr/bin/php artisan migrate --path=database/migrations/2026_11_09_000002_add_card_collection_charges.php --force
    /opt/cpanel/ea-php82/root/usr/bin/php artisan migrate --path=database/migrations/2026_11_09_000003_make_collection_collector_optional.php --force
    /opt/cpanel/ea-php82/root/usr/bin/php artisan migrate --path=database/migrations/2026_11_09_000004_add_collection_corrections.php --force
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
7. Open Inventory Overview: all articles should appear, including unassigned stock.
   The temporary stock-fill button must be gone. Edit stock opens an inline page.
   In Bulk Inventory Import, download an Excel template and inspect its Instructions
   sheet. Download and preview do not change balances. Apply only verified real counts.
   Raw material count changes require an open accounting period and post journals.
8. Use Ctrl+F5 if the browser displays the previous page. Keep old hashed
   assets temporarily so already open browser sessions continue to work.

If checks fail, restore the previous application files from your backup.
Do not restore or overwrite the business database for a presentation-only
rollback. Keep the live environment and storage intact.

The existing Laravel 9 backend remains outside vendor security support.
This update does not upgrade the framework or certify the whole installation
as security-audited. A supported-framework upgrade remains separate work.
