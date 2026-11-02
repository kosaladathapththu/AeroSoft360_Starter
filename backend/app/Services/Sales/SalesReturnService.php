<?php
namespace App\Services\Sales;
use App\Services\Accounting\PostingService;
use App\Services\Inventory\FinishedGoodsInventoryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class SalesReturnService
{
    /** Allocate invoice adjustments and tax in cents; a full return credits exactly the invoice total. */
    public function shares(int $cents, $lines): array
    {
        $weights = [];
        foreach ($lines as $line) {
            $weights[$line->id] = max(0, (float) $line->quantity * (float) $line->rate);
        }
        $base = array_sum($weights);
        if ($base <= 0 && $cents === 0) {
            return array_fill_keys(array_keys($weights), 0);
        }
        abort_unless($base > 0, 422, "The original invoice has no priced item quantities.");
        $shares = [];
        $remainders = [];
        foreach ($weights as $id => $weight) {
            $raw = ($cents * $weight) / $base;
            $shares[$id] = (int) floor($raw);
            $remainders[$id] = $raw - floor($raw);
        }
        arsort($remainders);
        $remaining = $cents - array_sum($shares);
        foreach (array_keys($remainders) as $id) {
            if ($remaining-- <= 0) {
                break;
            }
            $shares[$id]++;
        }
        return $shares;
    }

    public function post(array $data, ?int $user): int
    {
        return DB::transaction(function () use ($data, $user) {
            $invoice = DB::table("sales_invoices")
                ->lockForUpdate()
                ->find($data["sales_invoice_id"]);
            abort_unless(
                $invoice &&
                    !in_array($invoice->status, ["void", "cancelled"]) &&
                    !$invoice->is_opening_balance,
                422,
                "Choose an issued itemized sales invoice. Opening AR balances have no items to return.",
            );
            $prior = DB::table("sales_returns")
                ->where("request_key", $data["request_key"])
                ->first();
            if ($prior) {
                abort_unless(
                    (int) $prior->sales_invoice_id === (int) $invoice->id,
                    422,
                    "This request reference already belongs to another invoice.",
                );
                return (int) $prior->id;
            }
            abort_if(
                $data["return_date"] < $invoice->invoice_date,
                422,
                "Return date cannot precede the invoice date.",
            );
            abort_if(
                $data["return_date"] > now()->timezone("Asia/Colombo")->toDateString(),
                422,
                "A physical return cannot be dated in the future.",
            );
            abort_if(trim($data["reason"]) === "", 422, "Enter the return reason.");
            abort_unless(
                DB::table("accounting_periods")
                    ->where("starts_on", "<=", $data["return_date"])
                    ->where("ends_on", ">=", $data["return_date"])
                    ->where("status", "open")
                    ->exists(),
                422,
                "Return date must be in an open accounting period.",
            );
            $lastReturn = DB::table("sales_returns")
                ->where("sales_invoice_id", $invoice->id)
                ->max("return_date");
            abort_if(
                $lastReturn && $data["return_date"] < $lastReturn,
                422,
                "Return date cannot precede a previously posted return for this invoice.",
            );
            $lines = DB::table("sales_invoice_lines as l")
                ->join("articles as a", "a.id", "=", "l.article_id")
                ->where("l.sales_invoice_id", $invoice->id)
                ->select(
                    "l.*",
                    "a.code as article_code",
                    "a.name as article_name",
                    "a.track_serials",
                )
                ->orderBy("l.id")
                ->get();
            abort_if($lines->isEmpty(), 422, "This invoice has no identifiable items to return.");
            $grossShares = $this->shares((int) round($invoice->total * 100), $lines);
            $taxShares = $this->shares((int) round(($invoice->tax ?? 0) * 100), $lines);
            $prepared = [];
            $seen = [];
            $serialSeen = [];
            $total = 0;
            $tax = 0;
            foreach ($data["lines"] as $input) {
                $line = $lines->firstWhere("id", $input["sales_invoice_line_id"]);
                abort_unless($line, 422, "The selected line does not belong to this invoice.");
                abort_if(isset($seen[$line->id]), 422, "Select each invoice line once.");
                $seen[$line->id] = true;
                $returned = DB::table("sales_return_lines")
                    ->where("sales_invoice_line_id", $line->id)
                    ->sum("quantity");
                $quantity = (int) $input["quantity"];
                abort_if(
                    $quantity < 1 ||
                        $quantity != (float) $input["quantity"] ||
                        $quantity + $returned > (float) $line->quantity + 0.00001,
                    422,
                    "Return quantity exceeds the pieces remaining on the original invoice line.",
                );
                $condition = $input["condition"];
                abort_unless(
                    in_array($condition, ["sellable", "damaged"]),
                    422,
                    "Choose the returned item condition.",
                );
                // Difference of cumulative rounded credits prevents penny drift across repeated one-piece returns.
                $value =
                    (int) round(
                        ($grossShares[$line->id] * ($returned + $quantity)) /
                            (float) $line->quantity,
                    ) -
                    (int) round(($grossShares[$line->id] * $returned) / (float) $line->quantity);
                $lineTax =
                    (int) round(
                        ($taxShares[$line->id] * ($returned + $quantity)) / (float) $line->quantity,
                    ) - (int) round(($taxShares[$line->id] * $returned) / (float) $line->quantity);
                abort_if(
                    $lineTax > $value,
                    422,
                    "Invoice tax allocation requires accounting review.",
                );
                $serialIds = array_map("intval", $input["serial_ids"] ?? []);
                $availableSerials = Schema::hasTable("product_serials")
                    ? DB::table("product_serials")
                        ->where("sales_invoice_id", $invoice->id)
                        ->where("article_id", $line->article_id)
                        ->where("size_label", $line->size_label)
                        ->where("status", "sold")
                        ->lockForUpdate()
                        ->get()
                    : collect();
                abort_if(
                    ($line->track_serials || $availableSerials->count()) &&
                        count($serialIds) !== $quantity,
                    422,
                    "Identify the serial number of each returned piece.",
                );
                foreach ($serialIds as $serialId) {
                    abort_if(
                        isset($serialSeen[$serialId]) ||
                            !$availableSerials->firstWhere("id", $serialId),
                        422,
                        "A serial is duplicated, already returned or does not belong to this invoice item.",
                    );
                    $serialSeen[$serialId] = true;
                    abort_if(
                        DB::table("warranty_claims")
                            ->where("product_serial_id", $serialId)
                            ->whereIn("status", ["open", "in_progress"])
                            ->exists(),
                        422,
                        "Resolve the open warranty claim before returning this serial.",
                    );
                }
                $prepared[] = [$line, $quantity, $condition, $value, $lineTax, $serialIds];
                $total += $value;
                $tax += $lineTax;
            }
            abort_unless(count($prepared) > 0, 422, "Choose at least one piece to return.");
            $id = DB::table("sales_returns")->insertGetId([
                "sales_invoice_id" => $invoice->id,
                "customer_id" => $invoice->customer_id,
                "return_date" => $data["return_date"],
                "reason" => trim($data["reason"]),
                "total" => $total / 100,
                "tax" => $tax / 100,
                "request_key" => $data["request_key"],
                "created_by" => $user,
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            $number = "SR-" . str_pad((string) $id, 6, "0", STR_PAD_LEFT);
            DB::table("sales_returns")
                ->where("id", $id)
                ->update(["number" => $number]);
            foreach ($prepared as [$line, $quantity, $condition, $value, $lineTax, $serialIds]) {
                $lineId = DB::table("sales_return_lines")->insertGetId([
                    "sales_return_id" => $id,
                    "sales_invoice_line_id" => $line->id,
                    "article_id" => $line->article_id,
                    "article_code" => $line->article_code,
                    "article_name" => $line->article_name,
                    "size_label" => $line->size_label,
                    "colour" => $line->colour ?? null,
                    "quantity" => $quantity,
                    "rate" => $line->rate,
                    "total" => $value / 100,
                    "tax" => $lineTax / 100,
                    "condition" => $condition,
                    "serial_ids" => json_encode($serialIds),
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
                if ($condition === "sellable") {
                    app(FinishedGoodsInventoryService::class)->receiveReturn(
                        (int) $line->article_id,
                        $line->size_label,
                        $quantity,
                        $id,
                        $lineId,
                        $data["return_date"],
                    );
                }
                foreach ($serialIds as $serialId) {
                    DB::table("product_serials")
                        ->where("id", $serialId)
                        ->update([
                            "status" =>
                                $condition === "sellable" ? "available" : "returned_damaged",
                            "sales_invoice_id" => null,
                            "warranty_starts_on" => null,
                            "warranty_ends_on" => null,
                            "updated_at" => now(),
                        ]);
                }
            }
            if ($total > 0) {
                $entries = [["account_code" => "1100", "debit" => 0, "credit" => $total / 100]];
                if ($total - $tax > 0) {
                    $entries[] = [
                        "account_code" => "4050",
                        "debit" => ($total - $tax) / 100,
                        "credit" => 0,
                    ];
                }
                if ($tax > 0) {
                    $entries[] = ["account_code" => "2300", "debit" => $tax / 100, "credit" => 0];
                }
                $journal = app(PostingService::class)->post(
                    "sales_return",
                    $id,
                    $data["return_date"],
                    "Customer return $number / invoice {$invoice->number}",
                    $entries,
                );
                DB::table("sales_returns")
                    ->where("id", $id)
                    ->update(["journal_id" => $journal]);
            }
            $credited = (float) DB::table("sales_returns")
                ->where("sales_invoice_id", $invoice->id)
                ->sum("total");
            $outstanding = max(
                0,
                round((float) $invoice->total - (float) $invoice->received_amount - $credited, 2),
            );
            DB::table("sales_invoices")
                ->where("id", $invoice->id)
                ->update([
                    "returned_amount" => $credited,
                    "outstanding" => $outstanding,
                    "status" =>
                        $outstanding <= 0
                            ? "credited"
                            : ((float) $invoice->received_amount > 0
                                ? "part_paid"
                                : "unpaid"),
                    "updated_at" => now(),
                ]);
            DB::table("audit_logs")->insert([
                "event" => "sales_return.posted",
                "entity_type" => "sales_return",
                "entity_id" => $id,
                "payload" => json_encode([
                    "user_id" => $user,
                    "invoice_id" => $invoice->id,
                    "reason" => $data["reason"],
                    "lines" => $data["lines"],
                    "credit" => $total / 100,
                ]),
                "created_at" => now(),
            ]);
            return $id;
        });
    }
}
