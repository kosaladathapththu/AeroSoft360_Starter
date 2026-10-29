<?php

namespace App\Services\Reporting;

use App\Http\Controllers\Api\SubledgerController;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class CustomerProfileService
{
    public function profile(int $id, string $asOf): array
    {
        $customer = DB::table("customers")->find($id);
        abort_unless($customer, 404, "Customer not found.");

        $invoices = DB::table("sales_invoices as i")
            ->leftJoin("sales_representatives as r", "r.id", "=", "i.sales_rep_id")
            ->where("i.customer_id", $id)
            ->whereDate("i.invoice_date", "<=", $asOf)
            ->whereNotIn("i.status", ["void", "cancelled"])
            ->select("i.*", "r.name as salesperson")
            ->orderByDesc("i.invoice_date")
            ->orderByDesc("i.id")
            ->get();
        $payments = DB::table("customer_receipts as p")
            ->leftJoin("sales_representatives as r", "r.id", "=", "p.collector_sales_rep_id")
            ->leftJoin("accounts as a", "a.id", "=", "p.payment_account_id")
            ->where("p.customer_id", $id)
            ->where("p.status", "posted")
            ->whereDate("p.receipt_date", "<=", $asOf)
            ->select(
                "p.*",
                "r.name as collector",
                "a.code as account_code",
                "a.name as account_name",
            )
            ->orderByDesc("p.receipt_date")
            ->orderByDesc("p.id")
            ->get();

        // Use allocations and receipt dates, not today's cached received/outstanding fields.
        $allocations = DB::table("receipt_allocations as l")
            ->join("customer_receipts as p", "p.id", "=", "l.receipt_id")
            ->join("sales_invoices as i", "i.id", "=", "l.invoice_id")
            ->where("p.customer_id", $id)
            ->where("i.customer_id", $id)
            ->where("p.status", "posted")
            ->whereDate("p.receipt_date", "<=", $asOf)
            ->select(
                "l.*",
                "i.number as invoice_number",
                "i.invoice_date",
                "p.number as receipt_number",
                "p.receipt_date",
            )
            ->get();
        $paidByInvoice = $allocations
            ->groupBy("invoice_id")
            ->map(fn($rows) => $rows->sum("amount"));
        $byReceipt = $allocations->groupBy("receipt_id");
        $byInvoice = $allocations->groupBy("invoice_id");
        $invoiceLines = DB::table("sales_invoice_lines as l")
            ->join("articles as a", "a.id", "=", "l.article_id")
            ->whereIn("l.sales_invoice_id", $invoices->pluck("id"))
            ->select("l.*", "a.code as article_code", "a.name as article_name")
            ->orderBy("l.id")
            ->get()
            ->groupBy("sales_invoice_id");

        $aging = array_fill_keys(
            ["current", "days_1_30", "days_31_60", "days_61_90", "days_90_plus"],
            0,
        );
        $invoiced = 0;
        $openingDebit = 0;
        $openingCredit = 0;
        $received = 0;
        $outstanding = 0;
        $overdue = 0;
        $open = 0;
        $dueToday = 0;
        $oldest = 0;
        foreach ($invoices as $invoice) {
            $amount = (int) round((float) $invoice->total * 100);
            $paid = (int) round((float) $paidByInvoice->get($invoice->id, 0) * 100);
            $balance = max(0, $amount - $paid);
            $due =
                $invoice->due_date ?:
                Carbon::parse($invoice->invoice_date)
                    ->addDays((int) $customer->credit_days)
                    ->toDateString();
            $days = $due < $asOf ? (int) Carbon::parse($due)->diffInDays(Carbon::parse($asOf)) : 0;
            $bucket =
                $days === 0
                    ? "current"
                    : ($days <= 30
                        ? "days_1_30"
                        : ($days <= 60
                            ? "days_31_60"
                            : ($days <= 90
                                ? "days_61_90"
                                : "days_90_plus")));
            if ($invoice->is_opening_balance ?? false) $openingDebit += $amount;
            else $invoiced += $amount;
            $invoice->document_kind = ($invoice->is_opening_balance ?? false) ? 'Opening receivable' : 'Sales invoice';
            $outstanding += $balance;
            $aging[$bucket] += $balance;
            if ($balance > 0) {
                $open++;
                $oldest = max($oldest, $days);
                if ($days > 0) {
                    $overdue += $balance;
                }
                if ($due === $asOf) {
                    $dueToday += $balance;
                }
            }
            $invoice->due_date = $due;
            $invoice->received_as_of = $paid / 100;
            $invoice->outstanding_as_of = $balance / 100;
            $invoice->days_overdue = $balance > 0 ? $days : 0;
            $invoice->aging_bucket = $balance > 0 ? $bucket : "settled";
            $invoice->status_as_of =
                $balance === 0
                    ? "Settled"
                    : ($days > 0
                        ? "Overdue"
                        : ($paid > 0
                            ? "Part paid"
                            : "Unpaid"));
            $invoice->lines = $invoiceLines->get($invoice->id, collect())->values();
            $invoice->payments = $byInvoice->get($invoice->id, collect())->values();
        }
        foreach ($payments as $payment) {
            if ($payment->is_opening_balance ?? false) $openingCredit += (int) round((float)$payment->amount*100);
            else $received += (int) round((float) $payment->amount * 100);
            $payment->document_kind = ($payment->is_opening_balance ?? false) ? 'Opening customer credit' : 'Payment received';
            $payment->allocations = $byReceipt->get($payment->id, collect())->values();
            $payment->invoice_references = $payment->allocations
                ->pluck("invoice_number")
                ->unique()
                ->join(", ");
        }
        $net = $openingDebit + $invoiced - $received - $openingCredit;
        $credit = max(0, $outstanding - $net);
        $limit = (int) round((float) $customer->credit_limit * 100);
        $exposure = max(0, $net);

        $pos = DB::table("customer_pos as p")
            ->leftJoin("sales_representatives as r", "r.id", "=", "p.sales_rep_id")
            ->where("p.customer_id", $id)
            ->whereDate("p.po_date", "<=", $asOf)
            ->select("p.*", "r.name as salesperson")
            ->orderByDesc("p.po_date")
            ->get();
        $poLines = DB::table("customer_po_lines as l")
            ->join("articles as a", "a.id", "=", "l.article_id")
            ->whereIn("l.customer_po_id", $pos->pluck("id"))
            ->select("l.*", "a.code as article_code", "a.name as article_name")
            ->get()
            ->groupBy("customer_po_id");
        foreach ($pos as $po) {
            $po->lines = $poLines->get($po->id, collect())->values();
            foreach ($po->lines as $line) {
                $line->quantity = $line->pieces ?? 0;
            }
        }
        $orders = DB::table("sales_orders as s")
            ->leftJoin("customer_pos as p", "p.id", "=", "s.customer_po_id")
            ->where("s.customer_id", $id)
            ->whereDate("s.order_date", "<=", $asOf)
            ->select("s.*", "p.number as po_number", "p.customer_po_reference")
            ->orderByDesc("s.order_date")
            ->get();
        $orderLines = DB::table("sales_order_size_lines as l")
            ->join("articles as a", "a.id", "=", "l.article_id")
            ->whereIn("l.sales_order_id", $orders->pluck("id"))
            ->select("l.*", "a.code as article_code", "a.name as article_name")
            ->get()
            ->groupBy("sales_order_id");
        foreach ($orders as $order) {
            $order->lines = $orderLines->get($order->id, collect())->values();
            $order->invoices = $invoices
                ->where("sales_order_id", $order->id)
                ->map(fn($i) => ["id" => $i->id, "number" => $i->number])
                ->values();
        }
        $quotations = collect();
        if (Schema::hasTable("quotations")) {
            $quotations = DB::table("quotations")
                ->where("customer_id", $id)
                ->whereDate("quotation_date", "<=", $asOf)
                ->orderByDesc("quotation_date")
                ->get();
            foreach ($quotations as $quote) {
                $quote->lines = json_decode($quote->lines, true);
            }
        }
        $serials = collect();
        $claims = collect();
        if (Schema::hasTable("product_serials")) {
            $serials = DB::table("product_serials as p")
                ->join("articles as a", "a.id", "=", "p.article_id")
                ->join("sales_invoices as i", "i.id", "=", "p.sales_invoice_id")
                ->whereIn("p.sales_invoice_id", $invoices->pluck("id"))
                ->whereDate("p.warranty_starts_on", "<=", $asOf)
                ->select(
                    "p.*",
                    "a.code as article_code",
                    "a.name as article_name",
                    "i.number as invoice_number",
                )
                ->get();
            if (Schema::hasTable("warranty_claims")) {
                $claims = DB::table("warranty_claims as w")
                    ->join("product_serials as p", "p.id", "=", "w.product_serial_id")
                    ->whereIn("w.product_serial_id", $serials->pluck("id"))
                    ->whereDate("w.claim_date", "<=", $asOf)
                    ->select("w.*", "p.serial_number")
                    ->orderByDesc("w.claim_date")
                    ->get();
            }
        }
        $ledger = (new SubledgerController())
            ->ledger(
                Request::create("/", "GET", [
                    "kind" => "customer",
                    "id" => $id,
                    "from" => "1000-01-01",
                    "to" => $asOf,
                ]),
            )
            ->getData(true);
        return [
            "customer" => $customer,
            "as_of" => $asOf,
            "summary" => [
                "total_invoiced" => $invoiced / 100,
                "opening_receivable" => $openingDebit / 100,
                "opening_customer_credit" => $openingCredit / 100,
                "total_received" => $received / 100,
                "outstanding" => $outstanding / 100,
                "overdue" => $overdue / 100,
                "current" => ($outstanding - $overdue) / 100,
                "due_today" => $dueToday / 100,
                "open_invoices" => $open,
                "invoice_count" => $invoices->count(),
                "payment_count" => $payments->count(),
                "customer_credit" => $credit / 100,
                "net_balance" => $net / 100,
                "credit_limit" => $limit / 100,
                "credit_limit_configured" => $limit > 0,
                "available_credit" => $limit > 0 ? max(0, $limit - $exposure) / 100 : null,
                "over_credit_limit" => $limit > 0 ? max(0, $exposure - $limit) / 100 : 0,
                "oldest_overdue_days" => $oldest,
                "last_payment_date" => $payments->first()?->receipt_date,
                "last_invoice_date" => $invoices->first()?->invoice_date,
                "ledger_balance" => $ledger["closing"],
                "ledger_difference" => round((float) $ledger["closing"] - $net / 100, 2),
            ],
            "aging" => array_map(fn($cents) => $cents / 100, $aging),
            "invoices" => $invoices,
            "payments" => $payments,
            "customer_pos" => $pos,
            "sales_orders" => $orders,
            "quotations" => $quotations,
            "ledger" => $ledger,
            "serials" => $serials,
            "warranty_claims" => $claims,
            "basis" =>
                "Amounts and aging include invoices and posted customer receipts dated on or before the selected date. Aging uses invoice due dates and dated payment allocations. Document statuses, credit terms and contact details reflect current records. Customer credit is shown separately from unpaid invoices; it does not silently settle them. Supplier payables are not part of a customer account.",
        ];
    }
}
