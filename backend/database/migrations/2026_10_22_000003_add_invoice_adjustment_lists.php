<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table("sales_invoices", function (Blueprint $table) {
            $table->json("charge_adjustments")->nullable()->after("other_charges_description");
            $table->json("deduction_adjustments")->nullable()->after("other_deduction_description");
        });
    }

    public function down(): void
    {
        Schema::table(
            "sales_invoices",
            fn(Blueprint $table) => $table->dropColumn([
                "charge_adjustments",
                "deduction_adjustments",
            ]),
        );
    }
};
