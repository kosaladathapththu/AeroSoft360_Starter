<?php

namespace App\Services\Inventory;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class FinishedGoodsInventoryService
{
    public function issueInvoice(int $invoiceId, string $date): void
    {
        (new SerialWarrantyService())->issueForInvoice($invoiceId);
        $lines = DB::table("sales_invoice_lines")
            ->where("sales_invoice_id", $invoiceId)
            ->select("article_id", "size_label", "colour", DB::raw("SUM(quantity) quantity"))
            ->groupBy("article_id", "size_label", "colour")
            ->get();
        foreach ($lines as $line) {
            $this->move(
                (int) $line->article_id,
                $line->size_label,
                -(float) $line->quantity,
                "sale",
                "sales_invoice",
                $invoiceId,
                "invoice:$invoiceId:{$line->article_id}:{$line->size_label}:{$line->colour}:out",
                $date,
                true,
                (string) ($line->colour ?? ""),
            );
        }
    }

    public function restoreInvoice(int $invoiceId, string $date): void
    {
        (new SerialWarrantyService())->guardInvoice($invoiceId);
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

    public function receiveReturn(
        int $articleId,
        string $size,
        int $quantity,
        int $returnId,
        int $lineId,
        string $date,
        string $colour = "",
    ): void {
        DB::table("articles")->where("id", $articleId)->lockForUpdate()->first();
        $this->move(
            $articleId,
            $size,
            $quantity,
            "sales_return",
            "sales_return",
            $returnId,
            "sales-return:$returnId:line:$lineId",
            $date,
            false,
            $colour,
        );
    }

    /** Colour counts replace article stock without assigning invented sizes. */
    public function setColourCounts(int $articleId, array $rows, string $date): void
    {
        DB::table('articles')->where('id', $articleId)->lockForUpdate()->first();
        $balances = DB::table('finished_goods_stock')->where('article_id', $articleId)->lockForUpdate()->get();
        foreach ($balances as $balance) {
            if ((float) $balance->quantity !== 0.0) {
                $this->move($articleId, $balance->size_label, -(float) $balance->quantity, 'article_count', 'manual_adjustment', 0, 'colour-count:'.uniqid('', true), $date, false);
            }
        }
        foreach ($rows as $row) {
            $key = $row['colour'] === '' ? '__ARTICLE_TOTAL__' : '__COLOUR__:'.$row['colour'];
            $this->move($articleId, $key, (float) $row['quantity'], 'article_count', 'manual_adjustment', 0, 'colour-count:'.uniqid('', true), $date, false);
        }
    }

    /** Article counts use one shared balance, without inventing size quantities. */
    public function setArticleCount(int $articleId, float $quantity, string $date): void
    {
        DB::table('articles')->where('id', $articleId)->lockForUpdate()->first();
        $balances = DB::table('finished_goods_stock')->where('article_id', $articleId)->lockForUpdate()->get();
        foreach ($balances as $balance) {
            if ($balance->size_label !== '__ARTICLE_TOTAL__' && (float) $balance->quantity !== 0.0) {
                $this->move($articleId, $balance->size_label, -(float) $balance->quantity, 'article_count', 'manual_adjustment', 0, 'article-count:'.uniqid('', true), $date, false);
            }
        }
        DB::table('finished_goods_stock')->where('article_id', $articleId)->whereRaw("SUBSTR(size_label, 1, 11) = ?", ['__COLOUR__:'])->delete();
        $current = (float) ($balances->firstWhere('size_label', '__ARTICLE_TOTAL__')->quantity ?? 0);
        if ($quantity !== $current || !$balances->contains('size_label', '__ARTICLE_TOTAL__')) {
            $this->move($articleId, '__ARTICLE_TOTAL__', $quantity - $current, 'article_count', 'manual_adjustment', 0, 'article-count:'.uniqid('', true), $date, false);
        }
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
        string $colour = "",
    ): void {
        if (DB::table("finished_goods_movements")->where("event_key", $eventKey)->exists()) {
            return;
        }
        // Sales and returns keep their original item sizes on documents, but use the
        // shared article balance once stock has been counted by article.
        DB::table('articles')->where('id', $articleId)->lockForUpdate()->first();
        if ($movementType !== 'article_count' && !str_starts_with($size, '__COLOUR__:')) {
            $colourMode = DB::table('finished_goods_stock')->where('article_id', $articleId)->whereRaw("SUBSTR(size_label, 1, 11) = ?", ['__COLOUR__:'])->exists();
            if ($colourMode) {
                // Explicitly coloured sales must consume that colour. Never borrow another colour.
                $size = $colour === '' ? '__ARTICLE_TOTAL__' : '__COLOUR__:'.$colour;
            } elseif (DB::table('finished_goods_stock')->where('article_id', $articleId)->where('size_label', '__ARTICLE_TOTAL__')->exists()) {
                $size = '__ARTICLE_TOTAL__';
            }
        }
        $balance = DB::table("finished_goods_stock")
            ->where(["article_id" => $articleId, "size_label" => $size])
            ->lockForUpdate()
            ->first();
        $current = (float) ($balance->quantity ?? 0);
        $next = $current + $quantity;
        if ($preventNegative && $next < -0.0001) {
            throw ValidationException::withMessages([
                "inventory" => "Insufficient finished-goods stock for " . (str_starts_with($size, "__COLOUR__:") ? "colour " . substr($size, 11) : ($size === "__ARTICLE_TOTAL__" ? "unassigned article stock" : "size $size")) . ". Available: $current.",
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
