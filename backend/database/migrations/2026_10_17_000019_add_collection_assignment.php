<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn("customer_receipts", "collector_sales_rep_id")) {
            Schema::table("customer_receipts", function (Blueprint $table) {
                $table
                    ->unsignedBigInteger("collector_sales_rep_id")
                    ->nullable()
                    ->after("sales_rep_id");
                $table->string("collection_type", 30)->default("regular")->after("receipt_date");
                $table
                    ->foreign("collector_sales_rep_id")
                    ->references("id")
                    ->on("sales_representatives")
                    ->nullOnDelete();
            });
            DB::statement("UPDATE customer_receipts SET collector_sales_rep_id = sales_rep_id");
        }
        if (!Schema::hasColumn("receipt_allocations", "commission_payee_sales_rep_id")) {
            Schema::table("receipt_allocations", function (Blueprint $table) {
                $table
                    ->unsignedBigInteger("commission_payee_sales_rep_id")
                    ->nullable()
                    ->after("invoice_id");
                $table
                    ->string("commission_decision", 30)
                    ->default("invoice_salesperson")
                    ->after("commission_status");
                $table
                    ->foreign("commission_payee_sales_rep_id")
                    ->references("id")
                    ->on("sales_representatives")
                    ->nullOnDelete();
            });
            DB::statement(
                "UPDATE receipt_allocations allocation JOIN sales_invoices invoice ON invoice.id = allocation.invoice_id SET allocation.commission_payee_sales_rep_id = invoice.sales_rep_id",
            );
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn("receipt_allocations", "commission_payee_sales_rep_id")) {
            Schema::table("receipt_allocations", function (Blueprint $table) {
                $table->dropForeign(["commission_payee_sales_rep_id"]);
                $table->dropColumn(["commission_payee_sales_rep_id", "commission_decision"]);
            });
        }
        if (Schema::hasColumn("customer_receipts", "collector_sales_rep_id")) {
            Schema::table("customer_receipts", function (Blueprint $table) {
                $table->dropForeign(["collector_sales_rep_id"]);
                $table->dropColumn(["collector_sales_rep_id", "collection_type"]);
            });
        }
    }
};
