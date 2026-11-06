<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn("customer_pos", "cash_amount")) {
            Schema::table("customer_pos", function (Blueprint $table) {
                $table->decimal("cash_amount", 18, 2)->default(0)->after("sale_type");
                $table->decimal("credit_amount", 18, 2)->default(0)->after("cash_amount");
            });
        }
        DB::statement(
            "UPDATE customer_pos SET cash_amount = CASE WHEN sale_type='cash' THEN total ELSE 0 END, credit_amount = CASE WHEN sale_type='cash' THEN 0 ELSE total END",
        );
    }
    public function down(): void
    {
        if (Schema::hasColumn("customer_pos", "cash_amount")) {
            Schema::table(
                "customer_pos",
                fn(Blueprint $table) => $table->dropColumn(["cash_amount", "credit_amount"]),
            );
        }
    }
};
