<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create("quotations", function (Blueprint $t) {
            $t->id();
            $t->string("number")->nullable()->unique();
            $t->foreignId("customer_id")->constrained();
            $t->foreignId("sales_rep_id")->constrained("sales_representatives");
            $t->date("quotation_date");
            $t->date("valid_until");
            $t->string("sale_type", 20)->default("credit");
            $t->text("notes")->nullable();
            $t->json("lines");
            $t->decimal("total", 18, 2);
            $t->string("status", 20)->default("open");
            $t->foreignId("sales_order_id")->nullable()->unique()->constrained();
            $t->unsignedBigInteger("created_by")->nullable();
            $t->timestamps();
        });
        Schema::create("supplier_invoices", function (Blueprint $t) {
            $t->id();
            $t->foreignId("goods_receipt_id")->unique()->constrained();
            $t->foreignId("supplier_id")->constrained();
            $t->string("invoice_number", 80);
            $t->date("invoice_date");
            $t->date("due_date");
            $t->decimal("total", 18, 2);
            $t->text("notes")->nullable();
            $t->unsignedBigInteger("created_by")->nullable();
            $t->timestamps();
            $t->unique(["supplier_id", "invoice_number"]);
        });
        Schema::create("purchase_returns", function (Blueprint $t) {
            $t->id();
            $t->string("number")->nullable()->unique();
            $t->foreignId("goods_receipt_id")->constrained();
            $t->date("return_date");
            $t->string("reason", 500);
            $t->decimal("total", 18, 2);
            $t->foreignId("journal_id")->nullable()->constrained("journal_entries");
            $t->string("status", 20)->default("posted");
            $t->date("void_date")->nullable();
            $t->string("void_reason", 500)->nullable();
            $t->foreignId("reversal_journal_id")->nullable()->constrained("journal_entries");
            $t->unsignedBigInteger("created_by")->nullable();
            $t->timestamps();
        });
        Schema::create("purchase_return_lines", function (Blueprint $t) {
            $t->id();
            $t->foreignId("purchase_return_id")->constrained();
            $t->foreignId("goods_receipt_line_id")->constrained();
            $t->decimal("quantity", 18, 4);
            $t->decimal("unit_cost", 18, 4);
            $t->decimal("total", 18, 2);
            $t->unique(["purchase_return_id", "goods_receipt_line_id"]);
        });
        Schema::create("cash_closings", function (Blueprint $t) {
            $t->id();
            $t->foreignId("account_id")->constrained();
            $t->date("closing_date");
            $t->decimal("opening", 18, 2);
            $t->decimal("receipts", 18, 2);
            $t->decimal("payments", 18, 2);
            $t->decimal("expected", 18, 2);
            $t->decimal("counted", 18, 2);
            $t->decimal("difference", 18, 2);
            $t->string("notes", 500)->nullable();
            $t->string("status", 20)->default("closed");
            $t->unsignedBigInteger("closed_by")->nullable();
            $t->timestamps();
            $t->unique(["account_id", "closing_date"]);
        });
        Schema::create("recurring_journals", function (Blueprint $t) {
            $t->id();
            $t->string("description", 255);
            $t->json("lines");
            $t->date("starts_on");
            $t->date("next_date");
            $t->unsignedSmallInteger("interval_months")->default(1);
            $t->string("status", 20)->default("active");
            $t->timestamps();
        });
        Schema::create("recurring_journal_runs", function (Blueprint $t) {
            $t->id();
            $t->foreignId("recurring_journal_id")->constrained();
            $t->date("posting_date");
            $t->foreignId("journal_id")->nullable()->constrained("journal_entries");
            $t->unsignedBigInteger("posted_by")->nullable();
            $t->unique(["recurring_journal_id", "posting_date"]);
        });
        Schema::create("catalog_terms", function (Blueprint $t) {
            $t->id();
            $t->string("kind", 20);
            $t->string("name", 80);
            $t->boolean("active")->default(true);
            $t->timestamps();
            $t->unique(["kind", "name"]);
        });
        Schema::create("stock_import_batches", function (Blueprint $t) {
            $t->id();
            $t->uuid("import_key")->unique();
            $t->string("payload_hash", 64);
            $t->unsignedInteger("rows");
            $t->timestamp("created_at");
        });
        Schema::create('salary_payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('payroll_item_id')->constrained();
            $t->foreignId('payment_account_id')->constrained('accounts');
            $t->date('payment_date');
            $t->decimal('amount', 18, 2);
            $t->foreignId('journal_id')->nullable()->constrained('journal_entries');
            $t->string('status', 20)->default('posted');
            $t->date('void_date')->nullable();
            $t->string('void_reason', 500)->nullable();
            $t->foreignId('reversal_journal_id')->nullable()->constrained('journal_entries');
            $t->unsignedBigInteger('created_by')->nullable();
            $t->timestamps();
        });
        Schema::table("articles", function (Blueprint $t) {
            $t->string("brand", 80)->nullable();
            $t->string("unit", 20)->default("piece");
        });
        foreach (["articles", "materials"] as $table) {
            foreach (
                \Illuminate\Support\Facades\DB::table($table)->distinct()->pluck("category")
                as $name
            ) {
                \Illuminate\Support\Facades\DB::table("catalog_terms")->insertOrIgnore([
                    "kind" => "category",
                    "name" => $name,
                    "active" => true,
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
            }
        }
        foreach (
            \Illuminate\Support\Facades\DB::table("materials")
                ->distinct()
                ->pluck("unit")
                ->push("piece")
                ->unique()
            as $name
        ) {
            \Illuminate\Support\Facades\DB::table("catalog_terms")->insertOrIgnore([
                "kind" => "unit",
                "name" => $name,
                "active" => true,
                "created_at" => now(),
                "updated_at" => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table("articles", fn(Blueprint $t) => $t->dropColumn(["brand", "unit"]));
        foreach (
            [
                "salary_payments",
                "stock_import_batches",
                "catalog_terms",
                "recurring_journal_runs",
                "recurring_journals",
                "cash_closings",
                "purchase_return_lines",
                "purchase_returns",
                "supplier_invoices",
                "quotations",
            ]
            as $table
        ) {
            Schema::dropIfExists($table);
        }
    }
};
