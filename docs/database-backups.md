# Database backups

Administrators open **Administration > Database Backup** and select **Download database backup**. The button prepares a timestamped file and starts a browser download. A failed export displays an error instead of returning an incomplete backup.

The authenticated POST endpoint `/api/v1/admin/database-backup` requires `admin.manage` and permits three requests per minute. A download event records the requesting user and filename. Temporary files live in a random directory under `backend/storage/app/private/database-backups`; database credentials are passed in a private temporary client options file, never in process arguments. Credentials are removed immediately after export, and the backup is deleted after the response finishes or fails.

MySQL/MariaDB exports schema, data, triggers, routines and events using `mysqldump --single-transaction`. Tables must use InnoDB for this consistent snapshot. The server must provide a compatible `mysqldump` executable and the database login must have export privileges. Windows XAMPP installations are detected relative to the PHP executable. On other installations it uses PATH, or set `DB_BACKUP_MYSQL_BINARY` in the backend environment to the full executable path. Do not expose database credentials in that setting.

SQLite uses `VACUUM INTO` to produce a consistent database snapshot, including committed WAL data. It downloads with a `.sqlite` extension; MySQL/MariaDB downloads with `.sql`.

Backups contain confidential business records, password hashes and session data. Keep them in a secure location. Uploaded attachments, imported source workbooks, application code and environment settings are not included and need separate file backups. Schema changes should not run while a backup is being prepared.

Restore is deliberately not provided in the application. Restore into a separate database first, verify record counts and ledger reconciliation, and use a planned administrator maintenance operation to replace a live database. A backup download does not prove a future restore on a different server; retain version-compatible database tooling.

Verification: `php backend/tests/verify_database_backup.php` uses SQLite memory fixtures, restores the snapshot, verifies data and indexes, checks cleanup, and exercises the administrator permission middleware. It does not touch real accounts or business data.
