<?php

use Illuminate\Database\Migrations\Migration;
use App\Services\Accounting\PostingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $now = now();
        DB::table("accounts")->insertOrIgnore([
            [
                "code" => "1000",
                "name" => "Cash and Bank",
                "type" => "asset",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "code" => "1100",
                "name" => "Accounts Receivable",
                "type" => "asset",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "code" => "2210",
                "name" => "Payroll Deductions Payable",
                "type" => "liability",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "code" => "2250",
                "name" => "Salaries Payable",
                "type" => "liability",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "code" => "2260",
                "name" => "Sales Commissions Payable",
                "type" => "liability",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "code" => "4000",
                "name" => "Domestic Sales",
                "type" => "income",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "code" => "5100",
                "name" => "Direct Labour",
                "type" => "expense",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
            [
                "code" => "5300",
                "name" => "Selling and Distribution",
                "type" => "expense",
                "is_postable" => true,
                "created_at" => $now,
                "updated_at" => $now,
            ],
        ]);
        DB::table("accounts")
            ->where("code", "4000")
            ->update(["type" => "income", "updated_at" => $now]);

        $posting = app(PostingService::class);
        if (Schema::hasTable("sales_invoices")) {
            DB::table("sales_invoices")
                ->where("total", ">", 0)
                ->orderBy("id")
                ->get()
                ->each(function ($invoice) use ($posting) {
                    $posting->post(
                        "sales_invoice",
                        $invoice->id,
                        $invoice->invoice_date,
                        "Customer invoice {$invoice->number}",
                        [
                            [
                                "account_code" => "1100",
                                "debit" => $invoice->total,
                                "credit" => 0,
                                "description" => "Accounts receivable",
                            ],
                            [
                                "account_code" => "4000",
                                "debit" => 0,
                                "credit" => $invoice->total,
                                "description" => "Domestic sales revenue",
                            ],
                        ],
                    );
                });
        }
        if (Schema::hasTable("customer_receipts")) {
            DB::table("customer_receipts")
                ->where("status", "posted")
                ->where("amount", ">", 0)
                ->orderBy("id")
                ->get()
                ->each(function ($receipt) use ($posting) {
                    $commission = (float) DB::table("receipt_allocations")
                        ->where("receipt_id", $receipt->id)
                        ->sum("commission_amount");
                    $lines = [
                        [
                            "account_code" => "1000",
                            "debit" => $receipt->amount,
                            "credit" => 0,
                            "description" => "Customer collection received",
                        ],
                        [
                            "account_code" => "1100",
                            "debit" => 0,
                            "credit" => $receipt->amount,
                            "description" => "Accounts receivable settled",
                        ],
                    ];
                    if ($commission > 0) {
                        $lines[] = [
                            "account_code" => "5300",
                            "debit" => $commission,
                            "credit" => 0,
                            "description" => "Sales commission expense",
                        ];
                        $lines[] = [
                            "account_code" => "2260",
                            "debit" => 0,
                            "credit" => $commission,
                            "description" => "Commission payable",
                        ];
                    }
                    $posting->post(
                        "customer_receipt",
                        $receipt->id,
                        $receipt->receipt_date,
                        "Customer receipt {$receipt->number}",
                        $lines,
                    );
                });
        }
        if (Schema::hasTable("payroll_runs")) {
            DB::table("payroll_runs")
                ->where("status", "posted")
                ->where("gross_total", ">", 0)
                ->orderBy("id")
                ->get()
                ->each(function ($run) use ($posting) {
                    $posting->post(
                        "payroll_run",
                        $run->id,
                        $run->period_end,
                        "Payroll {$run->number}",
                        [
                            [
                                "account_code" => "5100",
                                "debit" => $run->gross_total,
                                "credit" => 0,
                                "description" => "Payroll and direct labour expense",
                            ],
                            [
                                "account_code" => "2210",
                                "debit" => 0,
                                "credit" => $run->deduction_total,
                                "description" => "Payroll deductions payable",
                            ],
                            [
                                "account_code" => "2250",
                                "debit" => 0,
                                "credit" => $run->net_total,
                                "description" => "Net salaries payable",
                            ],
                        ],
                    );
                });
        }
    }

    public function down(): void
    {
        DB::table("accounts")
            ->whereIn("code", ["2210", "2250", "2260"])
            ->delete();
    }
};
