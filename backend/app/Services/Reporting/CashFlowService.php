<?php
namespace App\Services\Reporting;

use App\Services\Accounting\AccountPolicy;
use Illuminate\Support\Facades\DB;

final class CashFlowService
{
    public function report(string $from, string $to): array
    {
        $accounts = DB::table("accounts")->orderBy("code")->get()->keyBy("id");
        $cashIds = $accounts->filter(fn($a) => AccountPolicy::cash($a))->keys()->all();
        $balances = DB::table("journal_lines as l")
            ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
            ->where("j.status", "posted")
            ->whereIn("l.account_id", $cashIds)
            ->whereDate("j.posting_date", "<=", $to)
            ->select("l.account_id")
            ->selectRaw(
                "SUM(CASE WHEN j.posting_date < ? OR j.source_type = 'account_opening' THEN l.debit-l.credit ELSE 0 END) as opening",
                [$from],
            )
            ->selectRaw("SUM(CASE WHEN j.posting_date >= ? AND j.source_type <> 'account_opening' THEN l.debit ELSE 0 END) as receipts", [
                $from,
            ])
            ->selectRaw("SUM(CASE WHEN j.posting_date >= ? AND j.source_type <> 'account_opening' THEN l.credit ELSE 0 END) as payments", [
                $from,
            ])
            ->selectRaw("SUM(l.debit-l.credit) as closing")
            ->groupBy("l.account_id")
            ->get()
            ->keyBy("account_id");
        $accountRows = [];
        $opening = 0;
        $closing = 0;
        foreach ($cashIds as $id) {
            $a = $accounts[$id];
            $b = $balances->get($id);
            $row = [
                "id" => $id,
                "code" => $a->code,
                "name" => $a->name,
                "opening" => round((float) ($b->opening ?? 0), 2),
                "receipts" => round((float) ($b->receipts ?? 0), 2),
                "payments" => round((float) ($b->payments ?? 0), 2),
                "closing" => round((float) ($b->closing ?? 0), 2),
            ];
            $accountRows[] = $row;
            $opening += $row["opening"];
            $closing += $row["closing"];
        }
        $cashJournals = DB::table("journal_lines")
            ->whereIn("account_id", $cashIds)
            ->select("journal_entry_id");
        $lines = DB::table("journal_lines as l")
            ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
            ->where("j.status", "posted")
            ->whereBetween("j.posting_date", [$from, $to])
            ->where('j.source_type','<>','account_opening')
            ->whereIn("j.id", $cashJournals)
            ->select(
                "l.*",
                "j.number",
                "j.posting_date",
                "j.source_type",
                "j.source_id",
                "j.description as journal_description",
            )
            ->orderBy("j.posting_date")
            ->orderBy("j.id")
            ->orderBy("l.id")
            ->get()
            ->groupBy("journal_entry_id");
        $totals = [
            "operating" => 0.0,
            "investing" => 0.0,
            "financing" => 0.0,
            "unclassified" => 0.0,
        ];
        $movements = [];
        $transfers = [];
        $inflows = 0;
        $outflows = 0;
        foreach ($lines as $journalId => $entries) {
            $head = $entries->first();
            $cash = $entries->filter(fn($l) => in_array($l->account_id, $cashIds));
            $netCents = (int) round(
                $cash->sum(fn($l) => (float) $l->debit - (float) $l->credit) * 100,
            );
            $base = [
                "journal_id" => $journalId,
                "number" => $head->number,
                "date" => $head->posting_date,
                "source_type" => $head->source_type,
                "source_id" => $head->source_id,
                "description" => $head->journal_description,
            ];
            $weightsIn = [];
            $weightsOut = [];
            foreach ($entries as $line) {
                if (in_array($line->account_id, $cashIds)) {
                    continue;
                }
                $counterCents = (int) round(((float) $line->credit - (float) $line->debit) * 100);
                if ($counterCents === 0) {
                    continue;
                }
                $account = $accounts->get($line->account_id);
                $activity = $account->cash_flow_activity ?? "unclassified";
                if (!array_key_exists($activity, $totals)) {
                    $activity = "unclassified";
                }
                if ($counterCents > 0) {
                    $weightsIn[$activity] = ($weightsIn[$activity] ?? 0) + $counterCents;
                } else {
                    $weightsOut[$activity] = ($weightsOut[$activity] ?? 0) - $counterCents;
                }
            }
            $cashDebit = (int) round($cash->sum("debit") * 100);
            $cashCredit = (int) round($cash->sum("credit") * 100);
            $inCents = min($cashDebit, array_sum($weightsIn));
            $outCents = min($cashCredit, array_sum($weightsOut));
            $transferCents = max(0, $cashDebit - array_sum($weightsIn));
            if ($transferCents > 0) {
                $transfers[] = $base + ["amount" => $transferCents / 100];
            }
            if ($inCents === 0 && $outCents === 0) {
                continue;
            }
            $parts = [];
            foreach (
                [[$weightsIn, $inCents, 1], [$weightsOut, $outCents, -1]]
                as [$weights, $centsToSplit, $sign]
            ) {
                if (!$centsToSplit) {
                    continue;
                }
                $weightTotal = array_sum($weights);
                $allocated = [];
                $fractions = [];
                foreach ($weights as $activity => $weight) {
                    $raw = ($centsToSplit * $weight) / $weightTotal;
                    $allocated[$activity] = (int) floor($raw);
                    $fractions[$activity] = $raw - floor($raw);
                }
                $remaining = $centsToSplit - array_sum($allocated);
                arsort($fractions);
                foreach (array_keys($fractions) as $activity) {
                    if ($remaining <= 0) {
                        break;
                    }
                    $allocated[$activity]++;
                    $remaining--;
                }
                foreach ($allocated as $activity => $cents) {
                    $amount = ($sign * $cents) / 100;
                    $totals[$activity] += $amount;
                    $parts[] = ["activity" => $activity, "amount" => $amount];
                }
            }
            $inflows += $inCents / 100;
            $outflows += $outCents / 100;
            $movements[] = $base + [
                "inflow" => $inCents / 100,
                "outflow" => $outCents / 100,
                "net" => $netCents / 100,
                "allocations" => $parts,
                "mixed" => count($parts) > 1,
            ];
        }
        $net = round(array_sum($totals), 2);
        foreach ($totals as &$amount) {
            $amount = round($amount, 2);
        }
        unset($amount);
        return $totals + [
            "period" => ["from" => $from, "to" => $to],
            "opening_balance" => round($opening, 2),
            "closing_balance" => round($closing, 2),
            "net_change" => $net,
            "inflows" => round($inflows, 2),
            "outflows" => round($outflows, 2),
            "reconciliation_difference" => round($opening + $net - $closing, 2),
            "accounts" => $accountRows,
            "movements" => $movements,
            "transfers" => $transfers,
            "method" =>
                "Posted cash/bank movements. Internal transfers are excluded. Mixed counterpart accounts are allocated proportionally.",
        ];
    }
}
