# AeroSoft360 — VPS cPanel staging package

Prepared for **erp.supuncompanies.com**, VPS **159.198.36.23**, AlmaLinux 9 with cPanel, account home **/home/camymarket**.

This package contains application code, locked Composer dependencies and the built website. It does not contain a configured `.env`, passwords, the business database, source customer workbooks or uploaded files. **It is a staging package, not a completed live deployment.** The application currently uses Laravel 9, which is outside vendor security support; upgrade to a supported framework and repeat the regression checks before public go-live. Source: https://laravel.com/framework/docs/10.x/releases.

## 1. Keep the existing websites intact

The VPS already has a Camy application in `/home/camymarket/public_html`. Do not overwrite, empty or extract this package there. Keep `supuncompanies.com` on its current shared hosting.

The intended directories are:

```text
/home/camymarket/
  aerosoft360/                  private Laravel application
    .env.example               production settings template, no secrets
    vendor/
    app/
    storage/
  erp.supuncompanies.com/       ERP public document root
    index.html
    index.php
    .htaccess
    assets/
```

Upload the ZIP to `/home/camymarket` using the VPS cPanel File Manager and extract there. The archive contains the two directories directly, without an extra parent directory. Enable **Show Hidden Files** so `.htaccess` and `.env.example` are visible. Do not put the private application inside any public website directory.

## 2. Add the ERP hostname

At the DNS provider authoritative for `supuncompanies.com`, add or update only:

```text
Type: A
Host: erp
Value: 159.198.36.23
```

Do not change the root domain, `www`, email records or the domain nameservers. In the VPS cPanel **Domains**, create `erp.supuncompanies.com`, turn off document-root sharing, and select `/home/camymarket/erp.supuncompanies.com` as its document root. If cPanel restricts external-domain creation, have the VPS administrator configure this domain; do not add it as an alias of the Camy site.

cPanel references:
- https://support.cpanel.net/hc/en-us/articles/360052780313-How-to-create-a-subdomain
- https://docs.cpanel.net/cpanel/software/multiphp-manager-for-cpanel/

## 3. Check PHP and TLS

In **MultiPHP Manager** inspect the PHP version assigned specifically to the ERP domain. This package carries the existing locked dependencies; its minimum platform check is PHP 8.0.2, but that minimum is not a recommendation to deploy an unsupported PHP version. Select a currently supported, patched runtime compatible with the framework upgrade, then test the application on it.

Required extensions are checked by the private `hosting-check.php` script. Enable PDO MySQL, mbstring, GD, ZIP, XML/DOM, fileinfo, OpenSSL and the other reported extensions. The server must permit `proc_open` and provide `mysqldump` for the application backup feature.

Use **SSL/TLS Status → Run AutoSSL** for the ERP hostname after DNS resolves. Enable cPanel **Force HTTPS Redirect** only after the certificate is valid. Access cPanel using the VPS provider's valid HTTPS hostname; do not bypass a certificate warning to upload database credentials or private business files.

## 4. Create a separate database

Use the VPS cPanel **MySQL Database Wizard** to create a dedicated AeroSoft360 database and database user. Grant that user privileges on this database only. Do not reuse or overwrite the Camy database.

Before exporting the local database, replace all documented demo account passwords through **Administration → Access Control → Reset password**. Use the local **Database Backup** page to download a fresh SQL backup, then import it into the dedicated database using phpMyAdmin. This preserves the real receivables, users, prices and migration history.

Keep the SQL file outside all public document roots and remove the server upload when the administrator has verified the import. Do not use a demo seed or run `migrate:fresh`, `db:wipe` or `--seed` against the imported business database.

## 5. Configure the private environment

Copy `/home/camymarket/aerosoft360/.env.example` to `.env`. Set:

- `APP_URL=https://erp.supuncompanies.com`
- `APP_ENV=production` and `APP_DEBUG=false`
- Database name, username and password created in cPanel
- `APP_KEY`: preserve the existing application's key from the local private `.env` when moving its database. Do not post this key in chat or put it in the public directory. Generate a new key only for a genuinely new installation after checking encrypted-data implications.
- `DB_BACKUP_MYSQL_BINARY`: confirm the actual `mysqldump` path on this VPS, commonly `/usr/bin/mysqldump`.

Keep `.env` readable only to the account/application owner. The template uses file-based sessions/cache so no extra session/cache tables are required. Uploads and attachments, if used, must be copied separately into private application storage while preserving their paths.

## 6. Run private checks

Use cPanel Terminal or SSH provided by the VPS administrator, with the PHP binary matching the ERP domain. On cPanel this may be a version-specific binary under `/opt/cpanel/ea-phpXX/root/usr/bin/php`; check MultiPHP Manager and the administrator's configuration first.

```sh
cd /home/camymarket/aerosoft360
php hosting-check.php
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan migrate:status
```

Do not apply migrations blindly. The current local database already has the implemented migrations. After importing the matching backup, verify all expected migrations are marked as run. A future pending migration needs its own review and backup.

`storage/app`, `storage/framework/cache/data`, `storage/framework/sessions`, `storage/framework/views`, `storage/logs` and `bootstrap/cache` must be writable by the application owner. Use account ownership and the narrowest suitable permissions; do not apply `777` recursively.

Composer dependencies are included. If regenerating them on the VPS, use the locked `composer.lock` and `composer install --no-dev --prefer-dist --optimize-autoloader`; do not run an unreviewed `composer update` during deployment.

## 7. Validate staging before go-live

Keep staging access restricted until the framework/runtime upgrade and checks are complete. Verify:

1. The home page, login and all compiled assets load through HTTPS.
2. `/api/v1/auth/me` without a token returns an authentication error; the API is not the SPA HTML.
3. Admin and restricted-role logins work with newly assigned passwords.
4. Customer balances, chart of accounts, receivables and ledger totals match the local source.
5. Fixed price is per piece; set total multiplies the pack quantities correctly.
6. Reports, invoice bills, downloads and the database backup work.
7. A backup can be restored to a separate test database.
8. `.env`, application code, source workbooks and SQL backups are not publicly downloadable.

The public entry point uses `../aerosoft360` relative to its own folder. If cPanel assigns a different directory layout, update that private path in the ERP `index.php`, not the Camy entry point.

No DNS records, server files, database tables or certificates are changed by generating this package. Upload and live activation are separate steps.
