<?php

namespace App\Services\Accounting;

use Illuminate\Support\Facades\Schema;

final class ReceiptScope
{
    /** Keep historical aging correct when a cheque is returned at a later date. */
    public static function asOf($query, string $alias, string $date): void
    {
        if (!Schema::hasTable('customer_collections')) {
            $query->where("$alias.status", 'posted');
            return;
        }
        $query->where(function ($q) use ($alias, $date) {
            $q->where("$alias.status", 'posted')->orWhere(function ($q) use ($alias, $date) {
                $q->where("$alias.status", 'returned')->whereExists(function ($sub) use ($alias, $date) {
                    $sub->selectRaw('1')->from('customer_collection_lines as effective_line')
                        ->join('customer_collections as effective_collection', 'effective_collection.id', '=', 'effective_line.collection_id')
                        ->whereColumn('effective_line.receipt_id', "$alias.id")
                        ->whereDate('effective_collection.returned_date', '>', $date);
                });
            });
        });
    }
}
