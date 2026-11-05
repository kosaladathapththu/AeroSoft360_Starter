<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
    public function up(): void
    {
        Schema::create("sales_returns", function (Blueprint $t) {
            $t->id();
            $t->string("number", 40)->nullable()->unique();
            $t->foreignId("sales_invoice_id")->constrained();
            $t->foreignId("customer_id")->constrained();
            $t->date("return_date");
            $t->text("reason");
            $t->string("status", 20)->default("posted");
            $t->decimal("total", 18, 2);
            $t->decimal("tax", 18, 2)->default(0);
            $t->unsignedBigInteger("journal_id")->nullable();
            $t->unsignedBigInteger("created_by")->nullable();
            $t->string("request_key", 80)->unique();
            $t->timestamps();
        });
        Schema::create("sales_return_lines", function (Blueprint $t) {
            $t->id();
            $t->foreignId("sales_return_id")->constrained();
            $t->foreignId("sales_invoice_line_id")->constrained();
            $t->foreignId("article_id")->constrained();
            $t->string("article_code", 40);
            $t->string("article_name", 160);
            $t->string("size_label", 30);
            $t->string("colour", 80)->nullable();
            $t->unsignedInteger("quantity");
            $t->decimal("rate", 18, 2);
            $t->decimal("total", 18, 2);
            $t->decimal("tax", 18, 2)->default(0);
            $t->string("condition", 20);
            $t->text("serial_ids")->nullable();
            $t->timestamps();
        });
        Schema::table(
            "sales_invoices",
            fn(Blueprint $t) => $t->decimal("returned_amount", 18, 2)->default(0),
        );
        DB::table("accounts")->insertOrIgnore([
            "code" => "4050",
            "name" => "Sales Returns and Allowances",
            "type" => "income",
            "is_postable" => 1,
            "is_active" => 1,
            "is_cash_account" => 0,
            "is_system" => 1,
            "cash_flow_activity" => "operating",
            "description" => "Contra revenue for credited customer returns",
            "created_at" => now(),
            "updated_at" => now(),
        ]);
    }
    public function down(): void
    {
        if (DB::table("sales_returns")->exists()) {
            throw new RuntimeException("Posted returns must be retained for audit.");
        }
        Schema::dropIfExists("sales_return_lines");
        Schema::dropIfExists("sales_returns");
        Schema::table("sales_invoices", fn(Blueprint $t) => $t->dropColumn("returned_amount"));
    }
};
