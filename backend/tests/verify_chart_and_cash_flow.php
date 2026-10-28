<?php
// Isolated finance integration checks; never touches the application database.
require __DIR__ . "/../vendor/autoload.php";
$app = require __DIR__ . "/../bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config([
    "database.default" => "sqlite",
    "database.connections.sqlite" => [
        "driver" => "sqlite",
        "database" => ":memory:",
        "prefix" => "",
        "foreign_key_constraints" => true,
    ],
]);
Illuminate\Support\Facades\DB::purge("sqlite");
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use App\Services\Accounting\PostingService;
use App\Services\Accounting\PaymentVoucherService;
use App\Services\Reporting\CashFlowService;
use App\Http\Controllers\Api\AccountController;
function check($ok, $name)
{
    if (!$ok) {
        throw new RuntimeException($name);
    }
    echo "PASS $name\n";
}
function rejects($fn, $name)
{
    try {
        $fn();
        throw new RuntimeException("Accepted: " . $name);
    } catch (Illuminate\Validation\ValidationException $e) {
        check(true, $name);
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        check($e->getStatusCode() === 422, $name);
    }
}
(require __DIR__.'/../database/migrations/2026_10_13_000001_create_procure_to_stock_foundation.php')->up();
Schema::create("customer_receipts", fn($t) => $t->id());
foreach (
    [
        ["1000", "Cash", "asset"],
        ["1100", "Receivables", "asset"],
        ["4000", "Sales", "income"],
        ["5300", "Delivery", "expense"],
        ["5500", "Bank charges", "expense"],
        ["1500", "Equipment", "asset"],
        ["1600", "Other asset", "asset"],
        ["3000", "Capital", "equity"],
        ["2500", "Loan", "liability"],
    ]
    as [$code, $name, $type]
) {
    DB::table("accounts")->insert([
        "code" => $code,
        "name" => $name,
        "type" => $type,
        "is_postable" => 1,
    ]);
}
(require __DIR__.'/../database/migrations/2026_10_28_000001_create_payment_vouchers.php')->up();
(require __DIR__.'/../database/migrations/2026_10_28_000002_add_chart_of_accounts_controls.php')->up();
check(
    !DB::table("accounts")->where("code", "5500")->value("is_cash_account"),
    "bank charges are not a bank balance",
);
$controller = new AccountController();
$bank = [
    "code" => "BANK-B",
    "name" => "Business bank",
    "type" => "asset",
    "is_postable" => true,
    "is_active" => true,
    "is_cash_account" => true,
    "cash_flow_activity" => "unclassified",
];
$response = $controller->store(Request::create("/", "POST", $bank));
$bid = $response->getData()->id;
check($response->getStatusCode() === 201, "create cash account outside numeric cash codes");
rejects(
    fn() => $controller->store(
        Request::create("/", "POST", array_replace($bank, ["code" => "BAD", "type" => "expense"])),
    ),
    "cash account must be an asset",
);
rejects(
    fn() => $controller->update(Request::create("/", "PUT", $bank), $bid),
    "account changes require a reason",
);
$ids = DB::table("accounts")->pluck("id", "code");
DB::table("accounts")
    ->where("code", "1500")
    ->update(["cash_flow_activity" => "investing"]);
DB::table("accounts")
    ->where("code", "2500")
    ->update(["cash_flow_activity" => "financing"]);
