<?php
// Isolated SQLite fixture: this script never connects to the business database.
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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Services\Accounting\ReceivablesImportService;
DB::purge("sqlite");
$tables = [
    "accounts" => ["code", "type", "is_postable", "is_active"],
    "accounting_periods" => ["starts_on", "ends_on", "status"],
    "customers" => ["code", "name", "address", "credit_days", "credit_limit", "status"],
    "sales_representatives" => ["code", "name", "channel", "default_commission_rate", "status"],
    "sales_invoices" => [
        "number",
        "sales_order_id",
        "customer_id",
        "sales_rep_id",
        "invoice_date",
        "due_date",
        "sale_type",
        "status",
        "subtotal",
        "discount",
        "tax",
        "total",
        "received_amount",
        "outstanding",
        "is_opening_balance",
    ],
    "customer_opening_balances" => [
        "customer_id",
        "amount",
        "balance_date",
        "due_date",
        "offset_account_id",
        "invoice_id",
        "receipt_id",
        "journal_id",
    ],
    "journal_entries" => [
        "number",
        "accounting_period_id",
        "source_type",
        "source_id",
        "posting_date",
        "description",
        "status",
        "posted_at",
    ],
    "journal_lines" => ["journal_entry_id", "account_id", "debit", "credit", "description"],
    "audit_logs" => ["event", "entity_type", "entity_id", "payload"],
];
foreach ($tables as $table => $columns) {
    Schema::create($table, function ($t) use ($columns) {
        $t->id();
        foreach ($columns as $column) {
            $t->string($column)->nullable();
        }
        $t->timestamps();
    });
}
DB::table("accounts")->insert([
    ["code" => "1100", "type" => "asset", "is_postable" => 1, "is_active" => 1],
    ["code" => "3990", "type" => "equity", "is_postable" => 1, "is_active" => 1],
]);
DB::table("accounting_periods")->insert([
    "starts_on" => "2026-01-01",
    "ends_on" => "2026-12-31",
    "status" => "open",
]);
function verify($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "PASS: $message\n";
}
$base = [
    "original_number" => "123",
    "invoice_date" => "2024-03-28",
    "customer" => "Real customer",
    "representative" => "Real rep",
    "address" => "",
    "channel" => "",
    "amount_cents" => 10050,
    "credit_days" => null,
    "key" => "one",
    "row" => 2,
    "number" => "AR-123-one",
];
$second = array_merge($base, [
    "key" => "two",
    "original_number" => "124",
    "row" => 3,
    "number" => "AR-124-two",
    "amount_cents" => 20000,
    "credit_days" => 30,
]);
$service = new ReceivablesImportService();
$result = $service->import([$base, $second], "2026-11-02", "source");
verify(
    $result["created"] === 2 && $result["amount_cents"] === 30050,
    "Multiple source invoices preserve separate debts for one customer",
);
verify(
    DB::table("customers")->count() === 1 && DB::table("sales_representatives")->count() === 1,
    "Customer and salesperson links are reused",
);
verify(
    DB::table("customers")->value("credit_days") === null,
    "Missing customer credit days remain null",
);
verify(
    DB::table("sales_invoices")->where("number", "AR-123-one")->value("due_date") === null,
    "Unknown due date remains null",
);
verify(
    DB::table("sales_invoices")->where("number", "AR-124-two")->value("due_date") === "2024-04-27",
    "Provided credit days calculate the correct due date",
);
verify(
    DB::table("sales_invoices")->value("invoice_date") === "2024-03-28" &&
        DB::table("journal_entries")->value("posting_date") === "2026-11-02",
    "Original dates are retained while openings post in the open import period",
);
verify(
    DB::table("sales_invoices")->where("is_opening_balance", 1)->count() === 2 &&
        (float) DB::table("sales_invoices")->sum("subtotal") === 0.0,
    "Imported debts are opening receivables, not new sales",
);
$again = $service->import([$base, $second], "2026-11-02", "source");
verify(
    $again["created"] === 0 &&
        $again["skipped"] === 2 &&
        DB::table("journal_entries")->count() === 2,
    "Reimport does not duplicate balances or journals",
);
$changed = array_merge($base, [
    "key" => "changed",
    "number" => "AR-123-changed",
    "amount_cents" => 999,
]);
try {
    $service->import([$changed], "2026-11-02", "changed-source");
    throw new RuntimeException("Expected changed-source rejection");
} catch (RuntimeException $e) {
    verify(
        str_contains($e->getMessage(), "changed source values"),
        "Changed source amounts cannot silently create a duplicate debt",
    );
}
$third = array_merge($base, [
    "key" => "three",
    "number" => "AR-123-three",
    "customer" => "Rollback test",
]);
DB::table("accounting_periods")->update(["status" => "closed"]);
try {
    $service->import([$third], "2026-11-02", "source");
    throw new RuntimeException("Expected closed-period rejection");
} catch (Illuminate\Validation\ValidationException $e) {
}
verify(
    DB::table("customers")->count() === 1 && DB::table("sales_invoices")->count() === 2,
    "Posting failure rolls back customers and debts atomically",
);
