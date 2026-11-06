<?php

namespace App\Services\Reporting;

use App\Services\Accounting\AccountPolicy;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class DashboardService
{
    public function report(int $days = 30): array
    {
        $today = Carbon::now("Asia/Colombo")->startOfDay();
        $asOf = $today->toDateString();
        $from = $today
            ->copy()
            ->subDays($days - 1)
            ->toDateString();
        $invoices = DB::table("sales_invoices as i")
            ->join("customers as c", "c.id", "=", "i.customer_id")
            ->whereNotIn("i.status", ["void", "cancelled"])
            ->whereDate("i.invoice_date", "<=", $asOf)
            ->whereNotExists(function ($query) use ($asOf) {
                $query
                    ->selectRaw("1")
                    ->from("customer_opening_balances as o")
                    ->whereColumn("o.invoice_id", "i.id")
                    ->whereDate("o.balance_date", ">", $asOf);
            })
            ->select("i.*", "c.name as customer_name", "c.code as customer_code")
            ->get();
        $paid = DB::table("receipt_allocations as a")
            ->join("customer_receipts as r", "r.id", "=", "a.receipt_id")
            ->where("r.status", "posted")
            ->whereDate("r.receipt_date", "<=", $asOf)
            ->select("a.invoice_id")
            ->selectRaw("SUM(a.amount) as amount")
            ->groupBy("a.invoice_id")
            ->pluck("amount", "invoice_id");
        $returns = Schema::hasTable("sales_returns")
            ? DB::table("sales_returns")->whereDate("return_date", "<=", $asOf)->get()
            : collect();
        $credits = $returns->groupBy("sales_invoice_id")->map(fn($rows) => $rows->sum("total"));
        $aging = array_fill_keys(
            ["current", "1_30", "31_60", "61_90", "90_plus", "terms_not_set"],
            0.0,
        );
        $open = collect();
        foreach ($invoices as $invoice) {
            // Use dated source records, not potentially stale cached invoice balances.
            $invoice->outstanding = max(
                0,
                round(
                    (float) $invoice->total -
                        (float) $paid->get($invoice->id, 0) -
                        (float) $credits->get($invoice->id, 0),
                    2,
                ),
            );
            if ($invoice->outstanding <= 0) {
                continue;
            }
            $overdue = $invoice->due_date
                ? max(0, Carbon::parse($invoice->due_date)->startOfDay()->diffInDays($today, false))
                : null;
            $invoice->days_overdue = $overdue;
            $invoice->bucket =
                $overdue === null
                    ? "terms_not_set"
                    : ($overdue === 0
                        ? "current"
                        : ($overdue <= 30
                            ? "1_30"
                            : ($overdue <= 60
                                ? "31_60"
                                : ($overdue <= 90
                                    ? "61_90"
                                    : "90_plus"))));
            $aging[$invoice->bucket] += $invoice->outstanding;
            $open->push($invoice);
        }
        $periodInvoices = $invoices->filter(
            fn($i) => !$i->is_opening_balance && $i->invoice_date >= $from,
        );
        $receipts = DB::table("customer_receipts as r")
            ->join("customers as c", "c.id", "=", "r.customer_id")
            ->where("r.status", "posted")
            ->where("r.is_opening_balance", false)
            ->whereBetween("r.receipt_date", [$from, $asOf])
            ->select(
                "r.id",
                "r.number",
                "r.receipt_date",
                "r.amount",
                "c.name as customer_name",
                "c.code as customer_code",
            )
            ->get();
        $trend = [];
        $salesByDate = $periodInvoices
            ->groupBy("invoice_date")
            ->map(fn($rows) => $rows->sum("total"));
        $cashByDate = $receipts->groupBy("receipt_date")->map(fn($rows) => $rows->sum("amount"));
        for ($date = Carbon::parse($from); $date->toDateString() <= $asOf; $date->addDay()) {
            $key = $date->toDateString();
            $trend[] = [
                "date" => $key,
                "sales" => round((float) $salesByDate->get($key, 0), 2),
                "collections" => round((float) $cashByDate->get($key, 0), 2),
            ];
        }
        $topCustomers = $open
            ->groupBy("customer_id")
            ->map(function ($rows) {
                $first = $rows->first();
                return [
                    "id" => $first->customer_id,
                    "code" => $first->customer_code,
                    "customer" => $first->customer_name,
                    "outstanding" => round((float) $rows->sum("outstanding"), 2),
                    "invoices" => $rows->count(),
                    "overdue" => round(
                        (float) $rows
                            ->filter(fn($r) => ($r->days_overdue ?? 0) > 0)
                            ->sum("outstanding"),
                        2,
                    ),
                ];
            })
            ->sortByDesc("outstanding")
            ->take(5)
            ->values();
        $dispatchLines = DB::table("sales_order_size_lines as l")
            ->join("sales_orders as s", "s.id", "=", "l.sales_order_id")
            ->whereIn("s.status", ["confirmed", "part_invoiced"])
            ->whereDate("s.order_date", "<=", $asOf)
            ->whereColumn("l.quantity", ">", "l.invoiced_quantity")
            ->select("l.sales_order_id")
            ->selectRaw("SUM(l.quantity-l.invoiced_quantity) as pieces")
            ->groupBy("l.sales_order_id")
            ->get();
        $cashIds = DB::table("accounts")
            ->get()
            ->filter(fn($a) => AccountPolicy::cash($a) && $a->is_postable)
            ->pluck("id");
        $cash = DB::table("journal_lines as l")
            ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
            ->where("j.status", "posted")
            ->whereDate("j.posting_date", "<=", $asOf)
            ->whereIn("l.account_id", $cashIds)
            ->selectRaw("COALESCE(SUM(l.debit-l.credit),0) as balance")
            ->value("balance");
        $payables = (new AgingReportService())->report($asOf);
        $orders = DB::table("purchase_orders")->whereDate("order_date", "<=", $asOf)->get();
        $unbilled = DB::table("goods_receipts as g")
            ->where("g.status", "posted")
            ->whereDate("g.received_on", "<=", $asOf)
            ->whereNotExists(
                fn($q) => $q
                    ->selectRaw("1")
                    ->from("supplier_invoices as i")
                    ->whereColumn("i.goods_receipt_id", "g.id")
                    ->whereDate("i.invoice_date", "<=", $asOf),
            )
            ->count();
        $stock = $this->stock();
        return [
            "period" => ["days" => $days, "from" => $from, "to" => $asOf],
            "as_of" => $asOf,
            "generated_at" => Carbon::now("Asia/Colombo")->toIso8601String(),
            "customers_count" => DB::table("customers")->where("status", "active")->count(),
            "open_invoices_count" => $open->count(),
            "outstanding_total" => round((float) $open->sum("outstanding"), 2),
            "opening_receivables_total" => round(
                (float) $open->where("is_opening_balance", true)->sum("outstanding"),
                2,
            ),
            "sales_receivables_total" => round(
                (float) $open->where("is_opening_balance", false)->sum("outstanding"),
                2,
            ),
            "overdue_total" => round(
                (float) $open->filter(fn($i) => ($i->days_overdue ?? 0) > 0)->sum("outstanding"),
                2,
            ),
            "overdue_count" => $open->filter(fn($i) => ($i->days_overdue ?? 0) > 0)->count(),
            "terms_missing_count" => $open->where("bucket", "terms_not_set")->count(),
            "collections_total" => round((float) $receipts->sum("amount"), 2),
            "period_sales" => round((float) $periodInvoices->sum("total"), 2),
            "period_invoice_count" => $periodInvoices->count(),
            "period_return_credits" => round(
                (float) $returns->filter(fn($r) => $r->return_date >= $from)->sum("total"),
                2,
            ),
            "cash_balance" => round((float) $cash, 2),
            "dispatch_count" => $dispatchLines->count(),
            "dispatch_pieces" => (int) $dispatchLines->sum("pieces"),
            "draft_purchase_orders" => $orders->where("status", "draft")->count(),
            "awaiting_goods" => $orders->whereIn("status", ["approved", "part_received"])->count(),
            "unbilled_receipts" => $unbilled,
            "supplier_payables" => round((float) $payables["totals"]["total"], 2),
            "supplier_overdue_count" => collect($payables["rows"])
                ->where("days_overdue", ">", 0)
                ->count(),
            "stock" => $stock,
            "aging" => array_map(fn($v) => round($v, 2), $aging),
            "trend" => $trend,
            "top_customers" => $topCustomers,
            "recent_invoices" => $periodInvoices->sortByDesc("invoice_date")->take(8)->values(),
            "recent_receipts" => $receipts->sortByDesc("receipt_date")->take(8)->values(),
        ];
    }

    private function stock(): array
    {
        $variants = DB::table("article_set_items as i")
            ->join("article_set_templates as t", "t.id", "=", "i.set_template_id")
            ->join("articles as a", "a.id", "=", "t.article_id")
            ->where("a.status", "active")
            ->where("t.status", "active")
            ->select("a.id as article_id", "a.code", "a.name", "i.size_label")
            ->distinct()
            ->get();
        $balances = DB::table("finished_goods_stock")
            ->get()
            ->keyBy(fn($s) => $s->article_id . ":" . $s->size_label);
        $low = 0;
        $out = 0;
        $unrecorded = 0;
        $pieces = 0;
        foreach ($variants as $variant) {
            $record = $balances->get($variant->article_id . ":" . $variant->size_label);
            if (!$record) {
                $unrecorded++;
                continue;
            }
            $quantity = (float) $record->quantity;
            $pieces += $quantity;
            if ($quantity <= 0) {
                $out++;
            } elseif ($quantity <= 5) {
                $low++;
            }
        }
        return [
            "pieces" => $pieces,
            "low" => $low,
            "out" => $out,
            "unrecorded" => $unrecorded,
            "threshold" => 5,
            "variants" => $variants->count(),
        ];
    }
}
