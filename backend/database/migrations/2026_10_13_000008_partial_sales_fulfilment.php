<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
    public function up(): void
    {
        $sql = file_get_contents(base_path("../database/mysql/008_partial_sales_fulfilment.sql"));
        foreach (array_filter(array_map("trim", explode(";", $sql))) as $statement) {
            if (strtoupper($statement) !== "USE AEROSOFT360_REBUILD") {
                DB::statement($statement);
            }
        }
    }
    public function down(): void
    {
        DB::statement("DROP TABLE IF EXISTS sales_invoice_lines");
        DB::statement("ALTER TABLE sales_invoices DROP INDEX sales_invoices_sales_order_id_index");
        DB::statement(
            "ALTER TABLE sales_invoices ADD UNIQUE INDEX sales_order_id (sales_order_id)",
        );
        DB::statement("ALTER TABLE sales_order_size_lines DROP COLUMN invoiced_quantity");
    }
};
