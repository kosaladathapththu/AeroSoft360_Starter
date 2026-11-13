<?php

namespace App\Services\Accounting;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class CommissionPolicy
{
    public static function category(?int $repId): string
    {
        if (!Schema::hasColumn('sales_representatives', 'channel')) return 'direct';
        return DB::table('sales_representatives')->where('id', $repId)->value('channel') === 'head_office' ? 'head_office' : 'direct';
    }

    public static function rate(object $rep): float
    {
        if (self::category((int) $rep->id) !== 'head_office') return (float) ($rep->default_commission_rate ?? 0);
        return Schema::hasTable('head_office_commission_settings') ? (float) DB::table('head_office_commission_settings')->value('rate_per_piece') : 0;
    }

    public static function days(?int $repId): int
    {
        if (self::category($repId) === 'head_office' && Schema::hasTable('head_office_commission_settings')) {
            return (int) DB::table('head_office_commission_settings')->value('max_collection_days');
        }
        return (int) (DB::table('commission_settings')->value('max_collection_days') ?? 100);
    }

    public static function key(Request $request): string
    {
        $hash = Schema::hasTable('head_office_commission_settings') ? DB::table('head_office_commission_settings')->value('password_hash') : '';
        return 'head-office-unlock:'.hash('sha256', ($request->bearerToken() ?? '').'|'.$hash);
    }

    public static function unlocked(Request $request): bool
    {
        return $request->bearerToken() && Cache::get(self::key($request), false) === true;
    }

    public static function guard(Request $request, string $category): void
    {
        if ($category === 'head_office') abort_unless(self::unlocked($request), 403, 'Unlock Head Office commissions first.');
    }
}
