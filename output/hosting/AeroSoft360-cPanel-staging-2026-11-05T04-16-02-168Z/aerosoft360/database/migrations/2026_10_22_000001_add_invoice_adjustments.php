<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table("sales_invoices", function (Blueprint $table) {
            $table->string("tax_type", 20)->default("fixed")->after("tax");
            $table->decimal("tax_rate", 7, 4)->default(0)->after("tax_type");
            $table->decimal("other_charges", 18, 2)->default(0)->after("tax_rate");
            $table->decimal("other_deduction", 18, 2)->default(0)->after("other_charges");
        });
    }

    public function down(): void
    {
        Schema::table(
            "sales_invoices",
            fn(Blueprint $table) => $table->dropColumn([
                "tax_type",
                "tax_rate",
                "other_charges",
                "other_deduction",
            ]),
        );
    }
};
