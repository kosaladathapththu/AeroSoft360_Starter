<?php

namespace App\Services\Accounting;

use Illuminate\Support\Facades\DB;

final class SalaryPaymentService
{
    public function __construct(private PostingService $posting) {}

    public function pay(array $d, ?int $user): int
    {
        return DB::transaction(function () use ($d, $user) {
            $item = DB::table("payroll_items")->lockForUpdate()->find($d["payroll_item_id"]);
            abort_unless($item, 404);
            $run = DB::table("payroll_runs")->find($item->payroll_run_id);
            abort_unless(
                $run && $run->status === "posted",
                422,
                "Post the payroll run before paying salaries.",
            );
            $old = DB::table("salary_payments")
                ->where("payroll_item_id", $item->id)
                ->where("status", "posted")
                ->first();
            if ($old) {
                return $old->id;
            }
            abort_if(
                $item->payment_status === "paid",
                422,
                "This salary was already marked paid before linked payments were introduced. It will not be charged to cash a second time.",
            );
            abort_if(
                $d["payment_date"] < $run->period_end,
                422,
                "Salary payment cannot precede the payroll posting date.",
            );
            $cash = DB::table("accounts")->find($d["payment_account_id"]);
            abort_unless(
                $cash && AccountPolicy::active($cash) && AccountPolicy::cash($cash),
                422,
                "Choose an active cash/bank account.",
            );
            $amount = round((float) $item->net_salary, 2);
            abort_if($amount <= 0, 422, "Salary payment must be positive.");
            $id = DB::table("salary_payments")->insertGetId([
                "payroll_item_id" => $item->id,
                "payment_account_id" => $cash->id,
                "payment_date" => $d["payment_date"],
                "amount" => $amount,
                "created_by" => $user,
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            $journal = $this->posting->post(
                "salary_payment",
                $id,
                $d["payment_date"],
                "Salary payment / " . $run->number . " / employee #" . $item->employee_id,
                [
                    ["account_code" => "2250", "debit" => $amount, "credit" => 0],
                    ["account_code" => $cash->code, "debit" => 0, "credit" => $amount],
                ],
            );
            DB::table("salary_payments")
                ->where("id", $id)
                ->update(["journal_id" => $journal]);
            DB::table("payroll_items")
                ->where("id", $item->id)
                ->update([
                    "payment_status" => "paid",
                    "paid_at" => $d["payment_date"],
                    "updated_at" => now(),
                ]);
            $this->audit($id, $user, "posted", ["journal_id" => $journal]);
            return $id;
        });
    }

    public function cancel(int $id, string $date, string $reason, ?int $user): void
    {
        DB::transaction(function () use ($id, $date, $reason, $user) {
            $record = DB::table("salary_payments")->find($id);
            abort_unless($record, 404);
            DB::table("payroll_items")
                ->where("id", $record->payroll_item_id)
                ->lockForUpdate()
                ->first();
            $p = DB::table("salary_payments")->lockForUpdate()->find($id);
            abort_unless($p->status === "posted", 422, "Payment already reversed.");
            abort_if(
                $date < $p->payment_date || trim($reason) === "",
                422,
                "Enter a reason and a reversal date on/after payment.",
            );
            $cash = DB::table("accounts")->find($p->payment_account_id);
            $journal = $this->posting->post(
                "salary_payment_reversal",
                $id,
                $date,
                "Reverse salary payment #" . $id . ": " . $reason,
                [
                    ["account_code" => $cash->code, "debit" => $p->amount, "credit" => 0],
                    ["account_code" => "2250", "debit" => 0, "credit" => $p->amount],
                ],
            );
            DB::table("salary_payments")
                ->where("id", $id)
                ->update([
                    "status" => "void",
                    "void_date" => $date,
                    "void_reason" => $reason,
                    "reversal_journal_id" => $journal,
                    "updated_at" => now(),
                ]);
            DB::table("payroll_items")
                ->where("id", $p->payroll_item_id)
                ->update(["payment_status" => "unpaid", "paid_at" => null, "updated_at" => now()]);
            $this->audit($id, $user, "reversed", [
                "reason" => $reason,
                "date" => $date,
                "journal_id" => $journal,
            ]);
        });
    }

    private function audit(int $id, ?int $user, string $event, array $values): void
    {
        DB::table("audit_logs")->insert([
            "event" => "salary_payment." . $event,
            "entity_type" => "salary_payment",
            "entity_id" => $id,
            "payload" => json_encode(["user_id" => $user] + $values),
            "created_at" => now(),
        ]);
    }
}
