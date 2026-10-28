<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class SubledgerController
{
    public function ledger(Request $r)
    {
        $d = $r->validate([
            "kind" => "required|in:customer,supplier,raw,finished",
            "id" => "required|integer",
            "from" => "required|date",
            "to" => "required|date|after_or_equal:from",
            "variant" => "nullable|string|max:80",
        ]);
        if (in_array($d["kind"], ["raw", "finished"])) {
            return $this->stock($d);
        }
        $customer = $d["kind"] === "customer";
        $party = DB::table($customer ? "customers" : "suppliers")->find($d["id"]);
        abort_unless($party, 404, "Party not found.");
        $q = DB::table("journal_lines as l")
            ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
            ->join("accounts as a", "a.id", "=", "l.account_id")
            ->where("j.status", "posted")
            ->where("a.code", $customer ? "1100" : "2100")
            ->whereDate("j.posting_date", "<=", $d["to"])
            ->select(
                "l.*",
                "j.number",
                "j.posting_date",
                "j.description as journal_description",
                "j.source_type",
                "j.source_id",
            )
            ->orderBy("j.posting_date")
            ->orderBy("j.id")
            ->orderBy("l.id");
        $invoices = $customer
            ? DB::table("sales_invoices")->where("customer_id", $party->id)->get()->keyBy("id")
            : collect();
        $receipts = $customer
            ? DB::table("customer_receipts")->where("customer_id", $party->id)->get()->keyBy("id")
            : DB::table("goods_receipts")->where("supplier_id", $party->id)->get()->keyBy("id");
        $vouchers = $customer
            ? collect()
            : DB::table("payment_vouchers")
                ->whereIn("goods_receipt_id", $receipts->keys())
                ->get()
                ->keyBy("id");
        $returns = $customer
            ? collect()
            : DB::table("purchase_returns")
                ->whereIn("goods_receipt_id", $receipts->keys())
                ->get()
                ->keyBy("id");
        $opening = 0;
        $running = 0;
        $rows = [];
        foreach ($q->get() as $line) {
            $source = null;
            $page = "General Ledger";
            if ($customer && $line->source_type === "sales_invoice") {
                $source = $invoices->get($line->source_id);
                $page = "Invoices";
            }
            if ($customer && $line->source_type === "customer_receipt") {
                $source = $receipts->get($line->source_id);
                $page = "Collections";
            }
            if (!$customer && $line->source_type === "goods_receipt") {
                $source = $receipts->get($line->source_id);
                $page = "Receive Goods";
            }
            if (
                !$customer &&
                in_array($line->source_type, ["payment_voucher", "payment_voucher_reversal"])
            ) {
                $source = $vouchers->get($line->source_id);
                $page = "Payment Vouchers";
            }
            if (
                !$customer &&
                in_array($line->source_type, ["purchase_return", "purchase_return_reversal"])
            ) {
                $source = $returns->get($line->source_id);
                $page = "Purchase Returns";
            }
            if (!$source) {
                continue;
            }
            $change = ($customer ? 1 : -1) * ((float) $line->debit - (float) $line->credit);
            $running = round($running + $change, 2);
            if ($line->posting_date < $d["from"]) {
                $opening = $running;
                continue;
            }
            $rows[] = [
                "date" => $line->posting_date,
                "reference" => $source->number,
                "journal" => $line->number,
                "description" => $line->journal_description,
                "debit" => (float) $line->debit,
                "credit" => (float) $line->credit,
                "balance" => $running,
                "source_page" => $page,
                "source_id" => $source->id,
            ];
        }
        return response()->json([
            "party" => $party,
            "kind" => $d["kind"],
            "period" => ["from" => $d["from"], "to" => $d["to"]],
            "opening" => $opening,
            "closing" => $running,
            "rows" => $rows,
            "note" => $customer
                ? "Positive balance is receivable from this customer. Includes posted invoices and collections. Unassigned manual control-account journals are available in General Ledger."
                : "Positive balance is payable to this supplier. Goods receipts create the liability; registered invoices add references, not another liability. Returns, payments and payment reversals are included. Unassigned manual control-account journals are available in General Ledger.",
        ]);
    }

    private function stock(array $d)
    {
        $raw = $d["kind"] === "raw";
        $product = DB::table($raw ? "materials" : "articles")->find($d["id"]);
        abort_unless($product, 404, "Product not found.");
        $q = DB::table($raw ? "stock_movements" : "finished_goods_movements")
            ->where($raw ? "material_id" : "article_id", $d["id"])
            ->whereDate("occurred_at", "<=", $d["to"]);
        if (!empty($d["variant"])) {
            $q->where($raw ? "batch_number" : "size_label", $d["variant"]);
        }
        $running = 0;
        $opening = 0;
        $rows = [];
        foreach ($q->orderBy("occurred_at")->orderBy("id")->get() as $m) {
            $running = round($running + (float) $m->quantity, 4);
            $date = substr($m->occurred_at, 0, 10);
            if ($date < $d["from"]) {
                $opening = $running;
                continue;
            }
            $rows[] = [
                "date" => $date,
                "reference" => $m->source_type . " #" . $m->source_id,
                "variant" => $raw ? $m->batch_number : $m->size_label,
                "movement" => $m->movement_type,
                "received" => max(0, (float) $m->quantity),
                "issued" => max(0, -(float) $m->quantity),
                "balance" => $running,
                "source_id" => $m->source_id,
                "source_page" => match ($m->source_type) {
                    "goods_receipt" => "Receive Goods",
                    "purchase_return", "purchase_return_reversal" => "Purchase Returns",
                    "sales_invoice" => "Invoices",
                    default => $raw ? "Raw Material Stock" : "Finished Goods Stock",
                },
            ];
        }
        return response()->json([
            "party" => $product,
            "kind" => $d["kind"],
            "period" => ["from" => $d["from"], "to" => $d["to"]],
            "opening" => $opening,
            "closing" => $running,
            "rows" => $rows,
            "note" =>
                "Quantity ledger from stock movements. Choose a batch or size for a specific variant. Finished-goods quantities follow the existing inventory system; this page does not invent product costs.",
        ]);
    }
}
