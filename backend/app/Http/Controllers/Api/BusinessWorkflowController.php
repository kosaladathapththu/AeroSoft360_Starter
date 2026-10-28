<?php

namespace App\Http\Controllers\Api;

use App\Services\Accounting\AccountPolicy;
use App\Services\Accounting\PostingService;
use App\Services\Inventory\FinishedGoodsInventoryService;
use App\Services\Procurement\PurchaseReturnService;
use App\Services\Procurement\SupplierBalance;
use App\Services\Reporting\AgingReportService;
use App\Services\Reporting\CashFlowService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class BusinessWorkflowController
{
    public function index(Request $r)
    {
        $d = $r->validate(["as_of" => "required|date"]);
        $asOf = $d["as_of"];
        $receipts = DB::table("goods_receipts as g")
            ->join("suppliers as s", "s.id", "=", "g.supplier_id")
            ->select("g.*", "s.name as supplier")
            ->orderByDesc("g.id")
            ->get();
        foreach ($receipts as $receipt) {
            $receipt->outstanding = SupplierBalance::available($receipt);
            $receipt->lines = DB::table("goods_receipt_lines as l")
                ->join("materials as m", "m.id", "=", "l.material_id")
                ->where("l.goods_receipt_id", $receipt->id)
                ->select("l.*", "m.code", "m.name")
                ->get();
            foreach ($receipt->lines as $line) {
                $line->returnable = max(
                    0,
                    (float) $line->quantity -
                        (float) DB::table("purchase_return_lines as l")
                            ->join("purchase_returns as r", "r.id", "=", "l.purchase_return_id")
                            ->where("r.status", "posted")
                            ->where("l.goods_receipt_line_id", $line->id)
                            ->sum("l.quantity"),
                );
            }
        }
        return response()->json([
            'salary_items'=>DB::table('payroll_items as p')->join('payroll_runs as r','r.id','=','p.payroll_run_id')->join('employees as e','e.id','=','p.employee_id')->select('p.*','r.number as payroll_number','r.period_end','r.status as payroll_status','e.name','e.department')->orderByDesc('r.period_end')->get()->map(function($p){$p->linked_payment=DB::table('salary_payments')->where('payroll_item_id',$p->id)->where('status','posted')->first();return $p;}),
            'expenses'=>DB::table('payment_voucher_lines as l')->join('payment_vouchers as v','v.id','=','l.payment_voucher_id')->join('accounts as a','a.id','=','l.account_id')->where('a.code','5400')->select('l.*','v.number','v.payment_date','v.payee','v.status','a.name as account')->orderByDesc('v.id')->get(),
            "receipts" => $receipts,
            "supplier_invoices" => DB::table("supplier_invoices as i")
                ->join("suppliers as s", "s.id", "=", "i.supplier_id")
                ->join("goods_receipts as g", "g.id", "=", "i.goods_receipt_id")
                ->select("i.*", "s.name as supplier", "g.number as receipt")
                ->orderByDesc("i.id")
                ->get(),
            "purchase_returns" => DB::table("purchase_returns as p")
                ->join("goods_receipts as g", "g.id", "=", "p.goods_receipt_id")
                ->join("suppliers as s", "s.id", "=", "g.supplier_id")
                ->select("p.*", "g.number as receipt", "s.name as supplier")
                ->orderByDesc("p.id")
                ->get(),
            "accounts" => DB::table("accounts")
                ->where("is_postable", true)
                ->get()
                ->filter(fn($a) => AccountPolicy::active($a))
                ->values(),
            "cash_closings" => DB::table("cash_closings as c")
                ->join("accounts as a", "a.id", "=", "c.account_id")
                ->select("c.*", "a.code", "a.name")
                ->orderByDesc("c.closing_date")
                ->get()
                ->map(function ($c) {
                    $current = $this->cashSnapshot($c->account_id, $c->closing_date);
                    $c->current_expected = $current["expected"];
                    $c->ledger_changed = abs((float) $c->expected - $current["expected"]) > 0.001;
                    return $c;
                }),
            "recurring" => DB::table("recurring_journals")
                ->orderBy("next_date")
                ->get()
                ->map(function ($t) {
                    $t->lines = json_decode($t->lines, true);
                    $t->runs = DB::table("recurring_journal_runs as r")
                        ->join("journal_entries as j", "j.id", "=", "r.journal_id")
                        ->where("r.recurring_journal_id", $t->id)
                        ->select("r.*", "j.number")
                        ->orderByDesc("r.posting_date")
                        ->get();
                    return $t;
                }),
            "payables" => (new AgingReportService())->report($asOf),
            "customers" => DB::table("customers")->orderBy("name")->get(),
            "suppliers" => DB::table("suppliers")->orderBy("name")->get(),
            "terms" => DB::table("catalog_terms")->orderBy("kind")->orderBy("name")->get(),
            "articles" => DB::table("articles")->orderBy("code")->get(),
            "materials" => DB::table("materials")->orderBy("code")->get(),
            "items" => DB::table("article_set_items as i")
                ->join("article_set_templates as s", "s.id", "=", "i.set_template_id")
                ->join("articles as a", "a.id", "=", "s.article_id")
                ->select("i.*", "s.article_id", "a.code", "a.name")
                ->orderBy("a.code")
                ->get(),
            "as_of" => $asOf,
        ]);
    }

    public function supplierInvoice(Request $r)
    {
        $d = $r->validate([
            "goods_receipt_id" => "required|exists:goods_receipts,id",
            "invoice_number" => "required|string|max:80",
            "invoice_date" => "required|date",
            "due_date" => "required|date|after_or_equal:invoice_date",
            "notes" => "nullable|string|max:1000",
        ]);
        return DB::transaction(function () use ($r, $d) {
            $g = DB::table("goods_receipts")->lockForUpdate()->find($d["goods_receipt_id"]);
            abort_unless($g->status === "posted", 422, "Choose a posted goods receipt.");
            abort_if(trim($d["invoice_number"]) === "", 422, "Enter the supplier invoice number.");
            abort_if(
                DB::table("supplier_invoices")->where("goods_receipt_id", $g->id)->exists(),
                422,
                "This receipt already has a registered supplier invoice.",
            );
            abort_if(
                DB::table("supplier_invoices")
                    ->where("supplier_id", $g->supplier_id)
                    ->where("invoice_number", trim($d["invoice_number"]))
                    ->exists(),
                422,
                "This supplier invoice number is already registered.",
            );
            $d["invoice_number"] = trim($d["invoice_number"]);
            $id = DB::table("supplier_invoices")->insertGetId(
                $d + [
                    "supplier_id" => $g->supplier_id,
                    "total" => $g->total,
                    "created_by" => $r->attributes->get("auth_user")?->id,
                    "created_at" => now(),
                    "updated_at" => now(),
                ],
            );
            DB::table("goods_receipts")
                ->where("id", $g->id)
                ->update(["supplier_invoice" => $d["invoice_number"], "updated_at" => now()]);
            $this->audit($r, "supplier_invoice.registered", "supplier_invoice", $id, [
                "goods_receipt_id" => $g->id,
            ]);
            // GRN already debited inventory and credited 2100. Registration adds the supplier reference/terms only.
            return response()->json(["id" => $id], 201);
        });
    }

    public function salaryPayment(Request $r,\App\Services\Accounting\SalaryPaymentService $service)
    {
        $d=$r->validate(['payroll_item_id'=>'required|exists:payroll_items,id','payment_account_id'=>'required|exists:accounts,id','payment_date'=>'required|date']);return response()->json(['id'=>$service->pay($d,$r->attributes->get('auth_user')?->id)],201);
    }

    public function reverseSalary(Request $r,int $id,\App\Services\Accounting\SalaryPaymentService $service)
    {
        $d=$r->validate(['void_date'=>'required|date','reason'=>'required|string|max:500']);$service->cancel($id,$d['void_date'],$d['reason'],$r->attributes->get('auth_user')?->id);return response()->json(['ok'=>true]);
    }

    public function purchaseReturn(Request $r, PurchaseReturnService $service)
    {
        $d = $r->validate([
            "goods_receipt_id" => "required|exists:goods_receipts,id",
            "return_date" => "required|date",
            "reason" => "required|string|max:500",
            "lines" => "required|array|min:1|max:200",
            "lines.*.goods_receipt_line_id" => "required|integer",
            "lines.*.quantity" => "required|numeric|gt:0",
        ]);
        return response()->json(
            ["id" => $service->post($d, $r->attributes->get("auth_user")?->id)],
            201,
        );
    }

    public function cashPreview(Request $r)
    {
        $d = $r->validate([
            "account_id" => "required|exists:accounts,id",
            "closing_date" => "required|date",
        ]);
        return response()->json($this->cashSnapshot($d["account_id"], $d["closing_date"]));
    }

    public function cancelReturn(Request $r, int $id, PurchaseReturnService $service)
    {
        $d = $r->validate(["void_date" => "required|date", "reason" => "required|string|max:500"]);
        $service->cancel($id, $d["void_date"], $d["reason"], $r->attributes->get("auth_user")?->id);
        return response()->json(["ok" => true]);
    }

    private function cashSnapshot(int $account, string $date): array
    {
        $a = DB::table("accounts")->find($account);
        abort_unless($a && AccountPolicy::cash($a), 422, "Select a cash/bank account.");
        $row = collect((new CashFlowService())->report($date, $date)["accounts"])->firstWhere(
            "id",
            $account,
        );
        return [
            "opening" => $row["opening"],
            "receipts" => $row["receipts"],
            "payments" => $row["payments"],
            "expected" => $row["closing"],
        ];
    }

    public function closeCash(Request $r)
    {
        $d = $r->validate([
            "account_id" => "required|exists:accounts,id",
            "closing_date" => "required|date|before_or_equal:today",
            "counted" => "required|numeric|gte:0",
            "notes" => "nullable|string|max:500",
        ]);
        return DB::transaction(function () use ($d, $r) {
            $a = DB::table("accounts")->lockForUpdate()->find($d["account_id"]);
            abort_unless(AccountPolicy::active($a), 422, "Account is inactive.");
            $old = DB::table("cash_closings")
                ->where("account_id", $a->id)
                ->where("closing_date", $d["closing_date"])
                ->lockForUpdate()
                ->first();
            abort_if(
                $old && $old->status === "closed",
                422,
                "This cash account/day is already closed. Reopen it with a reason first.",
            );
            $snapshot = $this->cashSnapshot($a->id, $d["closing_date"]);
            $difference = round((float) $d["counted"] - $snapshot["expected"], 2);
            abort_if(
                abs($difference) > 0.001 && trim($d["notes"] ?? "") === "",
                422,
                "Explain the cash count difference.",
            );
            $values = $d +
                $snapshot + [
                    "difference" => $difference,
                    "status" => "closed",
                    "closed_by" => $r->attributes->get("auth_user")?->id,
                    "updated_at" => now(),
                ];
            if ($old) {
                $id = $old->id;
                DB::table("cash_closings")->where("id", $id)->update($values);
            } else {
                $id = DB::table("cash_closings")->insertGetId($values + ["created_at" => now()]);
            }
            $this->audit($r, "cash_closing.closed", "cash_closing", $id, [
                "before" => $old,
                "snapshot" => $values,
            ]);
            return response()->json(["id" => $id]);
        });
    }

    public function reopenCash(Request $r, int $id)
    {
        $d = $r->validate(["reason" => "required|string|max:500"]);
        abort_if(trim($d["reason"]) === "", 422, "Enter a reopening reason.");
        return DB::transaction(function () use ($r, $d, $id) {
            $old = DB::table("cash_closings")->lockForUpdate()->find($id);
            abort_unless($old, 404);
            abort_unless($old->status === "closed", 422, "Closing is already reopened.");
            DB::table("cash_closings")
                ->where("id", $id)
                ->update(["status" => "reopened", "updated_at" => now()]);
            $this->audit($r, "cash_closing.reopened", "cash_closing", $id, $d);
            return response()->json(["ok" => true]);
        });
    }

    public function recurring(Request $r, PostingService $posting)
    {
        $d = $r->validate([
            "description" => "required|string|max:255",
            "starts_on" => "required|date",
            "interval_months" => "required|integer|in:1,3,12",
            "lines" => "required|array|min:2|max:100",
            "lines.*.account_code" => "required|exists:accounts,code",
            "lines.*.debit" => "required|numeric|gte:0",
            "lines.*.credit" => "required|numeric|gte:0",
        ]);
        $this->validateJournal($d["lines"]);
        $id = DB::table("recurring_journals")->insertGetId([
            "description" => $d["description"],
            "starts_on" => $d["starts_on"],
            "next_date" => $d["starts_on"],
            "interval_months" => $d["interval_months"],
            "lines" => json_encode($d["lines"]),
            "created_at" => now(),
            "updated_at" => now(),
        ]);
        $this->audit($r, "recurring_journal.created", "recurring_journal", $id, $d);
        return response()->json(["id" => $id], 201);
    }

    private function validateJournal(array $lines): void
    {
        $debit = 0;
        $credit = 0;
        foreach ($lines as $l) {
            $a = DB::table("accounts")->where("code", $l["account_code"])->first();
            abort_unless($a && AccountPolicy::active($a), 422, "Select active posting accounts.");
            abort_if(
                ($l["debit"] > 0 && $l["credit"] > 0) || ($l["debit"] == 0 && $l["credit"] == 0),
                422,
                "Each journal line must have either a debit or a credit.",
            );
            $debit += round($l["debit"], 2);
            $credit += round($l["credit"], 2);
        }
        abort_if(
            $debit <= 0 || abs($debit - $credit) > 0.001,
            422,
            "Journal debits and credits must balance.",
        );
    }

    public function runRecurring(Request $r, int $id, PostingService $posting)
    {
        $d = $r->validate(["posting_date" => "required|date|before_or_equal:today"]);
        return DB::transaction(function () use ($r, $d, $id, $posting) {
            $t = DB::table("recurring_journals")->lockForUpdate()->find($id);
            abort_unless($t, 404);
            $old = DB::table("recurring_journal_runs")
                ->where("recurring_journal_id", $id)
                ->where("posting_date", $d["posting_date"])
                ->first();
            if ($old) {
                return response()->json(["journal_id" => $old->journal_id]);
            }
            abort_unless(
                $t->status === "active" && $t->next_date === $d["posting_date"],
                422,
                "Post the active template on its next due date.",
            );
            $lines = json_decode($t->lines, true);
            $this->validateJournal($lines);
            $run = DB::table("recurring_journal_runs")->insertGetId([
                "recurring_journal_id" => $id,
                "posting_date" => $d["posting_date"],
                "posted_by" => $r->attributes->get("auth_user")?->id,
            ]);
            $journal = $posting->post(
                "recurring_journal_run",
                $run,
                $d["posting_date"],
                $t->description,
                $lines,
            );
            DB::table("recurring_journal_runs")
                ->where("id", $run)
                ->update(["journal_id" => $journal]);
            $next = Carbon::parse($t->next_date)->startOfMonth()->addMonths($t->interval_months);
            $next->day(min(Carbon::parse($t->starts_on)->day, $next->daysInMonth));
            DB::table("recurring_journals")
                ->where("id", $id)
                ->update(["next_date" => $next->toDateString(), "updated_at" => now()]);
            $this->audit($r, "recurring_journal.posted", "recurring_journal", $id, [
                "run_id" => $run,
                "journal_id" => $journal,
            ]);
            return response()->json(["journal_id" => $journal]);
        });
    }

    public function stopRecurring(Request $r, int $id)
    {
        $d = $r->validate(["reason" => "required|string|max:500"]);
        abort_if(trim($d["reason"]) === "", 422, "Enter a reason.");
        abort_unless(DB::table("recurring_journals")->where("id", $id)->exists(), 404);
        DB::table("recurring_journals")
            ->where("id", $id)
            ->update(["status" => "stopped", "updated_at" => now()]);
        $this->audit($r, "recurring_journal.stopped", "recurring_journal", $id, $d);
        return response()->json(["ok" => true]);
    }

    public function bulkStock(Request $r, PostingService $posting)
    {
        $d = $r->validate([
            "import_key" => "required|uuid",
            "adjustment_date" => "required|date",
            "reason" => "required|string|max:255",
            "rows" => "required|array|min:1|max:500",
            "rows.*.kind" => "required|in:raw,finished",
            "rows.*.code" => "required|string|max:40",
            "rows.*.batch_number" => "nullable|string|max:80",
            "rows.*.size_label" => "nullable|string|max:30",
            "rows.*.quantity" => "required|numeric|gt:0",
            "rows.*.unit_cost" => "nullable|numeric|gt:0",
        ]);
        abort_if(trim($d["reason"]) === "", 422, "Enter the import reason.");
        return DB::transaction(function () use ($d, $r, $posting) {
            $hash = hash("sha256", json_encode($d));
            $old = DB::table("stock_import_batches")
                ->where("import_key", $d["import_key"])
                ->lockForUpdate()
                ->first();
            if ($old) {
                abort_if(
                    $old->payload_hash !== $hash,
                    422,
                    "This import reference was already used for different data. Upload a new file.",
                );
                return response()->json(["imported" => $old->rows, "already_imported" => true]);
            }
            DB::table("stock_import_batches")->insert([
                "import_key" => $d["import_key"],
                "payload_hash" => $hash,
                "rows" => count($d["rows"]),
                "created_at" => now(),
            ]);
            foreach ($d["rows"] as $index => $row) {
                if ($row["kind"] === "raw") {
                    $material = DB::table("materials")
                        ->where("code", $row["code"])
                        ->where("active", true)
                        ->first();
                    abort_unless(
                        $material,
                        422,
                        "Row " . ($index + 1) . ": unknown/inactive raw material.",
                    );
                    $input = Request::create("/", "POST", [
                        "material_id" => $material->id,
                        "batch_number" => $row["batch_number"] ?? "",
                        "adjustment_date" => $d["adjustment_date"],
                        "adjustment_type" => "increase",
                        "quantity" => $row["quantity"],
                        "unit_cost" => $row["unit_cost"] ?? 0,
                        "reason" => $d["reason"],
                    ]);
                    (new StockAdjustmentController())->store($input, $posting);
                } else {
                    $article = DB::table("articles")
                        ->where("code", $row["code"])
                        ->where("status", "active")
                        ->first();
                    abort_unless(
                        $article,
                        422,
                        "Row " . ($index + 1) . ": unknown/inactive article.",
                    );
                    (new FinishedGoodsInventoryService())->adjust(
                        $article->id,
                        $row["size_label"] ?? "",
                        (float) $row["quantity"],
                        "increase",
                        $d["adjustment_date"],
                    );
                }
            }
            $this->audit($r, "stock.bulk_imported", "stock_import", 0, [
                "reason" => $d["reason"],
                "date" => $d["adjustment_date"],
                "rows" => $d["rows"],
            ]);
            return response()->json(["imported" => count($d["rows"])], 201);
        });
    }

    public function term(Request $r)
    {
        $d = $r->validate([
            "kind" => "required|in:category,brand,unit",
            "name" => "required|string|max:80",
        ]);
        $d["name"] = trim($d["name"]);
        abort_if($d["name"] === "", 422, "Enter a name.");
        abort_if(
            $d["kind"] === "unit" && strlen($d["name"]) > 20,
            422,
            "Unit names must have at most 20 characters.",
        );
        abort_if(
            DB::table("catalog_terms")->where($d)->exists(),
            422,
            "This value already exists.",
        );
        $id = DB::table("catalog_terms")->insertGetId(
            $d + ["active" => true, "created_at" => now(), "updated_at" => now()],
        );
        $this->audit($r, "catalog.created", "catalog_term", $id, $d);
        return response()->json(["id" => $id], 201);
    }

    public function assignProduct(Request $r)
    {
        $d = $r->validate([
            "article_id" => "required|exists:articles,id",
            "track_serials" => "nullable|boolean",
            "category" => "required|string|max:80",
            "brand" => "nullable|string|max:80",
            "unit" => "required|string|max:20",
            "reason" => "required|string|max:500",
        ]);
        abort_if(trim($d["reason"]) === "", 422, "Enter a change reason.");
        foreach (["category", "brand", "unit"] as $kind) {
            if (empty($d[$kind])) {
                continue;
            }
            abort_unless(
                DB::table("catalog_terms")
                    ->where("kind", $kind)
                    ->where("name", $d[$kind])
                    ->where("active", true)
                    ->exists(),
                422,
                "Select a value from the master data list.",
            );
        }
        $old = DB::table("articles")->find($d["article_id"]);
        DB::table("articles")
            ->where("id", $old->id)
            ->update([
                "category" => $d["category"],
                "brand" => $d["brand"] ?? null,
                "track_serials" => $d["track_serials"] ?? $old->track_serials,
                "unit" => $d["unit"],
                "updated_at" => now(),
            ]);
        $this->audit($r, "product.classification_changed", "article", $old->id, [
            "before" => $old,
            "after" => $d,
        ]);
        return response()->json(["ok" => true]);
    }

    private function audit(Request $r, string $event, string $entity, int $id, array $payload): void
    {
        DB::table("audit_logs")->insert([
            "event" => $event,
            "entity_type" => $entity,
            "entity_id" => $id,
            "payload" => json_encode(
                ["user_id" => $r->attributes->get("auth_user")?->id] + $payload,
            ),
            "created_at" => now(),
        ]);
    }
}
