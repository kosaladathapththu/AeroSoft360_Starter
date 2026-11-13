<?php

namespace App\Services\Accounting;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class PostingService
{
    public function post(
        string $sourceType,
        int $sourceId,
        string $date,
        string $description,
        array $lines,
    ): int {
        return DB::transaction(function () use ($sourceType, $sourceId, $date, $description, $lines) {
            $existing = DB::table("journal_entries")
                ->where(["source_type" => $sourceType, "source_id" => $sourceId])
                ->value("id");
            if ($existing) {
                return (int) $existing;
            }
            $debit = round(collect($lines)->sum("debit"), 2);
            $credit = round(collect($lines)->sum("credit"), 2);
            if (!$lines || $debit <= 0 || abs($debit - $credit) > 0.001) {
                throw ValidationException::withMessages([
                    "journal" => "Journal debits and credits must balance.",
                ]);
            }
            $period = DB::table("accounting_periods")
                ->where("starts_on", "<=", $date)
                ->where("ends_on", ">=", $date)
                ->lockForUpdate()
                ->first();
            if (!$period || $period->status !== "open") {
                throw ValidationException::withMessages([
                    "posting_date" => "The accounting period is unavailable or closed.",
                ]);
            }
            // Recheck after the period lock: another request may have posted this source.
            $existing = DB::table('journal_entries')->where(['source_type' => $sourceType, 'source_id' => $sourceId])->lockForUpdate()->value('id');
            if ($existing) return (int) $existing;
            $prefix = 'JV-' . \Carbon\Carbon::parse($date)->format('ym') . '-';
            $last = DB::table('journal_entries')->where('number', 'like', $prefix . '%')->lockForUpdate()->pluck('number')
                ->reduce(function ($highest, $number) use ($prefix) {
                    $suffix = substr($number, strlen($prefix));
                    return ctype_digit($suffix) ? max($highest, (int) $suffix) : $highest;
                }, 0);
            $id = DB::table("journal_entries")->insertGetId([
                "number" => $prefix . str_pad((string) ($last + 1), 4, '0', STR_PAD_LEFT),
                "accounting_period_id" => $period->id,
                "source_type" => $sourceType,
                "source_id" => $sourceId,
                "posting_date" => $date,
                "description" => $description,
                "status" => "posted",
                "posted_at" => now(),
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            foreach ($lines as $line) {
                $account = DB::table("accounts")
                    ->where("code", $line["account_code"])
                    ->where("is_postable", true)
                    ->first();
                if (!$account || !AccountPolicy::active($account)) {
                    throw ValidationException::withMessages([
                        "journal" => "Account {$line["account_code"]} is not available for posting.",
                    ]);
                }
                DB::table("journal_lines")->insert([
                    "journal_entry_id" => $id,
                    "account_id" => $account->id,
                    "debit" => $line["debit"] ?? 0,
                    "credit" => $line["credit"] ?? 0,
                    "description" => $line["description"] ?? $description,
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
            }
            return $id;
        });
    }
}
