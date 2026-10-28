<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create("manual_commissions", function (Blueprint $table) {
            $table->id();
            $table->foreignId("sales_rep_id")->constrained("sales_representatives");
            $table->foreignId("customer_id")->nullable()->constrained("customers");
            $table->foreignId("invoice_id")->nullable()->constrained("sales_invoices");
            $table->foreignId("receipt_id")->nullable()->constrained("customer_receipts");
            $table->date("commission_date");
            $table->decimal("basis_amount", 18, 2)->default(0);
            $table->decimal("commission_rate", 18, 2)->default(0);
            $table->decimal("commission_amount", 18, 2);
            $table->string("status", 25)->default("eligible");
            $table->string("notes")->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists("manual_commissions");
    }
};
