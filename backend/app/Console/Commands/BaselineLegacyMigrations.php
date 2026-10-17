<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class BaselineLegacyMigrations extends Command
{
    protected $signature = 'schema:baseline-legacy';
    protected $description = 'Register the existing AeroSoft360 legacy schema in Laravel migration history';

    public function handle(): int
    {
        $checks = [
            '2026_10_13_000001_create_procure_to_stock_foundation' => fn () => Schema::hasTable('suppliers') && Schema::hasTable('journal_entries'),
            '2026_10_13_000002_create_access_control' => fn () => Schema::hasTable('roles') && Schema::hasTable('users'),
            '2026_10_13_000003_create_payroll_and_reporting' => fn () => Schema::hasTable('employees') && Schema::hasTable('payroll_runs'),
            '2026_10_13_000004_create_attendance_imports' => fn () => Schema::hasTable('attendance_imports') && Schema::hasColumn('payroll_runs', 'attendance_import_id'),
            '2026_10_13_000005_add_employee_payroll_settings' => fn () => Schema::hasColumn('employees', 'fixed_allowance') && Schema::hasColumn('employees', 'overtime_multiplier'),
            '2026_10_13_000006_create_sales_first_erp' => fn () => Schema::hasTable('customers') && Schema::hasTable('sales_invoices'),
            '2026_10_13_000007_article_sets_and_collection_commission' => fn () => Schema::hasTable('article_set_templates') && Schema::hasColumn('receipt_allocations', 'commission_rate'),
            '2026_10_13_000008_partial_sales_fulfilment' => fn () => Schema::hasTable('sales_invoice_lines') && Schema::hasColumn('sales_order_size_lines', 'invoiced_quantity'),
            '2026_10_13_000009_po_badge_and_individual_sizes' => fn () => Schema::hasColumn('customer_po_lines', 'order_mode') && Schema::hasColumn('customer_po_lines', 'set_item_id'),
        ];

        $missing = array_keys(array_filter($checks, fn ($check) => !$check()));
        if ($missing) {
            $this->error('The existing database is missing parts of the legacy schema. No migration history was changed.');
            foreach ($missing as $migration) $this->line(" - {$migration}");
            return self::FAILURE;
        }

        $batch = ((int) DB::table('migrations')->max('batch')) + 1;
        foreach (array_keys($checks) as $migration) {
            if (!DB::table('migrations')->where('migration', $migration)->exists()) {
                DB::table('migrations')->insert(['migration'=>$migration, 'batch'=>$batch]);
                $this->info("Registered {$migration}");
            }
        }
        $this->newLine();
        $this->info('Legacy schema baseline completed. You can now run php artisan migrate.');
        return self::SUCCESS;
    }
}