DB::table("accounting_periods")->insert([
    "name" => "2026",
    "starts_on" => "2026-01-01",
    "ends_on" => "2026-12-31",
    "status" => "open",
]);
$posting = new PostingService();
$seq = 0;
function entry($date, $lines)
{
    global $posting, $seq;
    $seq++;
    return DB::transaction(
        fn() => $posting->post(
            "test",
            $seq,
            $date,
            "Finance test",
            array_map(
                fn($l) => ["account_code" => $l[0], "debit" => $l[1], "credit" => $l[2]],
                $lines,
            ),
        ),
    );
}
entry("2026-09-30", [["1000", 1000, 0], ["3000", 0, 1000]]);
entry("2026-10-02", [["1100", 500, 0], ["4000", 0, 500]]);
entry("2026-10-03", [["BANK-B", 200, 0], ["1100", 0, 200]]);
entry("2026-10-05", [["1500", 100, 0], ["1000", 0, 100]]);
entry("2026-10-06", [["1000", 300, 0], ["2500", 0, 300]]);
entry("2026-10-07", [["BANK-B", 150, 0], ["1000", 0, 150]]);
entry("2026-10-08", [["5500", 10, 0], ["BANK-B", 0, 10]]);
entry("2026-10-09", [["1600", 20, 0], ["1000", 0, 20]]);
entry("2026-10-10", [["BANK-B", 40, 0], ["4000", 0, 40], ["1500", 40, 0], ["1000", 0, 40]]);
$service = new PaymentVoucherService($posting);
$vid = $service->save(
    [
        "kind" => "expense",
        "payee" => "Courier",
        "payment_date" => "2026-10-12",
        "payment_method" => "bank_transfer",
        "payment_account_id" => $bid,
        "description" => "Delivery",
        "lines" => [["account_id" => $ids["5300"], "description" => "Delivery", "amount" => 50]],
    ],
    null,
    1,
);
$flow = new CashFlowService();
$before = $flow->report("2026-10-01", "2026-10-31");
check($before["outflows"] === 170.0, "draft vouchers excluded from cash flow");
$service->post($vid, 1);
$report = $flow->report("2026-10-01", "2026-10-31");
check(
    $report["opening_balance"] === 1000.0 && $report["closing_balance"] === 1320.0,
    "cash opening and closing match posted ledger",
);
check(
    $report["operating"] === 180.0 &&
        $report["investing"] === -140.0 &&
        $report["financing"] === 300.0 &&
        $report["unclassified"] === -20.0,
    "cash classified by counterpart accounts including mixed journals",
);
check(
    $report["net_change"] === 320.0 && $report["reconciliation_difference"] === 0.0,
    "cash statement reconciles exactly",
);
check(
    $report["inflows"] === 540.0 &&
        $report["outflows"] === 220.0 &&
        count($report["transfers"]) === 1,
    "internal transfers excluded from external receipts and payments",
);
check(
    count($report["movements"]) === 7,
    "unpaid invoice and pure transfer excluded from movements",
);
$service->cancel($vid, "Returned payment", "2026-10-28", 1);
check(
    $flow->report("2026-10-01", "2026-10-27")["closing_balance"] === 1320.0 &&
        $flow->report("2026-10-01", "2026-10-31")["closing_balance"] === 1370.0,
    "voucher reversal affects cash on reversal date",
);
$ledger = $controller
    ->ledger(Request::create("/", "GET", ["from" => "2026-10-01", "to" => "2026-10-31"]), $bid)
    ->getData(true);
check(
    $ledger["opening"] === 0 && $ledger["closing"] === 380,
    "account ledger includes receipt, transfer, expense and reversal",
);
rejects(
    fn() => $controller->update(
        Request::create(
            "/",
            "PUT",
            array_replace($bank, ["is_cash_account" => false, "reason" => "Change role"]),
        ),
        $bid,
    ),
    "used account cash role protected",
);
$cash = (array) DB::table("accounts")->where("code", "1000")->first();
rejects(
    fn() => $controller->update(
        Request::create(
            "/",
            "PUT",
            array_replace($cash, ["is_active" => false, "reason" => "Close"]),
        ),
        $ids["1000"],
    ),
    "system account cannot be deactivated",
);
$controller->update(
    Request::create(
        "/",
        "PUT",
        array_replace($bank, ["name" => "Business current account", "reason" => "Clarify name"]),
    ),
    $bid,
);
check(
    DB::table("audit_logs")->where("event", "account.updated")->exists(),
    "account edits retain audit reason",
);
$accounts = $controller
    ->index(Request::create("/", "GET", ["as_of" => "2026-10-31"]))
    ->getData(true)["accounts"];
check(
    collect($accounts)->firstWhere("code", "BANK-B")["balance"] === 380,
    "chart balances use posted ledger",
);
$financial = (new App\Services\Reporting\FinancialReportService())->statements(
    "2026-10-01",
    "2026-10-31",
);
check(
    $financial["cash_flow"] === $flow->report("2026-10-01", "2026-10-31"),
    "financial statements share the same cash flow calculation",
);
entry("2026-11-01", [
    ["BANK-B", 0.02, 0],
    ["4000", 0, 0.01],
    ["2500", 0, 0.01],
    ["1600", 0, 0.01],
    ["1500", 0.01, 0],
]);
$penny = $flow->report("2026-11-01", "2026-11-01");
check(
    $penny["net_change"] === 0.02 && $penny["reconciliation_difference"] === 0.0,
    "mixed cent allocations reconcile without rounding loss",
);
