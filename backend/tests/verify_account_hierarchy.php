<?php
// Reuse isolated finance fixtures; never connects to business data.
require __DIR__ . "/verify_chart_and_cash_flow.php";
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\Accounting\PostingService;
$base = [
    "code" => "GROUP-A",
    "name" => "Cash and banks group",
    "type" => "asset",
    "is_postable" => false,
    "is_active" => true,
    "is_cash_account" => false,
    "cash_flow_activity" => "unclassified",
    "parent_id" => null,
];
$root = $controller->store(Request::create("/", "POST", $base))->getData(true);
$sub = $controller
    ->store(
        Request::create(
            "/",
            "POST",
            array_merge($base, [
                "code" => "GROUP-B",
                "name" => "Banks",
                "parent_id" => $root["id"],
            ]),
        ),
    )
    ->getData(true);
$childData = array_merge($base, [
    "code" => "SUB-BANK",
    "name" => "Savings bank",
    "is_postable" => true,
    "is_cash_account" => true,
    "parent_id" => $sub["id"],
]);
$child = $controller->store(Request::create("/", "POST", $childData))->getData(true);
check(
    (int) $child["parent_id"] === (int) $sub["id"],
    "Create a posting account inside a nested parent group",
);
app(PostingService::class)->post("hierarchy_test", 999, "2026-10-20", "Subaccount funding", [
    ["account_code" => "SUB-BANK", "debit" => 500, "credit" => 0],
    ["account_code" => "3000", "debit" => 0, "credit" => 500],
]);
$tree = $controller->index(Request::create("/", "GET", ["as_of" => "2026-10-31"]))->getData(true)[
    "accounts"
];
$rootRow = collect($tree)->firstWhere("id", $root["id"]);
$subRow = collect($tree)->firstWhere("id", $sub["id"]);
$childRow = collect($tree)->firstWhere("id", $child["id"]);
check(
    (float) $rootRow["balance"] === 500.0 &&
        (float) $subRow["balance"] === 500.0 &&
        (float) $childRow["balance"] === 500.0,
    "Balances roll up through every parent without creating journals",
);
check(
    (float) $rootRow["own_balance"] === 0.0 && $childRow["depth"] === 2,
    "Group subtotal is separate from direct balance and nested depth is retained",
);
$ledger = $controller
    ->ledger(
        Request::create("/", "GET", ["from" => "2026-10-01", "to" => "2026-10-31"]),
        $root["id"],
    )
    ->getData(true);
check(
    (float) $ledger["closing"] === 500.0 && $ledger["lines"][0]["account_code"] === "SUB-BANK",
    "Parent ledger includes and identifies descendant account entries",
);
rejects(
    fn() => $controller->update(
        Request::create(
            "/",
            "PUT",
            array_merge($base, ["parent_id" => $sub["id"], "reason" => "Test cycle"]),
        ),
        $root["id"],
    ),
    "Cannot move a group inside its own descendant",
);
rejects(
    fn() => $controller->store(
        Request::create(
            "/",
            "POST",
            array_merge($base, ["code" => "BAD-PARENT", "parent_id" => $child["id"]]),
        ),
    ),
    "Posting accounts cannot be parents",
);
rejects(
    fn() => $controller->store(
        Request::create(
            "/",
            "POST",
            array_merge($base, [
                "code" => "BAD-TYPE",
                "type" => "expense",
                "parent_id" => $root["id"],
            ]),
        ),
    ),
    "Parent and child account types must agree",
);
rejects(
    fn() => $controller->update(
        Request::create(
            "/",
            "PUT",
            array_merge($base, ["is_postable" => true, "reason" => "Try posting group"]),
        ),
        $root["id"],
    ),
    "A group with children cannot become a posting account",
);
rejects(
    fn() => app(PostingService::class)->post("invalid_group", 999, "2026-10-20", "Invalid", [
        ["account_code" => "GROUP-A", "debit" => 1, "credit" => 0],
        ["account_code" => "3000", "debit" => 0, "credit" => 1],
    ]),
    "Group accounts reject journal postings",
);
$before = DB::table("journal_lines")->where("account_id", $child["id"])->sum("debit");
$controller->update(
    Request::create(
        "/",
        "PUT",
        array_merge($childData, [
            "parent_id" => $root["id"],
            "reason" => "Move savings bank directly under cash group",
        ]),
    ),
    $child["id"],
);
check(
    DB::table("journal_lines")->where("account_id", $child["id"])->sum("debit") === $before,
    "Regrouping preserves the original posted transactions",
);
