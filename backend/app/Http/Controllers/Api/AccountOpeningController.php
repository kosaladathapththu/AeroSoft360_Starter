<?php
namespace App\Http\Controllers\Api;
use App\Services\Accounting\AccountPolicy;
use App\Services\Accounting\PostingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AccountOpeningController
{
    public function store(Request $request, int $id, PostingService $posting)
    {
        $d = $request->validate([
            "amount" => "required|numeric|gt:0",
            "side" => "required|in:debit,credit",
            "balance_date" => "required|date_format:Y-m-d",
            "reason" => "required|string|max:500",
        ]);
        return DB::transaction(function () use ($id, $d, $posting) {
            $account = DB::table("accounts")->lockForUpdate()->find($id);
            abort_unless(
                $account && AccountPolicy::active($account),
                422,
                "Select an active posting account.",
            );
            abort_if(
                in_array($account->code, ["1100", "2100", "3990"]) ||
                    !in_array($account->type, ["asset", "liability", "equity"]),
                422,
                "Customer and supplier control balances must come from their own accounts. Use a balance-sheet account other than Opening Balance Equity.",
            );
            abort_if(
                trim($d["reason"]) === "",
                422,
                "Enter the source or reason for this opening balance.",
            );
            abort_if(
                DB::table("journal_entries")
                    ->where(["source_type" => "account_opening", "source_id" => $id])
                    ->exists(),
                422,
                "This account already has an opening balance. Use a reasoned correcting journal instead of posting it again.",
            );
            $first = DB::table("journal_lines as l")
                ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
                ->where("l.account_id", $id)
                ->where("j.status", "posted")
                ->min("j.posting_date");
            abort_if(
                $first && $d["balance_date"] > $first,
                422,
                "The opening date must be on or before the first posted transaction for this account.",
            );
            $amount = round((float) $d["amount"], 2);
            $debit = $d["side"] === "debit";
            $offset = DB::table("accounts")->where("code", "3990")->first();
            abort_unless(
                $offset && $offset->type === "equity" && AccountPolicy::active($offset),
                422,
                "Opening Balance Equity (3990) must be an active postable equity account.",
            );
            $journal = $posting->post(
                "account_opening",
                $id,
                $d["balance_date"],
                "Opening balance / " . $account->code . " / " . $d["reason"],
                [
                    [
                        "account_code" => $account->code,
                        "debit" => $debit ? $amount : 0,
                        "credit" => $debit ? 0 : $amount,
                    ],
                    [
                        "account_code" => "3990",
                        "debit" => $debit ? 0 : $amount,
                        "credit" => $debit ? $amount : 0,
                    ],
                ],
            );
            return response()->json(["journal_id" => $journal], 201);
        });
    }
}
