<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
    public function up(): void
    {
        $sql = file_get_contents(
            base_path("../database/mysql/009_po_badge_and_individual_sizes.sql"),
        );
        foreach (array_filter(array_map("trim", explode(";", $sql))) as $statement) {
            if (strtoupper($statement) !== "USE AEROSOFT360_REBUILD") {
                DB::statement($statement);
            }
        }
    }
    public function down(): void
    {
        DB::statement(
            "ALTER TABLE customer_po_lines DROP FOREIGN KEY customer_po_lines_set_item_fk",
        );
        DB::statement(
            "ALTER TABLE customer_po_lines DROP COLUMN set_item_id, DROP COLUMN order_mode",
        );
    }
};
