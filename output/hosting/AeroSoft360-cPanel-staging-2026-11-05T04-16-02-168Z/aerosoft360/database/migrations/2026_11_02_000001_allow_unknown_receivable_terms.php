<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE customers MODIFY credit_days SMALLINT UNSIGNED NULL DEFAULT NULL",
        );
        DB::statement("ALTER TABLE sales_invoices MODIFY due_date DATE NULL");
        DB::statement(
            "ALTER TABLE customer_opening_balances ADD INDEX customer_opening_customer_idx (customer_id)",
        );
        DB::statement(
            "ALTER TABLE customer_opening_balances DROP INDEX customer_opening_balances_customer_id_unique",
        );
    }
    public function down(): void
    {
        // Unknown terms must be resolved explicitly before restoring NOT NULL constraints.
        if (
            DB::table("customers")->whereNull("credit_days")->exists() ||
            DB::table("sales_invoices")->whereNull("due_date")->exists()
        ) {
            throw new RuntimeException(
                "Resolve missing credit terms and due dates before rollback.",
            );
        }
        if (
            DB::table("customer_opening_balances")
                ->select("customer_id")
                ->groupBy("customer_id")
                ->havingRaw("COUNT(*) > 1")
                ->exists()
        ) {
            throw new RuntimeException(
                "Multiple opening invoices exist; rollback would discard invoice-level detail.",
            );
        }
        DB::statement(
            "ALTER TABLE customer_opening_balances ADD UNIQUE INDEX customer_opening_balances_customer_id_unique (customer_id)",
        );
        DB::statement(
            "ALTER TABLE customer_opening_balances DROP INDEX customer_opening_customer_idx",
        );
        DB::statement(
            "ALTER TABLE customers MODIFY credit_days SMALLINT UNSIGNED NOT NULL DEFAULT 30",
        );
        DB::statement("ALTER TABLE sales_invoices MODIFY due_date DATE NOT NULL");
    }
};
