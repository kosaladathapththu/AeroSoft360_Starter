<?php
// Isolated fixture: never connects to or mutates business data.
require __DIR__ . "/../vendor/autoload.php";
$app = require __DIR__ . "/../bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config([
    "database.default" => "sqlite",
    "database.connections.sqlite" => [
        "driver" => "sqlite",
        "database" => ":memory:",
        "prefix" => "",
    ],
]);
Illuminate\Support\Facades\DB::purge("sqlite");
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\ReceivableController;
$tables = [
    "sales_invoices" => [
        "number",
        "invoice_date",
        "due_date",
        "total",
        "outstanding",
        "received_amount",
        "status",
        "is_opening_balance",
        "updated_at",
    ],
    "customer_opening_balances" => [
        "invoice_id",
        "journal_id",
        "offset_account_id",
        "amount",
        "balance_date",
        "due_date",
        "updated_at",
    ],
    "journal_entries" => [
        "source_type",
        "source_id",
        "accounting_period_id",
        "status",
    ],
    "journal_lines" => [
        "journal_entry_id",
        "account_id",
        "debit",
        "credit",
        "updated_at",
    ],
    "accounting_periods" => ["status"],
    "accounts" => ["code"],
    "receipt_allocations" => ["invoice_id"],
    "sales_returns" => ["sales_invoice_id"],
    "audit_logs" => [
        "event",
        "entity_type",
        "entity_id",
        "payload",
        "created_at",
    ],
];
foreach ($tables as $table => $fields) {
    Schema::create($table, function ($t) use ($fields) {
        $t->increments("id");
        foreach ($fields as $field) {
            $t->text($field)->nullable();
        }
    });
}
DB::table("accounts")->insert([
    ["id" => 1, "code" => "1100"],
    ["id" => 2, "code" => "3990"],
]);
DB::table("accounting_periods")->insert(["id" => 1, "status" => "open"]);
DB::table("sales_invoices")->insert([
    "id" => 1,
    "number" => "AR-001",
    "invoice_date" => "2025-01-01",
    "total" => 100,
    "outstanding" => 100,
    "received_amount" => 0,
    "status" => "unpaid",
    "is_opening_balance" => 1,
]);
DB::table("journal_entries")->insert([
    "id" => 1,
    "source_type" => "sales_invoice",
    "source_id" => 1,
    "accounting_period_id" => 1,
    "status" => "posted",
]);
DB::table("journal_lines")->insert([
    ["journal_entry_id" => 1, "account_id" => 1, "debit" => 100, "credit" => 0],
    ["journal_entry_id" => 1, "account_id" => 2, "debit" => 0, "credit" => 100],
]);
DB::table("customer_opening_balances")->insert([
    "id" => 1,
    "invoice_id" => 1,
    "journal_id" => 1,
    "offset_account_id" => 2,
    "amount" => 100,
    "balance_date" => "2026-11-02",
]);
$controller = new ReceivableController();
$checks = 0;
function check($ok, $message)
{
    global $checks;
    if (!$ok) {
        throw new RuntimeException($message);
    }
    $checks++;
}
function requestFor($data)
{
    return Request::create("/", "PUT", $data);
}
$body = [
    "reason" => "Correct source amount",
    "invoice_date" => "2025-01-02",
    "due_date" => null,
    "total" => 125,
];
$controller->update(requestFor($body), 1);
check(
    DB::table("sales_invoices")->value("outstanding") == 125,
    "Outstanding updated",
);
check(
    DB::table("journal_lines")->sum("debit") == 125 &&
        DB::table("journal_lines")->sum("credit") == 125,
    "Journal balances updated",
);
check(
    DB::table("customer_opening_balances")->value("amount") == 125,
    "Opening amount reconciles",
);
check(
    DB::table("customer_opening_balances")->value("balance_date") ===
        "2026-11-02",
    "Posting date preserved",
);
check(
    DB::table("sales_invoices")->value("due_date") === null,
    "Unknown terms stay blank",
);
function rejected($call)
{
    try {
        $call();
    } catch (Throwable $e) {
        return true;
    }
    return false;
}
check(
    rejected(
        fn() => $controller->update(
            requestFor(array_merge($body, ["reason" => "   "])),
            1,
        ),
    ),
    "Blank reason rejected",
);
DB::table("accounting_periods")->update(["status" => "closed"]);
check(
    rejected(
        fn() => $controller->destroy(requestFor(["reason" => "Duplicate"]), 1),
    ),
    "Closed period protected",
);
DB::table("accounting_periods")->update(["status" => "open"]);
DB::table("receipt_allocations")->insert(["invoice_id" => 1]);
check(
    rejected(
        fn() => $controller->destroy(requestFor(["reason" => "Duplicate"]), 1),
    ),
    "Collections protected",
);
DB::table("receipt_allocations")->delete();
DB::table("sales_returns")->insert(["sales_invoice_id" => 1]);
check(
    rejected(fn() => $controller->update(requestFor($body), 1)),
    "Returns protected",
);
DB::table("sales_returns")->delete();
$controller->destroy(requestFor(["reason" => "Duplicate source record"]), 1);
check(
    DB::table("sales_invoices")->count() === 0 &&
        DB::table("journal_entries")->count() === 0 &&
        DB::table("journal_lines")->count() === 0 &&
        DB::table("customer_opening_balances")->count() === 0,
    "Linked deletion reconciles",
);
$audit = json_decode(
    DB::table("audit_logs")
        ->where("event", "receivable.delete")
        ->value("payload"),
    true,
);
check(
    $audit["reason"] === "Duplicate source record" &&
        count($audit["journal_lines"]) === 2 &&
        $audit["before"]["total"] == 125,
    "Original details and reason retained",
);
echo "$checks receivable action checks passed (SQLite memory only).\n";
