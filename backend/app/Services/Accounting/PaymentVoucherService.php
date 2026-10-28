<?php
namespace App\Services\Accounting;

use Illuminate\Support\Facades\DB;

final class PaymentVoucherService
{
    public function __construct(private PostingService $posting) {}

    public function save(array $data, ?int $id, ?int $user): int
    {
        return DB::transaction(function () use ($data, $id, $user) {
            if ($id) {
                $old = DB::table("payment_vouchers")->lockForUpdate()->find($id);
                abort_unless($old, 404, "Voucher not found.");
                abort_unless(
                    $old->status === "draft",
                    422,
                    "Only draft vouchers can be edited. Cancel a posted voucher with a reason instead.",
                );
            }
            $fund = DB::table("accounts")
                ->where("id", $data["payment_account_id"])
                ->where("is_postable", true)
                ->first();
            abort_unless(
                $fund && AccountPolicy::active($fund) && AccountPolicy::cash($fund),
                422,
                "Choose an active cash or bank account from the Chart of Accounts.",
            );
            $lines = $data["lines"];
            $receipt = null;
            if ($data["kind"] === "supplier") {
                $receipt = DB::table("goods_receipts as g")
                    ->join("suppliers as s", "s.id", "=", "g.supplier_id")
                    ->where("g.id", $data["goods_receipt_id"] ?? 0)
                    ->where("g.status", "posted")
                    ->select("g.*", "s.name as supplier_name")
                    ->first();
                abort_unless($receipt, 422, "Choose a posted supplier receipt.");
                abort_if(
                    $data["payment_date"] < $receipt->received_on,
                    422,
                    "Payment date cannot precede the supplier receipt.",
                );
                $payable = DB::table("accounts")
                    ->where("code", "2100")
                    ->where("is_postable", true)
                    ->first();
                abort_unless($payable, 422, "Supplier payable account 2100 is unavailable.");
                $lines = [
                    [
                        "account_id" => $payable->id,
                        "description" => "Payment against " . $receipt->number,
                        "amount" => $data["lines"][0]["amount"],
                    ],
                ];
                $data["payee"] = $receipt->supplier_name;
            }
            $total = 0;
            foreach ($lines as &$line) {
                $account = DB::table("accounts")
                    ->where("id", $line["account_id"])
                    ->where("is_postable", true)
                    ->first();
                abort_unless(
                    $account && AccountPolicy::active($account),
                    422,
                    "Choose an available account for every line.",
                );
                if (!$receipt) {
                    abort_unless(
                        $account->type === "expense",
                        422,
                        "Expense vouchers must use expense accounts. Use a supplier payment to settle a supplier receipt.",
                    );
                }
                $line["amount"] = round((float) $line["amount"], 2);
                $line["description"] = trim($line["description"]);
                abort_if(
                    $line["amount"] <= 0 || $line["description"] === "",
                    422,
                    "Each payment line needs a description and a positive amount.",
                );
                $total += $line["amount"];
            }
            unset($line);
            $values = [
                "kind" => $data["kind"],
                "payment_date" => $data["payment_date"],
                "payee" => trim($data["payee"]),
                "payment_method" => $data["payment_method"],
                "payment_account_id" => $fund->id,
                "goods_receipt_id" => $receipt?->id,
                "reference" => $data["reference"] ?? null,
                "description" => trim($data["description"]),
                "total" => round($total, 2),
                "updated_at" => now(),
            ];
            abort_if(
                $values["payee"] === "" || $values["description"] === "",
                422,
                "Enter a payee and payment purpose.",
            );
            if ($id) {
                DB::table("payment_vouchers")->where("id", $id)->update($values);
            } else {
                $id = DB::table("payment_vouchers")->insertGetId(
                    $values + ["status" => "draft", "created_by" => $user, "created_at" => now()],
                );
                DB::table("payment_vouchers")
                    ->where("id", $id)
                    ->update([
                        "number" =>
                            "PV-" .
                            str_replace("-", "", substr($data["payment_date"], 0, 7)) .
                            "-" .
                            str_pad((string) $id, 6, "0", STR_PAD_LEFT),
                    ]);
            }
            DB::table("payment_voucher_lines")->where("payment_voucher_id", $id)->delete();
            foreach ($lines as $line) {
                DB::table("payment_voucher_lines")->insert([
                    "payment_voucher_id" => $id,
                    "account_id" => $line["account_id"],
                    "description" => $line["description"],
                    "amount" => $line["amount"],
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
            }
            $this->audit($id, $user, isset($old) ? "updated" : "created", [
                "reason" => $data["reason"] ?? null,
            ]);
            return $id;
        });
    }

    public function post(int $id, ?int $user): void
    {
        DB::transaction(function () use ($id, $user) {
            $v = DB::table("payment_vouchers")->lockForUpdate()->find($id);
            abort_unless($v, 404, "Voucher not found.");
            if ($v->status === "posted") {
                return;
            }
            abort_unless($v->status === "draft", 422, "Cancelled vouchers cannot be posted.");
            $fund = DB::table("accounts")
                ->where("id", $v->payment_account_id)
                ->where("is_postable", true)
                ->lockForUpdate()
                ->first();
            abort_unless(
                $fund && AccountPolicy::active($fund) && AccountPolicy::cash($fund),
                422,
                "The selected cash or bank account is unavailable.",
            );
            if ($v->goods_receipt_id) {
                $receipt = DB::table("goods_receipts")
                    ->where("id", $v->goods_receipt_id)
                    ->lockForUpdate()
                    ->first();
                abort_unless(
                    $receipt && $receipt->status === "posted",
                    422,
                    "The supplier receipt is unavailable.",
                );
                $paid = DB::table("payment_vouchers")
                    ->where("goods_receipt_id", $receipt->id)
                    ->where("status", "posted")
                    ->sum("total");
                abort_if(
                    (float) $v->total > (float) $receipt->total - (float) $paid + 0.001,
                    422,
                    "Payment exceeds the supplier receipt balance. Refresh and reduce the amount.",
                );
            }
            $lines = DB::table("payment_voucher_lines as l")
                ->join("accounts as a", "a.id", "=", "l.account_id")
                ->where("l.payment_voucher_id", $id)
                ->select("l.*", "a.code", "a.type")
                ->get();
            abort_if(
                $lines->isEmpty() || abs((float) $lines->sum("amount") - (float) $v->total) > 0.001,
                422,
                "Voucher total does not match its lines.",
            );
            $journal = [];
            foreach ($lines as $line) {
                abort_unless(
                    $v->kind === "supplier" ? $line->code === "2100" : $line->type === "expense",
                    422,
                    "Payment accounts are invalid.",
                );
                $journal[] = [
                    "account_code" => $line->code,
                    "debit" => (float) $line->amount,
                    "credit" => 0,
                    "description" => $line->description,
                ];
            }
            $journal[] = [
                "account_code" => $fund->code,
                "debit" => 0,
                "credit" => (float) $v->total,
                "description" => "Paid to " . $v->payee,
            ];
            $journalId = $this->posting->post(
                "payment_voucher",
                $id,
                $v->payment_date,
                $v->number . " · " . $v->description,
                $journal,
            );
            DB::table("payment_vouchers")
                ->where("id", $id)
                ->update([
                    "status" => "posted",
                    "journal_id" => $journalId,
                    "posted_by" => $user,
                    "posted_at" => now(),
                    "updated_at" => now(),
                ]);
            $this->audit($id, $user, "posted", ["journal_id" => $journalId]);
        });
    }

    public function cancel(int $id, string $reason, string $date, ?int $user): void
    {
        DB::transaction(function () use ($id, $reason, $date, $user) {
            $v = DB::table("payment_vouchers")->lockForUpdate()->find($id);
            abort_unless($v, 404, "Voucher not found.");
            abort_if($v->status === "void", 422, "Voucher is already cancelled.");
            abort_if(trim($reason) === "", 422, "Enter a cancellation reason.");
            abort_if(
                $date < $v->payment_date,
                422,
                "Cancellation date cannot precede the payment date.",
            );
            $journalId = null;
            if ($v->status === "posted") {
                if ($v->goods_receipt_id) {
                    DB::table("goods_receipts")
                        ->where("id", $v->goods_receipt_id)
                        ->lockForUpdate()
                        ->first();
                }
                $original = DB::table("journal_lines as l")
                    ->join("accounts as a", "a.id", "=", "l.account_id")
                    ->where("l.journal_entry_id", $v->journal_id)
                    ->select("l.*", "a.code")
                    ->get();
                $reversed = $original
                    ->map(
                        fn($line) => [
                            "account_code" => $line->code,
                            "debit" => (float) $line->credit,
                            "credit" => (float) $line->debit,
                            "description" => "Reversal: " . $v->number,
                        ],
                    )
                    ->all();
                $journalId = $this->posting->post(
                    "payment_voucher_reversal",
                    $id,
                    $date,
                    "Cancel " . $v->number . ": " . trim($reason),
                    $reversed,
                );
            }
            DB::table("payment_vouchers")
                ->where("id", $id)
                ->update([
                    "status" => "void",
                    "void_reason" => trim($reason),
                    "void_date" => $date,
                    "voided_at" => now(),
                    "voided_by" => $user,
                    "reversal_journal_id" => $journalId,
                    "updated_at" => now(),
                ]);
            $this->audit($id, $user, "cancelled", [
                "reason" => trim($reason),
                "date" => $date,
                "journal_id" => $journalId,
            ]);
        });
    }
    private function audit(int $id, ?int $user, string $action, array $extra): void
    {
        DB::table("audit_logs")->insert([
            "event" => "payment_voucher." . $action,
            "entity_type" => "payment_voucher",
            "entity_id" => $id,
            "payload" => json_encode(["user_id" => $user] + $extra),
            "created_at" => now(),
        ]);
    }
}
