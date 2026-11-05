<?php

namespace App\Services\Procurement;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class SupplierBalance
{
    public static function returned(int $receiptId, ?string $asOf = null): float
    {
        if (!Schema::hasTable("purchase_returns")) {
            return 0;
        }
        $q = DB::table("purchase_returns")
            ->where("goods_receipt_id", $receiptId)
            ->whereNotNull("journal_id");
        if ($asOf) {
            $q->whereDate("return_date", "<=", $asOf)->where(
                fn($q) => $q
                    ->where("status", "posted")
                    ->orWhere(
                        fn($q) => $q->where("status", "void")->whereDate("void_date", ">", $asOf),
                    ),
            );
        } else {
            $q->where("status", "posted");
        }
        return (float) $q->sum("total");
    }

    public static function available(object $receipt): float
    {
        $paid = DB::table("payment_vouchers")
            ->where("goods_receipt_id", $receipt->id)
            ->where("status", "posted")
            ->sum("total");
        return round((float) $receipt->total - (float) $paid - self::returned($receipt->id), 2);
    }
}
