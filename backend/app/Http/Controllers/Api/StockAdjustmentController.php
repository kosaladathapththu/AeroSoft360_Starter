<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class StockAdjustmentController extends Controller
{
    public function store(Request $request, PostingService $posting): JsonResponse
    {
        $data = $request->validate([
            "material_id" => ["required", "integer", "exists:materials,id"],
            "batch_number" => ["required", "string", "max:80"],
            "adjustment_date" => ["required", "date"],
            "adjustment_type" => ["required", "in:increase,decrease"],
            "quantity" => ["required", "numeric", "gt:0"],
            "unit_cost" => ["required", "numeric", "gte:0"],
            "reason" => ["required", "string", "max:255"],
        ]);
        return DB::transaction(function () use ($data, $posting) {
            $balance = DB::table("stock_balances")
                ->where("material_id", $data["material_id"])
                ->where("batch_number", $data["batch_number"])
                ->lockForUpdate()
                ->first();
            if ($data["adjustment_type"] === "decrease") {
                abort_unless($balance, 422, "The selected batch does not exist.");
                abort_if(
                    (float) $data["quantity"] > (float) $balance->quantity,
                    422,
                    "Adjustment exceeds the available batch quantity.",
                );
            }
            $cost =
                $data["unit_cost"] > 0
                    ? (float) $data["unit_cost"]
                    : (float) ($balance->unit_cost ?? 0);
            abort_if($cost <= 0, 422, "Enter a unit cost for this adjustment.");
            $total = round((float) $data["quantity"] * $cost, 2);
            $number =
                "ADJ-" .
                now()->format("ym") .
                "-" .
                str_pad(
                    (string) (DB::table("stock_adjustments")->count() + 1),
                    4,
                    "0",
                    STR_PAD_LEFT,
                );
            $id = DB::table("stock_adjustments")->insertGetId(
                array_merge($data, [
                    "number" => $number,
                    "unit_cost" => $cost,
                    "total" => $total,
                    "status" => "posted",
                    "created_at" => now(),
                    "updated_at" => now(),
                ]),
            );
            $signedQuantity =
                $data["adjustment_type"] === "increase"
                    ? (float) $data["quantity"]
                    : -(float) $data["quantity"];
            DB::table("stock_movements")->insert([
                "material_id" => $data["material_id"],
                "batch_number" => $data["batch_number"],
                "movement_type" => "stock_adjustment_" . $data["adjustment_type"],
                "quantity" => $signedQuantity,
                "unit_cost" => $cost,
                "source_type" => "stock_adjustment",
                "source_id" => $id,
                "event_key" => "stock-adjustment:{$id}",
                "occurred_at" => $data["adjustment_date"],
                "created_at" => now(),
            ]);
            if ($balance) {
                DB::table("stock_balances")
                    ->where("id", $balance->id)
                    ->update([
                        "quantity" => (float) $balance->quantity + $signedQuantity,
                        "unit_cost" => $cost,
                        "updated_at" => now(),
                    ]);
            } else {
                DB::table("stock_balances")->insert([
                    "material_id" => $data["material_id"],
                    "batch_number" => $data["batch_number"],
                    "quantity" => $signedQuantity,
                    "unit_cost" => $cost,
                    "updated_at" => now(),
                ]);
            }
            $increase = $data["adjustment_type"] === "increase";
            $journalId = $posting->post(
                "stock_adjustment",
                $id,
                $data["adjustment_date"],
                "Stock adjustment {$number}: {$data["reason"]}",
                [
                    [
                        "account_code" => $increase ? "1300" : "5000",
                        "debit" => $total,
                        "credit" => 0,
                    ],
                    [
                        "account_code" => $increase ? "5000" : "1300",
                        "debit" => 0,
                        "credit" => $total,
                    ],
                ],
            );
            DB::table("audit_logs")->insert([
                "event" => "stock_adjustment.posted",
                "entity_type" => "stock_adjustment",
                "entity_id" => $id,
                "payload" => json_encode(["journal_id" => $journalId, "total" => $total]),
                "created_at" => now(),
            ]);
            return response()->json(
                ["id" => $id, "number" => $number, "journal_id" => $journalId, "total" => $total],
                201,
            );
        });
    }
}
