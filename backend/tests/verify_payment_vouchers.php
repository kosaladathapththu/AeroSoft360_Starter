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
$voucherRevisionMigration = require __DIR__.'/../database/migrations/2026_11_19_000001_create_payment_voucher_revisions.php';
$voucherRevisionMigration->up();
DB::statement("DROP INDEX pvr_original_date_idx");
$voucherRevisionMigration->up();
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
rejects(fn() => $service->cancel($id, "   ", "2026-10-28", 42), "cancellation needs a reason");
rejects(
    fn() => $service->cancel($id, "Wrong payee", "2026-10-26", 42),
    "cancellation cannot predate payment",
);
$correction = $expense;
$correction["payment_date"] = "2026-10-28";
$correction["revision_date"] = "2026-10-28";
$correction["reason"] = "Corrected delivery total";
$correction["description"] = "Corrected delivery payment";
$correction["lines"] = [
    ["account_id" => $ids["5300"], "description" => "Corrected delivery charges", "amount" => 175],
];
DB::table("accounting_periods")->where("name", "Open 2026")->update(["status" => "closed"]);
$journalCount = DB::table("journal_entries")->count();
rejects(
    fn() => $service->save($correction, $id, 42),
    "posted voucher correction rejects a closed accounting period",
);
check(
    DB::table("payment_vouchers")->where("id", $id)->value("status") === "posted" &&
        DB::table("journal_entries")->count() === $journalCount,
    "failed correction leaves original voucher and ledger unchanged",
);
DB::table("accounting_periods")->where("name", "Open 2026")->update(["status" => "open"]);
$replacementId = $service->save($correction, $id, 42);
$replacementDeleteRejected = false;
try {
    $service->deleteDraft($replacementId, "Remove correction", 42);
} catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
    $replacementDeleteRejected = $e->getStatusCode() === 422;
}
check($replacementDeleteRejected, "replacement draft cannot be deleted out of revision history");
$reversal = DB::table("payment_vouchers")->where("id", $id)->value("reversal_journal_id");
check(
    DB::table("payment_vouchers")->where("id", $id)->value("status") === "void" &&
        DB::table("payment_vouchers")->where("id", $replacementId)->value("status") === "draft" &&
        (float) DB::table("payment_vouchers")->where("id", $replacementId)->value("total") === 175.0,
    "posted edit reverses original and creates a replacement draft",
);
check(
    DB::table("payment_voucher_revisions")
        ->where("original_voucher_id", $id)
        ->where("replacement_voucher_id", $replacementId)
        ->where("reason", "Corrected delivery total")
        ->whereNotNull("reversal_journal_id")
        ->where(
            "reversal_journal_id",
            DB::table("payment_vouchers")->where("id", $id)->value("reversal_journal_id"),
        )
        ->exists(),
    "posted voucher revision link and reason are retained",
);
check(
    (float) DB::table("journal_lines")
        ->where("journal_entry_id", $reversal)
        ->where("account_id", $ids["1000"])
        ->value("debit") === 150.0,
    "cancellation reverses cash without deleting original journal",
);
$service->post($replacementId, 42);
$replacementJournal = DB::table("payment_vouchers")
    ->where("id", $replacementId)
    ->value("journal_id");
check(
    (float) DB::table("journal_lines")
        ->where("journal_entry_id", $replacementJournal)
        ->sum("debit") === 175.0,
    "replacement posts corrected amount to the ledger",
);
$service->cancel($replacementId, "Incorrect payee", "2026-10-29", 42);
$reversal = DB::table("payment_vouchers")
    ->where("id", $replacementId)
    ->value("reversal_journal_id");
check(
    (float) DB::table("journal_lines")
        ->where("journal_entry_id", $reversal)
        ->where("account_id", $ids["1000"])
        ->value("debit") === 175.0,
    "cancellation reverses replacement without deleting its journal",
);
check(
    DB::table("payment_vouchers")->where("id", $replacementId)->value("void_reason") ===
        "Incorrect payee",
    "cancellation reason retained",
);
rejects(fn() => $service->post($replacementId, 42), "cancelled voucher cannot be posted");
$draft = $service->save($expense, null, 42);
$count = DB::table("journal_entries")->count();
$service->cancel($draft, "Duplicate draft", "2026-10-28", 42);
check(
    DB::table("journal_entries")->count() === $count,
    "draft cancellation does not affect ledger",
);
$draftToDelete = $service->save($expense, null, 42);
$service->deleteDraft($draftToDelete, "Duplicate entry", 42);
check(
    !DB::table("payment_vouchers")->where("id", $draftToDelete)->exists() &&
        DB::table("audit_logs")
            ->where("event", "payment_voucher.deleted")
            ->where("entity_id", $draftToDelete)
            ->where("payload", "like", '%"reason":"Duplicate entry"%')
            ->exists(),
    "draft deletion removes the draft and keeps a reasoned audit record",
);
rejects(
    fn() => $service->deleteDraft($replacementId, "Remove history", 42),
    "posted voucher history cannot be deleted",
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
$supplierCorrection = $supplierData;
$supplierCorrection["payment_date"] = "2026-10-28";
$supplierCorrection["revision_date"] = "2026-10-28";
$supplierCorrection["reason"] = "Corrected supplier payment";
$supplierCorrection["lines"][0]["amount"] = 300;
$replacementSid = $service->save($supplierCorrection, $sid, 42);
check(
    $aging->report("2026-10-27")["totals"]["total"] === 600.0 &&
        $aging->report("2026-10-28")["totals"]["total"] === 1000.0,
    "supplier correction reverses old payment on its date without changing earlier aging",
);
$service->post($replacementSid, 42);
check(
    $aging->report("2026-10-28")["totals"]["total"] === 700.0,
    "posted replacement reduces supplier balance by the corrected amount",
);
$service->cancel($replacementSid, "Payment returned", "2026-10-29", 42);
check(
    $aging->report("2026-10-28")["totals"]["total"] === 700.0 &&
        $aging->report("2026-10-29")["totals"]["total"] === 1000.0,
    "replacement cancellation restores supplier balance from its reversal date",
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
$apiDraft = $service->save($expense, null, 42);
$deleteRequest = Request::create("/", "DELETE", ["reason" => "Duplicate API draft"]);
$deleteRequest->attributes->set("auth_user", (object) ["id" => 42]);
check(
    $controller->delete($deleteRequest, $apiDraft, $service)->getStatusCode() === 200 &&
        !DB::table("payment_vouchers")->where("id", $apiDraft)->exists(),
    "draft deletion API validates and deletes draft",
);
$metadata = $controller->index()->getData(true);
check(
    count($metadata["payment_accounts"]) === 1 && count($metadata["expense_accounts"]) === 1,
    "account options restrict payment sources and expenses",
);
$metadataById = collect($metadata["vouchers"])->keyBy("id");
check(
    $metadataById->get($id)["revised_to_number"] ===
        DB::table("payment_vouchers")->where("id", $replacementId)->value("number") &&
        $metadataById->get($replacementId)["revised_from_number"] ===
            DB::table("payment_vouchers")->where("id", $id)->value("number"),
    "voucher API returns replacement history links",
);
check(
    DB::table("audit_logs")->where("event", "payment_voucher.posted")->exists() &&
        DB::table("audit_logs")->where("event", "payment_voucher.cancelled")->exists(),
    "posting and cancellation keep audit events",
);
