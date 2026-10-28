<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable("finished_goods_stock")) {
            Schema::create("finished_goods_stock", function (Blueprint $table) {
                $table->id();
                $table->foreignId("article_id")->constrained("articles");
                $table->string("size_label", 30);
                $table->decimal("quantity", 18, 4)->default(0);
                $table->timestamps();
                $table->unique(["article_id", "size_label"]);
            });
        }
        if (!Schema::hasTable("finished_goods_movements")) {
            Schema::create("finished_goods_movements", function (Blueprint $table) {
                $table->id();
                $table->foreignId("article_id")->constrained("articles");
                $table->string("size_label", 30);
                $table->string("movement_type", 30);
                $table->decimal("quantity", 18, 4);
                $table->string("source_type", 40);
                $table->unsignedBigInteger("source_id");
                $table->string("event_key", 120)->unique();
                $table->date("occurred_at");
                $table->timestamps();
            });
        }
        DB::statement(
            "INSERT IGNORE INTO finished_goods_stock (article_id, size_label, quantity, created_at, updated_at) SELECT s.article_id, i.size_label, 0, NOW(), NOW() FROM article_set_items i JOIN article_set_templates s ON s.id = i.set_template_id GROUP BY s.article_id, i.size_label",
        );
        DB::statement(
            "INSERT IGNORE INTO finished_goods_stock (article_id, size_label, quantity, created_at, updated_at) SELECT article_id, size_label, 0, NOW(), NOW() FROM sales_invoice_lines GROUP BY article_id, size_label",
        );
        DB::statement(
            "INSERT IGNORE INTO finished_goods_movements (article_id, size_label, movement_type, quantity, source_type, source_id, event_key, occurred_at, created_at, updated_at) SELECT l.article_id, l.size_label, 'sale', -SUM(l.quantity), 'sales_invoice', l.sales_invoice_id, CONCAT('invoice:', l.sales_invoice_id, ':', l.article_id, ':', l.size_label, ':out'), i.invoice_date, NOW(), NOW() FROM sales_invoice_lines l JOIN sales_invoices i ON i.id = l.sales_invoice_id GROUP BY l.sales_invoice_id, l.article_id, l.size_label, i.invoice_date",
        );
        DB::statement(
            "UPDATE finished_goods_stock stock JOIN (SELECT article_id, size_label, SUM(quantity) quantity FROM finished_goods_movements GROUP BY article_id, size_label) movement ON movement.article_id = stock.article_id AND movement.size_label = stock.size_label SET stock.quantity = movement.quantity, stock.updated_at = NOW()",
        );
    }

    public function down(): void
    {
        Schema::dropIfExists("finished_goods_movements");
        Schema::dropIfExists("finished_goods_stock");
    }
};
