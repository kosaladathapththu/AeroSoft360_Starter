<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE customer_collections MODIFY collector_sales_rep_id BIGINT UNSIGNED NULL');
        } elseif (DB::getDriverName() === 'sqlite') {
            $column = collect(DB::select('PRAGMA table_info(customer_collections)'))->firstWhere('name', 'collector_sales_rep_id');
            if ($column && $column->notnull) {
                throw new RuntimeException('Existing SQLite collection tables require a nullable-column rebuild before this update.');
            }
        }
    }

    public function down(): void
    {
        // Retain unassigned collections and their financial history.
    }
};
