<?php

namespace App\Http\Controllers\Api;

use App\Services\Accounting\AccountPolicy;
use App\Services\Accounting\PostingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PointOfSaleController
{
    public function index()
    {
        $data = (new QuotationController())->index()->getData(true);
        unset($data["quotations"]);
        $data["payment_accounts"] = DB::table("accounts")
            ->get()
            ->filter(fn($a) => AccountPolicy::active($a) && AccountPolicy::cash($a))
            ->values();
        $data["stock"] = DB::table("finished_goods_stock")->get();
        return response()->json($data);
    }

    public function checkout(
        Request $r,
        AccountingSalesController $accounting,
        SalesController $sales,
        PostingService $posting,
    ) {
        if ($r->attributes->get("auth_user")?->sales_rep_id) {
            $r->merge(["sales_rep_id" => $r->attributes->get("auth_user")->sales_rep_id]);
        }
        $d = $r->validate([
            "checkout_key" => "required|uuid",
            "customer_id" => "required|exists:customers,id",
            "sales_rep_id" => "required|exists:sales_representatives,id",
            "invoice_date" => "required|date|before_or_equal:today",
            "payment_method" => "required|in:cash,card,bank_transfer,cheque",
            "payment_account_id" => "required|exists:accounts,id",
            "reference" => "nullable|string|max:80",
            "discount" => "required|numeric|gte:0",
            "expected_total" => "required|numeric|gt:0",
            "lines" => "required|array|min:1|max:200",
            "lines.*.set_item_id" => "required|integer|distinct|exists:article_set_items,id",
            "lines.*.quantity" => "required|integer|min:1",
        ]);
        return DB::transaction(function () use ($r, $d, $accounting, $sales, $posting) {
            $hash = hash("sha256", json_encode($d));
            $old = DB::table("pos_checkouts")
                ->where("checkout_key", $d["checkout_key"])
                ->lockForUpdate()
                ->first();
            if ($old) {
                abort_if(
                    $old->payload_hash !== $hash,
                    422,
                    "Checkout reference already belongs to another sale.",
                );
                return response()->json([
                    "invoice_id" => $old->sales_invoice_id,
                    "receipt_id" => $old->customer_receipt_id,
                    "already_posted" => true,
                ]);
            }
            $cash = DB::table("accounts")->find($d["payment_account_id"]);
            abort_unless(
                $cash && AccountPolicy::active($cash) && AccountPolicy::cash($cash),
                422,
                "Choose an active cash/bank account.",
            );
            $lines = [];
            $subtotal = 0;
            foreach ($d["lines"] as $input) {
                $item = DB::table("article_set_items as i")
                    ->join("article_set_templates as s", "s.id", "=", "i.set_template_id")
                    ->join("articles as a", "a.id", "=", "s.article_id")
                    ->where("i.id", $input["set_item_id"])
                    ->where("a.status", "active")
                    ->select("i.*", "s.article_id")
                    ->first();
                abort_unless($item, 422, "An item is no longer available.");
                $subtotal += round((float) $item->unit_price * $input["quantity"], 2);
                $lines[] = [
                    "article_id" => $item->article_id,
                    "size_label" => $item->size_label,
                    "quantity" => $input["quantity"],
                    "rate" => $item->unit_price,
                ];
            }
            $total = round($subtotal - (float) $d["discount"], 2);
            abort_if(
                $total <= 0 || abs($total - (float) $d["expected_total"]) > 0.001,
                422,
                "Prices or totals changed. Refresh and review the sale before checkout.",
            );
            $id = DB::table("pos_checkouts")->insertGetId([
                "checkout_key" => $d["checkout_key"],
                "payload_hash" => $hash,
                "created_by" => $r->attributes->get("auth_user")?->id,
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            $invoiceRequest = Request::create("/", "POST", [
                "customer_id" => $d["customer_id"],
                "sales_rep_id" => $d["sales_rep_id"],
                "invoice_date" => $d["invoice_date"],
                "sale_type" => "cash",
                "discount" => $d["discount"],
                "reference" => $d["reference"] ?? "POS checkout",
                "lines" => $lines,
            ]);
            $invoiceRequest->attributes->set("auth_user", $r->attributes->get("auth_user"));
            $invoice = $accounting->manualInvoice($invoiceRequest, $posting)->getData(true);
            $receiptRequest = Request::create("/", "POST", [
                "invoice_id" => $invoice["id"],
                "collector_sales_rep_id" => $d["sales_rep_id"],
                "payment_account_id" => $d["payment_account_id"],
                "receipt_date" => $d["invoice_date"],
                "collection_type" => "final",
                "payment_method" => $d["payment_method"],
                "commission_decision" => "invoice_salesperson",
                "reference" => $d["reference"] ?? "POS checkout",
                "amount" => $invoice["total"],
            ]);
            $receiptRequest->attributes->set("auth_user", $r->attributes->get("auth_user"));
            $receipt = $accounting->receipt($receiptRequest, $sales, $posting)->getData(true)[
                "receipt"
            ];
            DB::table("pos_checkouts")
                ->where("id", $id)
                ->update([
                    "sales_invoice_id" => $invoice["id"],
                    "customer_receipt_id" => $receipt["id"],
                    "updated_at" => now(),
                ]);
            DB::table("audit_logs")->insert([
                "event" => "pos.checkout_posted",
                "entity_type" => "pos_checkout",
                "entity_id" => $id,
                "payload" => json_encode([
                    "invoice_id" => $invoice["id"],
                    "receipt_id" => $receipt["id"],
                    "user_id" => $r->attributes->get("auth_user")?->id,
                ]),
                "created_at" => now(),
            ]);
            return response()->json(
                ["invoice_id" => $invoice["id"], "receipt_id" => $receipt["id"]],
                201,
            );
        });
    }
}
