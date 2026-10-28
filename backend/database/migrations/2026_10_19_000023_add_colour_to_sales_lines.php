<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn("sales_order_size_lines", "colour")) {
            Schema::table(
                "sales_order_size_lines",
                fn(Blueprint $table) => $table
                    ->string("colour", 80)
                    ->nullable()
                    ->after("size_label"),
            );
        }
        if (!Schema::hasColumn("sales_invoice_lines", "colour")) {
            Schema::table(
                "sales_invoice_lines",
                fn(Blueprint $table) => $table
                    ->string("colour", 80)
                    ->nullable()
                    ->after("size_label"),
            );
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn("sales_invoice_lines", "colour")) {
            Schema::table(
                "sales_invoice_lines",
                fn(Blueprint $table) => $table->dropColumn("colour"),
            );
        }
        if (Schema::hasColumn("sales_order_size_lines", "colour")) {
            Schema::table(
                "sales_order_size_lines",
                fn(Blueprint $table) => $table->dropColumn("colour"),
            );
        }
    }
};
