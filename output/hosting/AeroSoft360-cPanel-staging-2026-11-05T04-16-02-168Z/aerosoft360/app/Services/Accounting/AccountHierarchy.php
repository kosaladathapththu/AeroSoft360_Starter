<?php
namespace App\Services\Accounting;
use Illuminate\Support\Facades\DB;
final class AccountHierarchy
{
    public function descendants(int $id): array
    {
        $accounts = DB::table("accounts")->get();
        $ids = [$id];
        for ($i = 0; $i < count($ids); $i++) {
            foreach ($accounts as $a) {
                if (
                    (int) ($a->parent_id ?? 0) === $ids[$i] &&
                    !in_array((int) $a->id, $ids, true)
                ) {
                    $ids[] = (int) $a->id;
                }
            };
        }
        return $ids;
    }
    public function tree($accounts): array
    {
        $byId = $accounts->keyBy("id");
        $children = $accounts->groupBy(fn($a) => (int) ($a->parent_id ?? 0));
        $result = [];
        $visited = [];
        $walk = function ($a, $depth, $path) use (&$walk, &$result, &$visited, $children) {
            if (isset($visited[$a->id])) {
                return [0, 0];
            }
            $visited[$a->id] = true;
            $a->depth = $depth;
            $a->parent_path = $path;
            $a->own_balance = $a->balance;
            $a->own_debit = (float) $a->debit;
            $a->own_credit = (float) $a->credit;
            $a->child_count = count($children[$a->id] ?? []);
            $result[] = $a;
            $debit = (float) $a->debit;
            $credit = (float) $a->credit;
            foreach ($children[$a->id] ?? [] as $child) {
                [$d, $c] = $walk(
                    $child,
                    $depth + 1,
                    trim($path . " / " . $a->code . " " . $a->name, " /"),
                );
                $debit += $d;
                $credit += $c;
            }
            $a->debit = round($debit, 2);
            $a->credit = round($credit, 2);
            $a->balance = round(
                in_array($a->type, ["liability", "equity", "income"])
                    ? $credit - $debit
                    : $debit - $credit,
                2,
            );
            return [$debit, $credit];
        };
        foreach ($accounts as $a) {
            if (!$a->parent_id || !$byId->has($a->parent_id)) {
                $walk($a, 0, "");
            }
        }
        return $result;
    }
}
