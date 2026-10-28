<?php

namespace App\Services\Procurement;

use App\Services\Accounting\PostingService;
use Illuminate\Support\Facades\DB;

final class PurchaseReturnService
{
    public function __construct(private PostingService $posting) {}

    public function post(array $data, ?int $user): int
    {
        return DB::transaction(function () use ($data, $user) {
            $receipt = DB::table("goods_receipts")
                ->lockForUpdate()
                ->find($data["goods_receipt_id"]);
            abort_unless(
                $receipt && $receipt->status === "posted",
                422,
                "Choose a posted goods receipt.",
            );
            abort_if(
                $data["return_date"] < $receipt->received_on,
                422,
                "Return date cannot precede receipt.",
            );
            abort_if(trim($data["reason"]) === "", 422, "Enter the return reason.");
            $prepared = [];
            $total = 0;
            $seen = [];
            foreach ($data["lines"] as $input) {
                $id = $input["goods_receipt_line_id"];
                abort_if(isset($seen[$id]), 422, "A receipt line was selected twice.");
                $seen[$id] = true;
                $line = DB::table("goods_receipt_lines")
                    ->where("goods_receipt_id", $receipt->id)
                    ->find($id);
                abort_unless($line, 422, "Return line does not belong to this receipt.");
                $returned = DB::table("purchase_return_lines as l")
                    ->join("purchase_returns as r", "r.id", "=", "l.purchase_return_id")
                    ->where("r.status", "posted")
                    ->where("l.goods_receipt_line_id", $id)
                    ->sum("l.quantity");
                $quantity = (float) $input["quantity"];
                abort_if(
                    $quantity <= 0 || $quantity > (float) $line->quantity - $returned + 0.00001,
                    422,
                    "Return exceeds the quantity remaining on this receipt.",
                );
                $balance = DB::table("stock_balances")
                    ->where("material_id", $line->material_id)
                    ->where("batch_number", $line->batch_number)
                    ->lockForUpdate()
                    ->first();
                abort_unless(
                    $balance && (float) $balance->quantity + 0.00001 >= $quantity,
                    422,
                    "Insufficient batch stock for this return.",
                );
                $value = round($quantity * (float) $line->unit_cost, 2);
                $total += $value;
                $prepared[] = [$line, $quantity, $value];
                // Reserve in the same transaction so two receipt lines cannot consume the same stock twice.
                DB::table("stock_balances")
                    ->where("id", $balance->id)
                    ->update([
                        "quantity" => (float) $balance->quantity - $quantity,
                        "updated_at" => now(),
                    ]);
            }
            abort_if(
                $total <= 0 || $total > SupplierBalance::available($receipt) + 0.001,
                422,
                "Return exceeds the unpaid receipt balance. A paid return needs a supplier refund workflow.",
            );
            $id = DB::table("purchase_returns")->insertGetId([
                "goods_receipt_id" => $receipt->id,
                "return_date" => $data["return_date"],
                "reason" => trim($data["reason"]),
                "total" => $total,
                "created_by" => $user,
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            $number = "PR-" . str_pad((string) $id, 6, "0", STR_PAD_LEFT);
            foreach ($prepared as [$line, $quantity, $value]) {
                $lineId = DB::table("purchase_return_lines")->insertGetId([
                    "purchase_return_id" => $id,
                    "goods_receipt_line_id" => $line->id,
                    "quantity" => $quantity,
                    "unit_cost" => $line->unit_cost,
                    "total" => $value,
                ]);
                DB::table("stock_movements")->insert([
                    "material_id" => $line->material_id,
                    "batch_number" => $line->batch_number,
                    "movement_type" => "purchase_return",
                    "quantity" => -$quantity,
                    "unit_cost" => $line->unit_cost,
                    "source_type" => "purchase_return",
                    "source_id" => $id,
                    "event_key" => "purchase-return:$id:$lineId",
                    "occurred_at" => $data["return_date"],
                    "created_at" => now(),
                ]);
            }
            $journal = $this->posting->post(
                "purchase_return",
                $id,
                $data["return_date"],
                "$number / {$receipt->number}: {$data["reason"]}",
                [
                    ["account_code" => "2100", "debit" => $total, "credit" => 0],
                    ["account_code" => "1300", "debit" => 0, "credit" => $total],
                ],
            );
            DB::table("purchase_returns")
                ->where("id", $id)
                ->update(["number" => $number, "journal_id" => $journal]);
            DB::table("audit_logs")->insert([
                "event" => "purchase_return.posted",
                "entity_type" => "purchase_return",
                "entity_id" => $id,
                "payload" => json_encode([
                    "user_id" => $user,
                    "receipt_id" => $receipt->id,
                    "reason" => $data["reason"],
                    "journal_id" => $journal,
                ]),
                "created_at" => now(),
            ]);
            return $id;
        });
    }

    public function cancel(int $id, string $date, string $reason, ?int $user): void
    {
        DB::transaction(function () use ($id, $date, $reason, $user) {
            $r = DB::table("purchase_returns")->lockForUpdate()->find($id);
            abort_unless($r, 404);
            abort_unless($r->status === "posted", 422, "Return is already cancelled.");
            abort_if(
                $date < $r->return_date || trim($reason) === "",
                422,
                "Enter a reason and a reversal date on/after the return date.",
            );
            DB::table("goods_receipts")
                ->where("id", $r->goods_receipt_id)
                ->lockForUpdate()
                ->first();
            foreach (
                DB::table("purchase_return_lines as l")
                    ->join("goods_receipt_lines as g", "g.id", "=", "l.goods_receipt_line_id")
                    ->where("l.purchase_return_id", $id)
                    ->select("l.*", "g.material_id", "g.batch_number")
                    ->get()
                as $line
            ) {
                $b = DB::table("stock_balances")
                    ->where("material_id", $line->material_id)
                    ->where("batch_number", $line->batch_number)
                    ->lockForUpdate()
                    ->first();
                abort_unless($b, 422, "The original stock batch is unavailable.");
                DB::table("stock_balances")
                    ->where("id", $b->id)
                    ->update([
                        "quantity" => (float) $b->quantity + (float) $line->quantity,
                        "updated_at" => now(),
                    ]);
                DB::table("stock_movements")->insert([
                    "material_id" => $line->material_id,
                    "batch_number" => $line->batch_number,
                    "movement_type" => "purchase_return_reversal",
                    "quantity" => $line->quantity,
                    "unit_cost" => $line->unit_cost,
                    "source_type" => "purchase_return_reversal",
                    "source_id" => $id,
                    "event_key" => "purchase-return-reversal:$id:{$line->id}",
                    "occurred_at" => $date,
                    "created_at" => now(),
                ]);
            }
            $journal = $this->posting->post(
                "purchase_return_reversal",
                $id,
                $date,
                "Reverse " . $r->number . ": " . $reason,
                [
                    ["account_code" => "1300", "debit" => $r->total, "credit" => 0],
                    ["account_code" => "2100", "debit" => 0, "credit" => $r->total],
                ],
            );
            DB::table("purchase_returns")
                ->where("id", $id)
                ->update([
                    "status" => "void",
                    "void_date" => $date,
                    "void_reason" => trim($reason),
                    "reversal_journal_id" => $journal,
                    "updated_at" => now(),
                ]);
            DB::table("audit_logs")->insert([
                "event" => "purchase_return.cancelled",
                "entity_type" => "purchase_return",
                "entity_id" => $id,
                "payload" => json_encode([
                    "user_id" => $user,
                    "reason" => $reason,
                    "date" => $date,
                    "journal_id" => $journal,
                ]),
                "created_at" => now(),
            ]);
        });
    }
}
