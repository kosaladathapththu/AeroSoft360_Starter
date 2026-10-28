<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table("sales_invoices", function (Blueprint $table) {
            $table->string("other_charges_description", 120)->nullable()->after("other_charges");
            $table
                ->string("other_deduction_description", 120)
                ->nullable()
                ->after("other_deduction");
        });
    }

    public function down(): void
    {
        Schema::table(
            "sales_invoices",
            fn(Blueprint $table) => $table->dropColumn([
                "other_charges_description",
                "other_deduction_description",
            ]),
        );
    }
};
