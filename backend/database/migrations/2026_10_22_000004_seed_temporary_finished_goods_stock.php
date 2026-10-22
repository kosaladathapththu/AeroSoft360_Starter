<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('finished_goods_stock')) return;

        DB::table('finished_goods_stock')->update([
            'quantity' => 50,
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('finished_goods_stock')) return;

        DB::table('finished_goods_stock')->update([
            'quantity' => 0,
            'updated_at' => now(),
        ]);
    }
};
