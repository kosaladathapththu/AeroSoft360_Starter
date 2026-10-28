<?php
// Isolated fixtures: never connects to the business database.
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
use App\Services\Reporting\CustomerProfileService;
$tables = [
    "customers" => ["code", "name", "credit_days", "credit_limit"],
    "sales_representatives" => ["name"],
    "accounts" => ["code", "name"],
    "articles" => ["code", "name"],
    "sales_invoices" => [
        "number",
        "customer_id",
        "sales_rep_id",
        "sales_order_id",
        "invoice_date",
        "due_date",
        "total",
        "status",
    ],
    "customer_receipts" => [
        "number",
        "customer_id",
        "collector_sales_rep_id",
        "payment_account_id",
        "receipt_date",
        "amount",
        "status",
    ],
    "receipt_allocations" => ["receipt_id", "invoice_id", "amount"],
    "sales_invoice_lines" => ["sales_invoice_id", "article_id"],
    "customer_pos" => ["customer_id", "sales_rep_id", "po_date", "number", "customer_po_reference"],
    "customer_po_lines" => ["customer_po_id", "article_id"],
    "sales_orders" => ["customer_id", "customer_po_id", "order_date"],
    "sales_order_size_lines" => ["sales_order_id", "article_id"],
    "journal_entries" => [
        "number",
        "status",
        "posting_date",
        "description",
        "source_type",
        "source_id",
    ],
    "journal_lines" => ["journal_entry_id", "account_id", "debit", "credit"],
];
foreach ($tables as $name => $columns) {
    Schema::create($name, function ($t) use ($columns) {
        $t->id();
        foreach ($columns as $c) {
            $t->string($c)->nullable();
        }
    });
}
function check($ok, $message)
{
    if (!$ok) {
        throw new RuntimeException($message);
    }
    echo "PASS: $message\n";
}
DB::table("customers")->insert([
    [
        "id" => 1,
        "code" => "C1",
        "name" => "Customer one",
        "credit_days" => 30,
        "credit_limit" => 1000,
    ],
    [
        "id" => 2,
        "code" => "C2",
        "name" => "Other customer",
        "credit_days" => 0,
        "credit_limit" => 0,
    ],
]);
$dates = [
    "2026-10-28",
    "2026-10-27",
    "2026-09-28",
    "2026-09-27",
    "2026-08-29",
    "2026-08-28",
    "2026-07-30",
    "2026-07-29",
];
foreach ($dates as $index => $due) {
    DB::table("sales_invoices")->insert([
        "id" => $index + 1,
        "number" => "INV-" . ($index + 1),
        "customer_id" => 1,
        "invoice_date" => "2026-07-01",
        "due_date" => $due,
        "total" => 100,
        "status" => "paid",
    ]);
}
DB::table("sales_invoices")->insert([
    "id" => 20,
    "number" => "OTHER",
    "customer_id" => 2,
    "invoice_date" => "2026-07-01",
    "due_date" => "2026-07-01",
    "total" => 999,
    "status" => "unpaid",
]);
DB::table("sales_invoices")->insert([
    "id" => 21,
    "number" => "FUTURE",
    "customer_id" => 1,
    "invoice_date" => "2026-11-01",
    "due_date" => "2026-11-01",
    "total" => 999,
    "status" => "unpaid",
]);
DB::table("sales_invoices")->insert([
    "id" => 22,
    "number" => "VOID",
    "customer_id" => 1,
    "invoice_date" => "2026-07-01",
    "due_date" => "2026-07-01",
    "total" => 999,
    "status" => "void",
]);
DB::table("customer_receipts")->insert([
    [
        "id" => 1,
        "number" => "REC-1",
        "customer_id" => 1,
        "receipt_date" => "2026-10-28",
        "amount" => 25,
        "status" => "posted",
    ],
    [
        "id" => 2,
        "number" => "REC-2",
        "customer_id" => 1,
        "receipt_date" => "2026-10-29",
        "amount" => 75,
        "status" => "posted",
    ],
    [
        "id" => 3,
        "number" => "REC-3",
        "customer_id" => 1,
        "receipt_date" => "2026-10-28",
        "amount" => 900,
        "status" => "void",
    ],
]);
DB::table("receipt_allocations")->insert([
    ["receipt_id" => 1, "invoice_id" => 2, "amount" => 25],
    ["receipt_id" => 2, "invoice_id" => 2, "amount" => 75],
    ["receipt_id" => 3, "invoice_id" => 3, "amount" => 100],
]);
$service = new CustomerProfileService();
DB::table("accounts")->insert(["id" => 1, "code" => "1100", "name" => "Receivables"]);
DB::table("journal_entries")->insert([
    "id" => 1,
    "number" => "J1",
    "status" => "posted",
    "posting_date" => "2026-07-01",
    "description" => "Invoice",
    "source_type" => "sales_invoice",
    "source_id" => 1,
]);
DB::table("journal_lines")->insert([
    "journal_entry_id" => 1,
    "account_id" => 1,
    "debit" => 100,
    "credit" => 0,
]);
$p = $service->profile(1, "2026-10-28");
check(
    $p["summary"]["ledger_balance"] == 100 && count($p["ledger"]["rows"]) === 1,
    "Profile includes posted customer ledger and exposes reconciliation differences",
);
check(
    count($p["invoices"]) === 8,
    "Only this customer’s non-void invoices through the cutoff are included",
);
check(
    $p["summary"]["outstanding"] == 775,
    "Historical balances ignore cached paid status and future receipts",
);
check($p["summary"]["total_received"] == 25, "Only posted receipts through the cutoff count");
check(
    $p["aging"] == [
        "current" => 100,
        "days_1_30" => 175,
        "days_31_60" => 200,
        "days_61_90" => 200,
        "days_90_plus" => 100,
    ],
    "Every aging boundary is calculated from due dates",
);
check(
    $p["summary"]["overdue"] == 675 && $p["summary"]["due_today"] == 100,
    "Due today is separate from overdue",
);
check($p["summary"]["available_credit"] == 225, "Available credit uses net receivable exposure");
check($p["summary"]["oldest_overdue_days"] === 91, "Oldest overdue age is correct");
$later = $service->profile(1, "2026-10-29");
check(
    $later["summary"]["total_received"] == 100,
    "Future receipt is included when the cutoff advances",
);
DB::table("customer_receipts")->insert([
    "number" => "CREDIT",
    "customer_id" => 1,
    "receipt_date" => "2026-10-28",
    "amount" => 50,
    "status" => "posted",
]);
$credit = $service->profile(1, "2026-10-28");
check(
    $credit["summary"]["customer_credit"] == 50 && $credit["summary"]["outstanding"] == 775,
    "Unallocated credit does not silently settle invoices",
);
$empty = $service->profile(2, "2026-06-01");
check(
    $empty["summary"]["outstanding"] == 0 && $empty["summary"]["available_credit"] === null,
    "Empty history and unconfigured credit limits are supported",
);
try {
    $service->profile(999, "2026-10-28");
    check(false, "Unknown customer must fail");
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    check($e->getStatusCode() === 404, "Unknown customer returns 404");
}
