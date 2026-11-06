<?php
// Standalone regression checks. All schema and data live in an isolated in-memory SQLite database.
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
use Illuminate\Http\Request;
use App\Services\Accounting\PostingService;
use App\Services\Accounting\PaymentVoucherService;
use App\Services\Reporting\AgingReportService;
use App\Http\Controllers\Api\PaymentVoucherController;

(require __DIR__.'/../database/migrations/2026_10_13_000001_create_procure_to_stock_foundation.php')->up();
(require __DIR__.'/../database/migrations/2026_10_28_000001_create_payment_vouchers.php')->up();
foreach (
    [
        ["1000", "Cash and Bank", "asset"],
        ["1300", "Inventory", "asset"],
        ["2100", "Goods Received Not Invoiced", "liability"],
        ["5300", "Distribution expense", "expense"],
        ["4000", "Sales", "income"],
    ]
    as [$code, $name, $type]
) {
    DB::table("accounts")->insert([
        "code" => $code,
        "name" => $name,
        "type" => $type,
        "is_postable" => true,
    ]);
}
$ids = DB::table("accounts")->pluck("id", "code");
DB::table("accounting_periods")->insert([
    [
        "name" => "Open 2026",
        "starts_on" => "2026-01-01",
        "ends_on" => "2026-12-31",
        "status" => "open",
    ],
    [
        "name" => "Closed 2025",
        "starts_on" => "2025-01-01",
        "ends_on" => "2025-12-31",
        "status" => "closed",
    ],
]);
$supplier = DB::table("suppliers")->insertGetId([
    "code" => "SUP-TEST",
    "name" => "Test supplier",
    "payment_days" => 30,
    "status" => "active",
]);
$po = DB::table("purchase_orders")->insertGetId([
    "number" => "PO-TEST",
    "supplier_id" => $supplier,
    "order_date" => "2026-10-01",
    "status" => "received",
    "total" => 1000,
]);
$receipt = DB::table("goods_receipts")->insertGetId([
    "number" => "GRN-TEST",
    "purchase_order_id" => $po,
    "supplier_id" => $supplier,
    "received_on" => "2026-10-01",
    "supplier_invoice" => "SUP-INV-1",
    "status" => "posted",
    "total" => 1000,
    "posted_at" => now(),
]);
$posting = new PostingService();
$posting->post("goods_receipt", $receipt, "2026-10-01", "Received test goods", [
    ["account_code" => "1300", "debit" => 1000, "credit" => 0],
    ["account_code" => "2100", "debit" => 0, "credit" => 1000],
]);
$service = new PaymentVoucherService($posting);
$aging = new AgingReportService();
function check($condition, $name)
{
    if (!$condition) {
        throw new RuntimeException($name);
    }
    echo "PASS $name\n";
}
function rejects($fn, $name)
{
    try {
        $fn();
        throw new RuntimeException("Unexpected acceptance: " . $name);
    } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
        check($e->getStatusCode() === 422, $name);
    } catch (\Illuminate\Validation\ValidationException $e) {
        check(true, $name);
    }
}
$expense = [
    "kind" => "expense",
    "payee" => "Courier company",
    "payment_date" => "2026-10-27",
    "payment_method" => "cash",
    "payment_account_id" => $ids["1000"],
    "description" => "Delivery payment",
    "lines" => [
        ["account_id" => $ids["5300"], "description" => "Delivery charges", "amount" => 100],
        ["account_id" => $ids["5300"], "description" => "Packing charges", "amount" => 50],
    ],
];
$id = $service->save($expense, null, 42);
check(
    DB::table("journal_entries")->count() === 1 &&
        (float) DB::table("payment_vouchers")->where("id", $id)->value("total") === 150.0,
    "draft saves without posting and calculates amount",
);
check(
    str_starts_with(DB::table("payment_vouchers")->where("id", $id)->value("number"), "PV-202610-"),
    "voucher number generated from unique ID",
);
$service->post($id, 42);
$journal = DB::table("payment_vouchers")->where("id", $id)->value("journal_id");
check(
    (float) DB::table("journal_lines")->where("journal_entry_id", $journal)->sum("debit") ===
        150.0 &&
        (float) DB::table("journal_lines")->where("journal_entry_id", $journal)->sum("credit") ===
            150.0,
    "posting creates a balanced expense and cash journal",
);
$service->post($id, 42);
check(DB::table("journal_entries")->count() === 2, "repeated posting does not duplicate journal");
rejects(fn() => $service->save($expense, $id, 42), "posted voucher cannot be edited");
rejects(fn() => $service->cancel($id, "   ", "2026-10-28", 42), "cancellation needs a reason");
rejects(
    fn() => $service->cancel($id, "Wrong payee", "2026-10-26", 42),
    "cancellation cannot predate payment",
);
$service->cancel($id, "Incorrect payee", "2026-10-28", 42);
$reversal = DB::table("payment_vouchers")->where("id", $id)->value("reversal_journal_id");
check(
    (float) DB::table("journal_lines")
        ->where("journal_entry_id", $reversal)
        ->where("account_id", $ids["1000"])
        ->value("debit") === 150.0,
    "cancellation reverses cash without deleting original journal",
);
check(
    DB::table("payment_vouchers")->where("id", $id)->value("void_reason") === "Incorrect payee",
    "cancellation reason retained",
);
rejects(fn() => $service->post($id, 42), "cancelled voucher cannot be posted");
$draft = $service->save($expense, null, 42);
$count = DB::table("journal_entries")->count();
$service->cancel($draft, "Duplicate draft", "2026-10-28", 42);
check(
    DB::table("journal_entries")->count() === $count,
    "draft cancellation does not affect ledger",
);
$bad = $expense;
$bad["payment_account_id"] = $ids["5300"];
rejects(fn() => $service->save($bad, null, 42), "expense account cannot be used as cash source");
$bad = $expense;
$bad["lines"][0]["account_id"] = $ids["2100"];
rejects(
    fn() => $service->save($bad, null, 42),
    "supplier liability requires linked supplier receipt",
);
$closed = $expense;
$closed["payment_date"] = "2025-10-01";
$closedId = $service->save($closed, null, 42);
$count = DB::table("journal_entries")->count();
rejects(fn() => $service->post($closedId, 42), "closed period rejects posting");
check(
    DB::table("journal_entries")->count() === $count &&
        DB::table("payment_vouchers")->where("id", $closedId)->value("status") === "draft",
    "failed posting is atomic",
);
$supplierData = [
    "kind" => "supplier",
    "payment_date" => "2026-10-27",
    "payment_method" => "bank_transfer",
    "payment_account_id" => $ids["1000"],
    "goods_receipt_id" => $receipt,
    "description" => "Supplier part settlement",
    "lines" => [["description" => "Supplier payment", "amount" => 400]],
];
$sid = $service->save($supplierData, null, 42);
check(
    $aging->report("2026-10-28")["totals"]["total"] === 1000.0,
    "draft supplier payment does not reduce aging",
);
$service->post($sid, 42);
check(
    $aging->report("2026-10-28")["totals"]["total"] === 600.0,
    "posted supplier payment reduces payable aging",
);
check(
    $aging->report("2026-10-26")["totals"]["total"] === 1000.0,
    "aging before payment preserves full balance",
);
check(
    DB::table("payment_vouchers")->where("id", $sid)->value("payee") === "Test supplier",
    "supplier payee comes from selected receipt",
);
$over = $supplierData;
$over["lines"][0]["amount"] = 700;
$overId = $service->save($over, null, 42);
rejects(
    fn() => $service->post($overId, 42),
    "supplier overpayment rejected against locked balance",
);
$service->cancel($sid, "Payment returned", "2026-10-28", 42);
check(
    $aging->report("2026-10-27")["totals"]["total"] === 600.0,
    "historical aging retains payment until reversal date",
);
check(
    $aging->report("2026-10-28")["totals"]["total"] === 1000.0,
    "cancellation restores supplier payable balance",
);
$controller = new PaymentVoucherController();
$request = Request::create("/", "POST", $expense);
$request->attributes->set("auth_user", (object) ["id" => 42]);
$response = $controller->store($request, $service);
check($response->getStatusCode() === 201, "voucher API validates and creates draft");
$edit = Request::create("/", "PUT", $expense);
rejects(
    fn() => $controller->update($edit, $response->getData(true)["id"], $service),
    "draft edit API requires reason",
);
$metadata = $controller->index()->getData(true);
check(
    count($metadata["payment_accounts"]) === 1 && count($metadata["expense_accounts"]) === 1,
    "account options restrict payment sources and expenses",
);
check(
    DB::table("audit_logs")->where("event", "payment_voucher.posted")->exists() &&
        DB::table("audit_logs")->where("event", "payment_voucher.cancelled")->exists(),
    "posting and cancellation keep audit events",
);
