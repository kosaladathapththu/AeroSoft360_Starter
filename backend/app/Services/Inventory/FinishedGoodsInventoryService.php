<?php

namespace App\Services\Inventory;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class FinishedGoodsInventoryService
{
    public function issueInvoice(int $invoiceId, string $date): void
    {
        (new SerialWarrantyService)->issueForInvoice($invoiceId);
        $lines = DB::table("sales_invoice_lines")
            ->where("sales_invoice_id", $invoiceId)
            ->select("article_id", "size_label", DB::raw("SUM(quantity) quantity"))
            ->groupBy("article_id", "size_label")
            ->get();
        foreach ($lines as $line) {
            $this->move(
                (int) $line->article_id,
                $line->size_label,
                -(float) $line->quantity,
                "sale",
                "sales_invoice",
                $invoiceId,
                "invoice:$invoiceId:{$line->article_id}:{$line->size_label}:out",
                $date,
                true,
            );
        }
    }

    public function restoreInvoice(int $invoiceId, string $date): void
    {
        (new SerialWarrantyService)->guardInvoice($invoiceId);
        $issues = DB::table("finished_goods_movements")
            ->where([
                "source_type" => "sales_invoice",
                "source_id" => $invoiceId,
                "movement_type" => "sale",
            ])
            ->get();
        foreach ($issues as $issue) {
            $this->move(
                (int) $issue->article_id,
                $issue->size_label,
                abs((float) $issue->quantity),
                "sale_reversal",
                "sales_invoice",
                $invoiceId,
                $issue->event_key . ":return",
                $date,
                false,
            );
        }
    }

    public function adjust(
        int $articleId,
        string $size,
        float $quantity,
        string $type,
        string $date,
    ): void {
        $validSize = DB::table("article_set_items as item")
            ->join("article_set_templates as set", "set.id", "=", "item.set_template_id")
            ->where("set.article_id", $articleId)
            ->where("item.size_label", $size)
            ->exists();
        if (!$validSize) {
            throw ValidationException::withMessages([
                "size_label" => "The selected size does not belong to this article.",
            ]);
        }
        $signed = $type === "increase" ? abs($quantity) : -abs($quantity);
        $this->move(
            $articleId,
            $size,
            $signed,
            "adjustment_" . $type,
            "manual_adjustment",
            0,
            "adjustment:" . uniqid("", true),
            $date,
            $type === "decrease",
        );
    }

    private function move(
        int $articleId,
        string $size,
        float $quantity,
        string $movementType,
        string $sourceType,
        int $sourceId,
        string $eventKey,
        string $date,
        bool $preventNegative,
    ): void {
        if (DB::table("finished_goods_movements")->where("event_key", $eventKey)->exists()) {
            return;
        }
        $balance = DB::table("finished_goods_stock")
            ->where(["article_id" => $articleId, "size_label" => $size])
            ->lockForUpdate()
            ->first();
        $current = (float) ($balance->quantity ?? 0);
        $next = $current + $quantity;
        if ($preventNegative && $next < -0.0001) {
            throw ValidationException::withMessages([
                "inventory" => "Insufficient finished-goods stock for size $size. Available: $current.",
            ]);
        }
        if ($balance) {
            DB::table("finished_goods_stock")
                ->where("id", $balance->id)
                ->update(["quantity" => $next, "updated_at" => now()]);
        } else {
            DB::table("finished_goods_stock")->insert([
                "article_id" => $articleId,
                "size_label" => $size,
                "quantity" => $next,
                "created_at" => now(),
                "updated_at" => now(),
            ]);
        }
        DB::table("finished_goods_movements")->insert([
            "article_id" => $articleId,
            "size_label" => $size,
            "movement_type" => $movementType,
            "quantity" => $quantity,
            "source_type" => $sourceType,
            "source_id" => $sourceId,
            "event_key" => $eventKey,
            "occurred_at" => $date,
            "created_at" => now(),
            "updated_at" => now(),
        ]);
    }
}
