<?php
namespace App\Services\Reporting;

use App\Services\Accounting\AccountPolicy;
use Illuminate\Support\Facades\DB;

final class CashFlowService
{
    public function report(string $from, string $to, ?int $accountId = null): array
    {
        $accounts = DB::table("accounts")->orderBy("code")->get()->keyBy("id");
        $cashIds = $accounts->filter(fn($a) => AccountPolicy::cash($a))->keys()->all();
        $availableAccounts = $accounts->only($cashIds)->values()
            ->map(fn ($account) => ['id' => (int) $account->id, 'code' => $account->code, 'name' => $account->name])->all();
        if ($accountId !== null) {
            abort_unless(in_array($accountId, $cashIds), 422, 'Select a cash/bank account.');
            $cashIds = [$accountId];
        }
        // In an account view, suppress voucher/cancellation pairs wholly inside the
        // period. Their closing effect is zero; cross-period cancellations stay dated.
        $cancelledIds = [];
        if ($accountId !== null) {
            $pairs = DB::table('journal_entries as reversal')
                ->join('journal_entries as original', 'original.source_id', '=', 'reversal.source_id')
                ->where('reversal.source_type', 'payment_voucher_reversal')
                ->where('original.source_type', 'payment_voucher')
                ->where('reversal.status', 'posted')->where('original.status', 'posted')
                ->whereBetween('original.posting_date', [$from, $to])
                ->whereBetween('reversal.posting_date', [$from, $to])
                ->select('original.id as original_id', 'reversal.id as reversal_id')->get();
            foreach ($pairs as $pair) {
                $cancelledIds[] = (int) $pair->original_id;
                $cancelledIds[] = (int) $pair->reversal_id;
            }
        }
        $isCancelled = $cancelledIds ? 'j.id IN (' . implode(',', $cancelledIds) . ')' : '1=0';
        // A reversal of an opening balance is an opening correction, not a cash payment.
        // Keep both entries dated so reports before the reversal retain their history.
        $openingIds = DB::table('journal_entries')
            ->where('source_type', 'account_opening')
            ->orWhere(function ($query) {
                $query->where('source_type', 'journal_reversal')->whereIn('source_id',
                    DB::table('journal_entries')->select('id')->where('source_type', 'account_opening'));
            })
            ->pluck('id')->map(fn ($id) => (int) $id)->all();
        $isOpening = $openingIds ? 'j.id IN (' . implode(',', $openingIds) . ')' : '1=0';
        $balances = DB::table("journal_lines as l")
            ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
            ->where("j.status", "posted")
            ->whereIn("l.account_id", $cashIds)
            ->whereDate("j.posting_date", "<=", $to)
            ->select("l.account_id")
            ->selectRaw(
                "SUM(CASE WHEN j.posting_date < ? OR ($isOpening) THEN l.debit-l.credit ELSE 0 END) as opening",
                [$from],
            )
            ->selectRaw(
                "SUM(CASE WHEN j.posting_date >= ? AND NOT ($isOpening) AND NOT ($isCancelled) THEN l.debit ELSE 0 END) as receipts",
                [$from],
            )
            ->selectRaw(
                "SUM(CASE WHEN j.posting_date >= ? AND NOT ($isOpening) AND NOT ($isCancelled) THEN l.credit ELSE 0 END) as payments",
                [$from],
            )
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
            ->whereNotIn('j.id', $openingIds)
            ->whereNotIn('j.id', $cancelledIds)
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
            "account_id" => $accountId,
            "available_accounts" => $availableAccounts,
            "movements" => $movements,
            "transfers" => $transfers,
            "method" =>
                "Posted cash/bank movements. Internal transfers are excluded. Mixed counterpart accounts are allocated proportionally.",
        ];
    }
}
