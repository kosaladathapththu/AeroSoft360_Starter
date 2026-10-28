<?php

namespace App\Services\Procurement;

use App\Services\Accounting\PostingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class GoodsReceiptService
{
    public function __construct(private PostingService $posting) {}

    public function receive(int $purchaseOrderId, array $data): array
    {
        return DB::transaction(function () use ($purchaseOrderId, $data) {
            $order = DB::table("purchase_orders")->lockForUpdate()->find($purchaseOrderId);
            if (!$order || !in_array($order->status, ["approved", "part_received"], true)) {
                throw ValidationException::withMessages([
                    "purchase_order" => "Purchase order must be approved before receipt.",
                ]);
            }
            $number =
                "GRN-" .
                now()->format("ym") .
                "-" .
                str_pad((string) (DB::table("goods_receipts")->count() + 1), 4, "0", STR_PAD_LEFT);
            $total = 0;
            $prepared = [];
            foreach ($data["lines"] as $input) {
                $line = DB::table("purchase_order_lines")
                    ->where("purchase_order_id", $purchaseOrderId)
                    ->lockForUpdate()
                    ->find($input["purchase_order_line_id"]);
                if (!$line) {
                    throw ValidationException::withMessages([
                        "lines" => "A receipt line does not belong to this purchase order.",
                    ]);
                }
                $remaining = (float) $line->quantity - (float) $line->received_quantity;
                $quantity = (float) $input["quantity"];
                if ($quantity > $remaining + 0.00001) {
                    throw ValidationException::withMessages([
                        "lines" => "Received quantity exceeds the purchase order balance.",
                    ]);
                }
                $lineTotal = round($quantity * (float) $line->unit_cost, 2);
                $total += $lineTotal;
                $prepared[] = [$line, $input, $quantity, $lineTotal];
            }
            $receiptId = DB::table("goods_receipts")->insertGetId([
                "number" => $number,
                "purchase_order_id" => $purchaseOrderId,
                "supplier_id" => $order->supplier_id,
                "received_on" => $data["received_on"],
                "supplier_invoice" => $data["supplier_invoice"] ?? null,
                "status" => "posted",
                "total" => $total,
                "posted_at" => now(),
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            foreach ($prepared as [$line, $input, $quantity, $lineTotal]) {
                $receiptLineId = DB::table("goods_receipt_lines")->insertGetId([
                    "goods_receipt_id" => $receiptId,
                    "purchase_order_line_id" => $line->id,
                    "material_id" => $line->material_id,
                    "batch_number" => $input["batch_number"],
                    "quantity" => $quantity,
                    "unit_cost" => $line->unit_cost,
                    "line_total" => $lineTotal,
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
                DB::table("purchase_order_lines")
                    ->where("id", $line->id)
                    ->update([
                        "received_quantity" => DB::raw("received_quantity + " . (float) $quantity),
                        "updated_at" => now(),
                    ]);
                DB::table("stock_movements")->insert([
                    "material_id" => $line->material_id,
                    "batch_number" => $input["batch_number"],
                    "movement_type" => "purchase_receipt",
                    "quantity" => $quantity,
                    "unit_cost" => $line->unit_cost,
                    "source_type" => "goods_receipt",
                    "source_id" => $receiptId,
                    "event_key" => "grn:$receiptId:line:$receiptLineId",
                    "occurred_at" => $data["received_on"],
                    "created_at" => now(),
                ]);
                $balance = DB::table("stock_balances")
                    ->where([
                        "material_id" => $line->material_id,
                        "batch_number" => $input["batch_number"],
                    ])
                    ->lockForUpdate()
                    ->first();
                if ($balance) {
                    DB::table("stock_balances")
                        ->where("id", $balance->id)
                        ->update([
                            "quantity" => (float) $balance->quantity + $quantity,
                            "unit_cost" => $line->unit_cost,
                            "updated_at" => now(),
                        ]);
                } else {
                    DB::table("stock_balances")->insert([
                        "material_id" => $line->material_id,
                        "batch_number" => $input["batch_number"],
                        "quantity" => $quantity,
                        "unit_cost" => $line->unit_cost,
                        "updated_at" => now(),
                    ]);
                }
            }
            $remaining = DB::table("purchase_order_lines")
                ->where("purchase_order_id", $purchaseOrderId)
                ->whereRaw("received_quantity < quantity")
                ->exists();
            DB::table("purchase_orders")
                ->where("id", $purchaseOrderId)
                ->update([
                    "status" => $remaining ? "part_received" : "received",
                    "updated_at" => now(),
                ]);
            $journalId = $this->posting->post(
                "goods_receipt",
                $receiptId,
                $data["received_on"],
                "Raw materials received under $number",
                [
                    ["account_code" => "1300", "debit" => $total, "credit" => 0],
                    ["account_code" => "2100", "debit" => 0, "credit" => $total],
                ],
            );
            DB::table("audit_logs")->insert([
                "event" => "goods_receipt.posted",
                "entity_type" => "goods_receipt",
                "entity_id" => $receiptId,
                "payload" => json_encode([
                    "number" => $number,
                    "total" => $total,
                    "journal_id" => $journalId,
                ]),
                "created_at" => now(),
            ]);
            return [
                "id" => $receiptId,
                "number" => $number,
                "total" => $total,
                "journal_id" => $journalId,
                "status" => "posted",
            ];
        });
    }
}
