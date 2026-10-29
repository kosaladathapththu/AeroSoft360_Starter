<?php
namespace App\Services\Accounting;

use Illuminate\Support\Facades\DB;

final class CustomerOpeningService
{
    public function create(int $customerId, array $data): void
    {
        $amount = round((float) ($data["opening_balance"] ?? 0), 2);
        if ($amount == 0) {
            return;
        }
        $date = $data["opening_date"] ?? null;
        abort_unless($date, 422, "Choose the opening balance date.");
        $offset = DB::table("accounts")
            ->where(
                "id",
                $data["opening_account_id"] ??
                    DB::table("accounts")->where("code", "3990")->value("id"),
            )
            ->first();
        abort_unless(
            $offset && $offset->type === "equity" && AccountPolicy::active($offset),
            422,
            "Choose an active, postable equity account for opening balances.",
        );
        $customer = DB::table("customers")->find($customerId);
        $debit = ($data["opening_type"] ?? "receivable") === "receivable";
        $number = "OB-" . $customer->code;
        $common = [
            "number" => $number,
            "customer_id" => $customerId,
            "sales_rep_id" => null,
            "is_opening_balance" => true,
            "created_at" => now(),
            "updated_at" => now(),
        ];
        $invoiceId = null;
        $receiptId = null;
        if ($debit) {
            $invoiceId = DB::table("sales_invoices")->insertGetId(
                $common + [
                    "sales_order_id" => null,
                    "invoice_date" => $date,
                    "due_date" => $data["opening_due_date"] ?? $date,
                    "sale_type" => "credit",
                    "status" => "unpaid",
                    "subtotal" => 0,
                    "discount" => 0,
                    "tax" => 0,
                    "total" => $amount,
                    "received_amount" => 0,
                    "outstanding" => $amount,
                ],
            );
        } else {
            $receiptId = DB::table("customer_receipts")->insertGetId(
                $common + [
                    "receipt_date" => $date,
                    "collection_type" => "regular",
                    "payment_method" => "opening_balance",
                    "reference" => "Opening customer credit",
                    "amount" => $amount,
                    "status" => "posted",
                ],
            );
        }
        $journal = app(PostingService::class)->post(
            $debit ? "sales_invoice" : "customer_receipt",
            $invoiceId ?? $receiptId,
            $date,
            "Customer opening balance / " . $customer->code,
            [
                [
                    "account_code" => "1100",
                    "debit" => $debit ? $amount : 0,
                    "credit" => $debit ? 0 : $amount,
                ],
                [
                    "account_code" => $offset->code,
                    "debit" => $debit ? 0 : $amount,
                    "credit" => $debit ? $amount : 0,
                ],
            ],
        );
        DB::table("customer_opening_balances")->insert([
            "customer_id" => $customerId,
            "amount" => $debit ? $amount : -$amount,
            "balance_date" => $date,
            "due_date" => $debit ? $data["opening_due_date"] ?? $date : null,
            "offset_account_id" => $offset->id,
            "invoice_id" => $invoiceId,
            "receipt_id" => $receiptId,
            "journal_id" => $journal,
            "created_at" => now(),
            "updated_at" => now(),
        ]);
    }
}
