<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

final class DatabaseBackupService
{
    public function create(): array
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();
        abort_unless(in_array($driver, ['mysql', 'sqlite']), 422, 'Database backup supports MySQL/MariaDB and SQLite.');
        $directory = storage_path('app/private/database-backups/' . bin2hex(random_bytes(16)));
        if (!mkdir($directory, 0700, true) && !is_dir($directory)) {
            abort(500, 'Unable to prepare private backup storage.');
        }
        $extension = $driver === 'sqlite' ? 'sqlite' : 'sql';
        $path = $directory . '/database.' . $extension;
        $cleanup = static function () use ($directory, $path) {
            foreach ([$path, $directory . '/client.cnf'] as $file) if (is_file($file)) @unlink($file);
            if (is_dir($directory)) @rmdir($directory);
        };
        register_shutdown_function($cleanup);
        try {
            if ($driver === 'sqlite') {
                // VACUUM INTO creates a consistent standalone snapshot, including WAL data.
                $connection->statement('VACUUM INTO ?', [$path]);
            } else {
                $config = $connection->getConfig();
                $nonTransactional = $connection->selectOne("SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' AND ENGINE <> 'InnoDB'", [$config['database']]);
                abort_if((int) $nonTransactional->count > 0, 422, 'This database contains non-InnoDB tables. Use the database administrator backup tool for a consistent locked backup.');
                $binary = config('backup.mysql_binary');
                if (!$binary && PHP_OS_FAMILY === 'Windows') {
                    $candidate = dirname(dirname(PHP_BINARY)) . '/mysql/bin/mysqldump.exe';
                    if (is_file($candidate)) $binary = $candidate;
                }
                $client = "[client]\n";
                foreach (['host', 'port', 'username', 'password', 'unix_socket'] as $key) {
                    $value = (string) ($config[$key] ?? '');
                    if ($key === 'unix_socket' && $value === '') continue;
                    $name = ['username'=>'user','unix_socket'=>'socket'][$key] ?? $key;
                    $client .= $name . '="' . str_replace(["\\", '"', "\n", "\r"], ["\\\\", '\\"', '\\n', '\\r'], $value) . "\"\n";
                }
                if (!empty($config['options'][\PDO::MYSQL_ATTR_SSL_CA])) {
                    $client .= 'ssl-ca="' . str_replace('\\', '/', $config['options'][\PDO::MYSQL_ATTR_SSL_CA]) . "\"\n";
                }
                $credentials = $directory . '/client.cnf';
                file_put_contents($credentials, $client);
                @chmod($credentials, 0600);
                // An argument array avoids shell interpolation. Credentials never enter argv.
                $environment = null;
                if (PHP_OS_FAMILY === 'Windows') {
                    // PHP's HTTP request environment may omit SystemRoot. Winsock
                    // providers then fail with WSA error 10106 in child tools.
                    $windows = getenv('SystemRoot') ?: getenv('SYSTEMROOT') ?: getenv('windir') ?: 'C:\\Windows';
                    $environment = ['SystemRoot'=>$windows, 'WINDIR'=>$windows];
                }
                $process = new Process([
                    $binary ?: 'mysqldump', '--defaults-extra-file=' . $credentials,
                    '--single-transaction', '--quick', '--skip-lock-tables', '--routines', '--events', '--triggers',
                    '--hex-blob', '--no-tablespaces', '--default-character-set=utf8mb4',
                    '--result-file=' . $path, '--', $config['database'],
                ], null, $environment);
                $process->setTimeout((int) config('backup.timeout', 300));
                try { $process->run(); }
                catch (\Throwable $exception) { abort(503, 'Database export could not start. Configure DB_BACKUP_MYSQL_BINARY with the installed mysqldump path.'); }
                if (!$process->isSuccessful()) {
                    $diagnostic = $process->getErrorOutput();
                    if (!empty($config['password'])) $diagnostic = str_replace($config['password'], '[redacted]', $diagnostic);
                    \Illuminate\Support\Facades\Log::warning('Database backup tool failed', ['exit_code'=>$process->getExitCode(), 'diagnostic'=>substr($diagnostic, 0, 1800)]);
                    abort(503, 'Database export failed. Check the backup tool permissions and database access on the server.');
                }
            }
            clearstatcache(true, $path);
            abort_unless(is_file($path) && filesize($path) > 0, 503, 'The backup was empty; no download was created.');
            @chmod($path, 0600);
            return ['path'=>$path, 'filename'=>'AeroSoft360_Database_' . now()->format('Y-m-d_His') . '.' . $extension, 'cleanup'=>$cleanup];
        } catch (\Throwable $exception) {
            $cleanup();
            throw $exception;
        } finally {
            if (is_file($directory . '/client.cnf')) @unlink($directory . '/client.cnf');
        }
    }
}
