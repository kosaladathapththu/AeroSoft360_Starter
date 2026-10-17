<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['item_code', 'colours', 'production_cost', 'price_source', 'source_row', 'price_updated_at'] as $column) {
            if (!Schema::hasColumn('article_set_items', $column)) {
                Schema::table('article_set_items', function (Blueprint $table) use ($column): void {
                    if ($column === 'item_code') $table->string('item_code', 60)->nullable()->after('size_label');
                    if ($column === 'colours') $table->string('colours', 255)->nullable()->after('item_code');
                    if ($column === 'production_cost') $table->decimal('production_cost', 18, 2)->nullable()->after('colours');
                    if ($column === 'price_source') $table->string('price_source', 120)->nullable()->after('unit_price');
                    if ($column === 'source_row') $table->unsignedInteger('source_row')->nullable()->after('price_source');
                    if ($column === 'price_updated_at') $table->timestamp('price_updated_at')->nullable()->after('price_source');
                });
            }
        }

        if (!Schema::hasTable('price_list_imports')) Schema::create('price_list_imports', function (Blueprint $table): void {
            $table->id();
            $table->string('file_name');
            $table->string('sheet_name')->nullable();
            $table->unsignedInteger('rows_read')->default(0);
            $table->unsignedInteger('articles_created')->default(0);
            $table->unsignedInteger('articles_updated')->default(0);
            $table->unsignedInteger('items_created')->default(0);
            $table->unsignedInteger('items_updated')->default(0);
            $table->unsignedInteger('rows_skipped')->default(0);
            $table->json('warnings')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_list_imports');
        Schema::table('article_set_items', function (Blueprint $table): void {
            $table->dropColumn(['item_code', 'colours', 'production_cost', 'price_source', 'source_row', 'price_updated_at']);
        });
    }
};
