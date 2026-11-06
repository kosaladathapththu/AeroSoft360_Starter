<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn("customer_po_lines", "colour")) {
            Schema::table(
                "customer_po_lines",
                fn(Blueprint $table) => $table
                    ->string("colour", 80)
                    ->nullable()
                    ->after("article_id"),
            );
        }
    }
    public function down(): void
    {
        if (Schema::hasColumn("customer_po_lines", "colour")) {
            Schema::table(
                "customer_po_lines",
                fn(Blueprint $table) => $table->dropColumn("colour"),
            );
        }
    }
};
