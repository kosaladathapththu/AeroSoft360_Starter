<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
    public function up(): void
    {
        $sql = file_get_contents(
            base_path("../database/mysql/007_article_sets_and_collection_commission.sql"),
        );
        foreach (array_filter(array_map("trim", explode(";", $sql))) as $statement) {
            if (strtoupper($statement) !== "USE AEROSOFT360_REBUILD") {
                DB::statement($statement);
            }
        }
    }
    public function down(): void
    {
        DB::statement("ALTER TABLE receipt_allocations DROP COLUMN commission_rate");
        DB::statement("ALTER TABLE customer_po_lines DROP COLUMN set_template_id");
        DB::statement("DROP TABLE IF EXISTS article_set_items");
        DB::statement("DROP TABLE IF EXISTS article_set_templates");
    }
};
