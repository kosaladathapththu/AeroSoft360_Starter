<?php
namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Services\Reporting\CashFlowService;

final class AccountController
{
    public function index(Request $r)
    {
        $data = $r->validate(["as_of" => "nullable|date"]);
        $date = $data["as_of"] ?? now()->timezone("Asia/Colombo")->toDateString();
        $balances = DB::table("journal_lines as l")
            ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
            ->where("j.status", "posted")
            ->whereDate("j.posting_date", "<=", $date)
            ->select(
                "l.account_id",
                DB::raw("SUM(l.debit) as debit"),
                DB::raw("SUM(l.credit) as credit"),
            )
            ->groupBy("l.account_id");
        $used = DB::table("journal_lines")->distinct()->pluck("account_id")->all();
        $rows = DB::table("accounts as a")
            ->leftJoinSub($balances, "b", fn($join) => $join->on("b.account_id", "=", "a.id"))
            ->select(
                "a.*",
                DB::raw("COALESCE(b.debit,0) as debit"),
                DB::raw("COALESCE(b.credit,0) as credit"),
            )
            ->orderBy("a.code")
            ->get()
            ->map(function ($a) use ($used) {
                $a->has_transactions = in_array($a->id, $used);
                $a->balance = round(
                    in_array($a->type, ["liability", "equity", "income"])
                        ? (float) $a->credit - (float) $a->debit
                        : (float) $a->debit - (float) $a->credit,
                    2,
                );
                return $a;
            });
        return response()->json(["as_of" => $date, "accounts" => $rows]);
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
        $data = $r->validate([
            "code" => [
                "required",
                "string",
                "max:20",
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique("accounts", "code")->ignore($id),
            ],
            "name" => "required|string|max:255",
            "type" => "required|in:asset,liability,equity,income,expense",
            "is_postable" => "required|boolean",
            "is_active" => "required|boolean",
            "is_cash_account" => "required|boolean",
            "cash_flow_activity" => "required|in:operating,investing,financing,unclassified",
            "description" => "nullable|string|max:500",
            "reason" => ($id ? "required" : "nullable") . "|string|max:500",
        ]);
        $id = DB::transaction(function () use ($id, $data, $r) {
            $old = $id ? DB::table("accounts")->lockForUpdate()->find($id) : null;
            abort_if($id && !$old, 404, "Account not found.");
            if ($id) {
                abort_if(
                    trim($data["reason"]) === "",
                    422,
                    "Enter a reason for changing the account.",
                );
                $used = DB::table("journal_lines")->where("account_id", $id)->exists();
                if ($used || $old->is_system) {
                    foreach (["code", "type", "is_postable", "is_cash_account"] as $field) {
                        $changed = in_array($field, ["is_postable", "is_cash_account"])
                            ? (bool) $old->$field !== (bool) $data[$field]
                            : $old->$field !== $data[$field];
                        abort_if(
                            $changed,
                            422,
                            "The code, type, posting role and cash/bank flag are locked for system or used accounts.",
                        );
                    }
                }
                abort_if(
                    $old->is_system && !(bool) $data["is_active"],
                    422,
                    "System accounts must stay active because transactions depend on them.",
                );
            }
            abort_if(
                (bool) $data["is_cash_account"] &&
                    ($data["type"] !== "asset" || !$data["is_postable"]),
                422,
                "A cash/bank account must be a postable asset account.",
            );
            abort_if(trim($data["name"]) === "", 422, "Enter an account name.");
            $values = $data;
            unset($values["reason"]);
            $values["name"] = trim($data["name"]);
            $values["updated_at"] = now();
            if ($id) {
                DB::table("accounts")->where("id", $id)->update($values);
            } else {
                $id = DB::table("accounts")->insertGetId(
                    $values + ["is_system" => false, "created_at" => now()],
                );
            }
            DB::table("audit_logs")->insert([
                "event" => "account." . ($old ? "updated" : "created"),
                "entity_type" => "account",
                "entity_id" => $id,
                "payload" => json_encode([
                    "user_id" => $r->attributes->get("auth_user")?->id,
                    "reason" => $data["reason"] ?? null,
                    "before" => $old,
                    "after" => $values,
                ]),
                "created_at" => now(),
            ]);
            return $id;
        });
        return response()->json(DB::table("accounts")->find($id), $r->isMethod("POST") ? 201 : 200);
    }
    public function ledger(Request $r, int $id)
    {
        $dates = $r->validate([
            "from" => "required|date",
            "to" => "required|date|after_or_equal:from",
        ]);
        $a = DB::table("accounts")->find($id);
        abort_unless($a, 404, "Account not found.");
        $query = DB::table("journal_lines as l")
            ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
            ->where("l.account_id", $id)
            ->where("j.status", "posted");
        $opening = (float) (clone $query)
            ->whereDate("j.posting_date", "<", $dates["from"])
            ->selectRaw("COALESCE(SUM(l.debit-l.credit),0) as amount")
            ->value("amount");
        $running = $opening;
        $rows = (clone $query)
            ->whereBetween("j.posting_date", [$dates["from"], $dates["to"]])
            ->select(
                "l.*",
                "j.number",
                "j.posting_date",
                "j.source_type",
                "j.description as journal_description",
            )
            ->orderBy("j.posting_date")
            ->orderBy("j.id")
            ->orderBy("l.id")
            ->get()
            ->map(function ($line) use (&$running) {
                $running = round($running + (float) $line->debit - (float) $line->credit, 2);
                $line->running_balance = $running;
                return $line;
            });
        return response()->json([
            "account" => $a,
            "period" => $dates,
            "opening" => round($opening, 2),
            "closing" => round($running, 2),
            "lines" => $rows,
            "balance_basis" => "Debit minus credit; credit balances are negative.",
        ]);
    }
    public function cashFlow(Request $r, CashFlowService $service)
    {
        $data = $r->validate([
            "from" => "required|date",
            "to" => "required|date|after_or_equal:from",
        ]);
        return response()->json($service->report($data["from"], $data["to"]));
    }
}
