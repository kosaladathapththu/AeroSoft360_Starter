<?php

namespace App\Http\Controllers\Api;

use App\Services\Inventory\FinishedGoodsInventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class ColourStockController
{
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'expected_total' => 'required|integer|min:0',
            'reason' => 'required|string|min:3|max:255',
            'colours' => 'required|array|min:1|max:100',
            'colours.*.colour' => 'present|nullable|string|max:60|distinct',
            'colours.*.quantity' => 'required|integer|min:0|max:999999999',
        ]);
        $data['colours'] = array_map(fn ($row) => ['colour' => trim((string) ($row['colour'] ?? '')), 'quantity' => $row['quantity']], $data['colours']);
        return DB::transaction(function () use ($id, $data) {
            abort_unless(DB::table('articles')->where('id', $id)->where('status', 'active')->lockForUpdate()->first(), 404);
            $current = (float) DB::table('finished_goods_stock')->where('article_id', $id)->sum('quantity');
            abort_if(abs($current - $data['expected_total']) > 0.001, 422, 'Stock changed. Refresh this article before saving.');
            $allowed = DB::table('article_set_items as i')->join('article_set_templates as t', 't.id', '=', 'i.set_template_id')->where('t.article_id', $id)->pluck('i.colours')
                ->flatMap(fn ($value) => preg_split('/[,;\r\n]+/', (string) $value))->map(fn ($value) => trim($value))->filter()->unique();
            $existing = DB::table('finished_goods_stock')->where('article_id', $id)->pluck('size_label')->filter(fn ($key) => str_starts_with($key, '__COLOUR__:'))->map(fn ($key) => substr($key, 11));
            foreach ($data['colours'] as $row) {
                abort_unless($row['colour'] === '' || $allowed->contains($row['colour']) || $existing->contains($row['colour']), 422, 'Choose a colour from the article catalogue.');
            }
            (new FinishedGoodsInventoryService())->setColourCounts($id, $data['colours'], date('Y-m-d'));
            DB::table('audit_logs')->insert(['event' => 'inventory.colour_count_updated', 'entity_type' => 'article', 'entity_id' => $id,
                'payload' => json_encode($data), 'created_at' => now()]);
            return response()->json(['message' => 'Colour quantities updated.']);
        });
    }
}
