<?php
namespace App\Http\Controllers\Api;

use App\Services\Accounting\PaymentVoucherService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PaymentVoucherController
{
    public function index()
    {
        $lines = DB::table("payment_voucher_lines as l")
            ->join("accounts as a", "a.id", "=", "l.account_id")
            ->select("l.*", "a.code as account_code", "a.name as account_name")
            ->orderBy("l.id")
            ->get()
            ->groupBy("payment_voucher_id");
        $vouchers = DB::table("payment_vouchers as v")
            ->join("accounts as a", "a.id", "=", "v.payment_account_id")
            ->leftJoin("goods_receipts as g", "g.id", "=", "v.goods_receipt_id")
            ->leftJoin("journal_entries as j", "j.id", "=", "v.journal_id")
            ->select(
                "v.*",
                "a.code as payment_account_code",
                "a.name as payment_account_name",
                "g.number as receipt_number",
                "g.supplier_invoice",
                "j.number as journal_number",
            )
            ->latest("v.id")
            ->get()
            ->map(function ($v) use ($lines) {
                $v->lines = $lines->get($v->id, collect())->values();
                return $v;
            });
        $paid = DB::table("payment_vouchers")
            ->where("status", "posted")
            ->select("goods_receipt_id", DB::raw("SUM(total) as paid"))
            ->groupBy("goods_receipt_id");
        $receipts = DB::table("goods_receipts as g")
            ->join("suppliers as s", "s.id", "=", "g.supplier_id")
            ->leftJoinSub($paid, "p", fn($join) => $join->on("p.goods_receipt_id", "=", "g.id"))
            ->where("g.status", "posted")
            ->select(
                "g.id",
                "g.number",
                "g.supplier_invoice",
                "g.received_on",
                "s.name as supplier_name",
                DB::raw("(g.total-COALESCE(p.paid,0)) as outstanding"),
            )
            ->orderByDesc("g.id")
            ->get();
        $accounts = DB::table("accounts")
            ->where("is_postable", true)
            ->orderBy("code")
            ->get()
            ->filter(fn($a) => \App\Services\Accounting\AccountPolicy::active($a));
        return response()->json([
            "vouchers" => $vouchers,
            "payment_accounts" => $accounts
                ->filter(fn($a) => \App\Services\Accounting\AccountPolicy::cash($a))
                ->values(),
            "expense_accounts" => $accounts->where("type", "expense")->values(),
            "receipts" => $receipts,
        ]);
    }
    public function store(Request $request, PaymentVoucherService $service)
    {
        $id = $service->save(
            $this->validate($request),
            null,
            $request->attributes->get("auth_user")?->id,
        );
        return response()->json(["id" => $id], 201);
    }
    public function update(Request $request, int $id, PaymentVoucherService $service)
    {
        $request->validate(["reason" => "required|string|max:500"]);
        abort_if(
            trim($request->input("reason")) === "",
            422,
            "Enter a reason for editing this voucher.",
        );
        $service->save($this->validate($request), $id, $request->attributes->get("auth_user")?->id);
        return response()->json(["id" => $id]);
    }
    public function post(Request $request, int $id, PaymentVoucherService $service)
    {
        $service->post($id, $request->attributes->get("auth_user")?->id);
        return response()->json(["id" => $id]);
    }
    public function cancel(Request $request, int $id, PaymentVoucherService $service)
    {
        $data = $request->validate([
            "reason" => "required|string|max:500",
            "date" => "required|date",
        ]);
        $service->cancel(
            $id,
            $data["reason"],
            $data["date"],
            $request->attributes->get("auth_user")?->id,
        );
        return response()->json(["id" => $id]);
    }
    private function validate(Request $request): array
    {
        $data = $request->validate([
            "kind" => "required|in:expense,supplier",
            "payee" => "required_if:kind,expense|nullable|string|max:160",
            "payment_date" => "required|date",
            "payment_method" => "required|in:cash,bank_transfer,cheque,card",
            "payment_account_id" => "required|integer|exists:accounts,id",
            "goods_receipt_id" =>
                "required_if:kind,supplier|nullable|integer|exists:goods_receipts,id",
            "reference" => "nullable|string|max:100",
            "description" => "required|string|max:500",
            "reason" => "nullable|string|max:500",
            "lines" => "required|array|min:1|max:100",
            "lines.*.account_id" => "required_if:kind,expense|nullable|integer|exists:accounts,id",
            "lines.*.description" => "required|string|max:255",
            "lines.*.amount" => [
                "required",
                "numeric",
                "gt:0",
                "max:999999999999",
                'regex:/^\d+(\.\d{1,2})?$/',
            ],
        ]);
        abort_if(
            $data["kind"] === "supplier" && count($data["lines"]) !== 1,
            422,
            "A supplier voucher must settle one supplier receipt.",
        );
        return $data;
    }
}
