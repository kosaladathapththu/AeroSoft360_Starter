<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('article_set_items')
            ->whereNotNull('source_row')
            ->where('price_source', '<>', 'Manual')
            ->update(['quantity' => 2, 'updated_at' => now()]);

        DB::table('articles')->orderBy('id')->each(function (object $article): void {
            $pieces = DB::table('article_set_templates as sets')
                ->join('article_set_items as items', 'items.set_template_id', '=', 'sets.id')
                ->where('sets.article_id', $article->id)
                ->where('sets.status', 'active')
                ->whereNotNull('items.source_row')
                ->selectRaw('SUM(items.quantity) as pieces')
                ->groupBy('sets.id')
                ->value('pieces');

            if ($pieces !== null) {
                DB::table('articles')->where('id', $article->id)->update([
                    'pieces_per_set' => $pieces,
                    'updated_at' => now(),
                ]);
            }
        });
    }

    public function down(): void
    {
        DB::table('article_set_items')
            ->whereNotNull('source_row')
            ->where('price_source', '<>', 'Manual')
            ->update(['quantity' => 1, 'updated_at' => now()]);
    }
};
