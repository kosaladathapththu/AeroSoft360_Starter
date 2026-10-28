<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class QuotationController
{
    public function index()
    {
        return response()->json([
            "quotations" => DB::table("quotations as q")
                ->join("customers as c", "c.id", "=", "q.customer_id")
                ->leftJoin("sales_orders as so", "so.id", "=", "q.sales_order_id")
                ->select("q.*", "c.name as customer", "so.number as sales_order")
                ->orderByDesc("q.id")
                ->get()
                ->map(function ($q) {
                    $q->lines = json_decode($q->lines, true);
                    return $q;
                }),
            "customers" => DB::table("customers")
                ->where("status", "active")
                ->orderBy("name")
                ->get(),
            "reps" => DB::table("sales_representatives")
                ->where("status", "active")
                ->orderBy("name")
                ->get(),
            "items" => DB::table("article_set_items as i")
                ->join("article_set_templates as s", "s.id", "=", "i.set_template_id")
                ->join("articles as a", "a.id", "=", "s.article_id")
                ->where("a.status", "active")
                ->select("i.*", "s.article_id", "a.code", "a.name")
                ->orderBy("a.code")
                ->orderBy("i.sort_order")
                ->get(),
        ]);
    }

    public function store(Request $r)
    {
        return $this->save($r, null);
    }
    public function update(Request $r, int $id)
    {
        return $this->save($r, $id);
    }

    private function save(Request $r, ?int $id)
    {
        if ($r->attributes->get("auth_user")?->sales_rep_id) {
            $r->merge(["sales_rep_id" => $r->attributes->get("auth_user")->sales_rep_id]);
        }
        $d = $r->validate([
            "customer_id" => "required|exists:customers,id",
            "sales_rep_id" => "required|exists:sales_representatives,id",
            "quotation_date" => "required|date",
            "valid_until" => "required|date|after_or_equal:quotation_date",
            "sale_type" => "required|in:cash,credit",
            "notes" => "nullable|string|max:2000",
            "reason" => ($id ? "required" : "nullable") . "|string|max:500",
            "lines" => "required|array|min:1|max:200",
            "lines.*.set_item_id" => "required|integer|exists:article_set_items,id",
            "lines.*.quantity" => "required|numeric|gt:0",
            "lines.*.rate" => "required|numeric|gte:0",
            "lines.*.colour" => "nullable|string|max:80",
        ]);
        return DB::transaction(function () use ($r, $d, $id) {
            $old = $id ? DB::table("quotations")->lockForUpdate()->find($id) : null;
            abort_if($id && !$old, 404, "Quotation not found.");
            abort_if($old && $old->status !== "open", 422, "Only open quotations can be edited.");
            abort_if($id && trim($d["reason"]) === "", 422, "Enter a change reason.");
            $lines = [];
            $total = 0;
            foreach ($d["lines"] as $line) {
                $item = DB::table("article_set_items as i")
                    ->join("article_set_templates as s", "s.id", "=", "i.set_template_id")
                    ->join("articles as a", "a.id", "=", "s.article_id")
                    ->where("i.id", $line["set_item_id"])
                    ->where("a.status", "active")
                    ->select("i.*", "s.article_id", "a.code", "a.name")
                    ->first();
                abort_unless($item, 422, "Select an active product size.");
                $rate = round((float) $line["rate"], 2);
                $amount = round($rate * (float) $line["quantity"], 2);
                $total += $amount;
                $lines[] = [
                    "set_item_id" => $item->id,
                    "set_template_id" => $item->set_template_id,
                    "article_id" => $item->article_id,
                    "code" => $item->code,
                    "name" => $item->name,
                    "size_label" => $item->size_label,
                    "colour" => $line["colour"] ?? null,
                    "quantity" => $line["quantity"],
                    "rate" => $rate,
                    "total" => $amount,
                ];
            }
            abort_if($total <= 0, 422, "The quotation total must be positive.");
            $values = collect($d)
                ->except(["reason", "lines"])
                ->all() + [
                "lines" => json_encode($lines),
                "total" => $total,
                "updated_at" => now(),
            ];
            if ($id) {
                DB::table("quotations")->where("id", $id)->update($values);
            } else {
                $id = DB::table("quotations")->insertGetId(
                    $values + [
                        "created_at" => now(),
                        "created_by" => $r->attributes->get("auth_user")?->id,
                    ],
                );
                DB::table("quotations")
                    ->where("id", $id)
                    ->update(["number" => "QT-" . str_pad((string) $id, 6, "0", STR_PAD_LEFT)]);
            }
            $this->audit($id, $r, $old ? "updated" : "created", $d["reason"] ?? null);
            return response()->json(["id" => $id], $old ? 200 : 201);
        });
    }

    public function convert(Request $r, int $id)
    {
        $d = $r->validate(["order_date" => "required|date"]);
        return DB::transaction(function () use ($r, $id, $d) {
            $q = DB::table("quotations")->lockForUpdate()->find($id);
            abort_unless($q, 404, "Quotation not found.");
            if ($q->sales_order_id) {
                return response()->json(["sales_order_id" => $q->sales_order_id]);
            }
            abort_unless($q->status === "open", 422, "Quotation is not open.");
            abort_if(
                $d["order_date"] < $q->quotation_date || $d["order_date"] > $q->valid_until,
                422,
                "Order date must be within the quotation validity period.",
            );
            $rep = $r->attributes->get("auth_user")?->sales_rep_id;
            abort_if(
                $rep && $rep != $q->sales_rep_id,
                403,
                "This quotation belongs to another salesperson.",
            );
            $po = DB::table("customer_pos")->insertGetId([
                "number" => "CPO-" . $q->number,
                "customer_id" => $q->customer_id,
                "sales_rep_id" => $q->sales_rep_id,
                "customer_po_reference" => $q->number,
                "po_date" => $d["order_date"],
                "sale_type" => $q->sale_type,
                "status" => "ordered",
                "total" => $q->total,
                "cash_amount" => $q->sale_type === "cash" ? $q->total : 0,
                "credit_amount" => $q->sale_type === "credit" ? $q->total : 0,
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            $so = DB::table("sales_orders")->insertGetId([
                "number" => "SO-" . $q->number,
                "customer_po_id" => $po,
                "customer_id" => $q->customer_id,
                "sales_rep_id" => $q->sales_rep_id,
                "order_date" => $d["order_date"],
                "status" => "confirmed",
                "total" => $q->total,
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            foreach (json_decode($q->lines, true) as $line) {
                $item = DB::table("article_set_items")->find($line["set_item_id"]);
                abort_unless(
                    $item &&
                        $item->size_label === $line["size_label"] &&
                        $item->set_template_id == $line["set_template_id"],
                    422,
                    "A quoted product size has changed. Revise the quotation before conversion.",
                );
                DB::table("customer_po_lines")->insert([
                    "customer_po_id" => $po,
                    "article_id" => $line["article_id"],
                    "colour" => $line["colour"],
                    "order_mode" => "size",
                    "set_template_id" => $line["set_template_id"],
                    "set_item_id" => $line["set_item_id"],
                    "sets" => 0,
                    "pieces" => $line["quantity"],
                    "rate" => $line["rate"],
                    "line_total" => $line["total"],
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
                DB::table("sales_order_size_lines")->insert([
                    "sales_order_id" => $so,
                    "article_id" => $line["article_id"],
                    "size_label" => $line["size_label"],
                    "colour" => $line["colour"],
                    "quantity" => $line["quantity"],
                    "invoiced_quantity" => 0,
                    "rate" => $line["rate"],
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
            }
            DB::table("quotations")
                ->where("id", $id)
                ->update(["status" => "converted", "sales_order_id" => $so, "updated_at" => now()]);
            $this->audit($id, $r, "converted", null, [
                "sales_order_id" => $so,
                "customer_po_id" => $po,
            ]);
            return response()->json(["sales_order_id" => $so, "customer_po_id" => $po], 201);
        });
    }

    public function cancel(Request $r, int $id)
    {
        $d = $r->validate(["reason" => "required|string|max:500"]);
        abort_if(trim($d["reason"]) === "", 422, "Enter a cancellation reason.");
        return DB::transaction(function () use ($r, $d, $id) {
            $q = DB::table("quotations")->lockForUpdate()->find($id);
            abort_unless($q, 404);
            abort_unless($q->status === "open", 422, "Only open quotations can be cancelled.");
            DB::table("quotations")
                ->where("id", $id)
                ->update(["status" => "cancelled", "updated_at" => now()]);
            $this->audit($id, $r, "cancelled", $d["reason"]);
            return response()->json(["ok" => true]);
        });
    }

    private function audit(
        int $id,
        Request $r,
        string $event,
        ?string $reason,
        array $extra = [],
    ): void {
        DB::table("audit_logs")->insert([
            "event" => "quotation." . $event,
            "entity_type" => "quotation",
            "entity_id" => $id,
            "payload" => json_encode(
                ["user_id" => $r->attributes->get("auth_user")?->id, "reason" => $reason] + $extra,
            ),
            "created_at" => now(),
        ]);
    }
}
