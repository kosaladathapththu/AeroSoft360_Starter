<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('finished_goods_stock')) {
            Schema::create('finished_goods_stock', function (Blueprint $table) {
                $table->id();
                $table->foreignId('article_id')->constrained('articles');
                $table->string('size_label', 30);
                $table->decimal('quantity', 18, 4)->default(0);
                $table->timestamps();
                $table->unique(['article_id', 'size_label']);
            });
        }
        if (! Schema::hasTable('finished_goods_movements')) {
            Schema::create('finished_goods_movements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('article_id')->constrained('articles');
                $table->string('size_label', 30);
                $table->string('movement_type', 30);
                $table->decimal('quantity', 18, 4);
                $table->string('source_type', 40);
                $table->unsignedBigInteger('source_id');
                $table->string('event_key', 120)->unique();
                $table->date('occurred_at');
                $table->timestamps();
            });
        }
        DB::statement('INSERT IGNORE INTO finished_goods_stock (article_id, size_label, quantity, created_at, updated_at) SELECT s.article_id, i.size_label, 0, NOW(), NOW() FROM article_set_items i JOIN article_set_templates s ON s.id = i.set_template_id GROUP BY s.article_id, i.size_label');
    }

    public function down(): void
    {
        Schema::dropIfExists('finished_goods_movements');
        Schema::dropIfExists('finished_goods_stock');
    }
};
