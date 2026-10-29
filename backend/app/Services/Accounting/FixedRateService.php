<?php
namespace App\Services\Accounting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class FixedRateService
{
    public static function catalog(int $articleId, string $size, ?int $itemId = null): ?float
    {
        if (!Schema::hasTable('article_set_items')) return null;
        $price = DB::table('article_set_items as i')->join('article_set_templates as s','s.id','=','i.set_template_id')
            ->where('s.article_id',$articleId)->where('i.size_label',$size)->when($itemId,fn($q)=>$q->where('i.id',$itemId))->orderBy('s.id')->orderBy('i.id')->value('i.unit_price');
        abort_if($itemId && $price === null,422,'The selected price-list item does not match the invoice article and size.');
        return $price === null ? null : (float)$price;
    }
    public static function poRate(object $line, object $item): float
    {
        $prices = json_decode($line->fixed_rates ?? '{}',true) ?? [];
        return (float)($line->custom_rate ?? $prices[$item->id] ?? $item->unit_price);
    }
    public static function poFixed(object $line, object $item): float
    {
        $prices = json_decode($line->fixed_rates ?? '{}',true) ?? [];
        return (float)($prices[$item->id] ?? $item->unit_price);
    }
}
