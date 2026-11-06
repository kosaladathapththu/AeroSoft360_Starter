<?php
// Isolated fixture: never connects to the business database.
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
use App\Services\Sales\SalesReturnService;
use App\Services\Accounting\PostingService;
DB::purge("sqlite");
Carbon\Carbon::setTestNow("2026-11-02 12:00:00");
$tables = [
    "accounts" => [
        "code",
        "name",
        "type",
        "is_postable",
        "is_active",
        "is_cash_account",
        "is_system",
        "cash_flow_activity",
        "description",
    ],
    "accounting_periods" => ["starts_on", "ends_on", "status"],
    "customers" => ["code", "name", "credit_days", "credit_limit"],
    "sales_representatives" => ["name"],
    "articles" => ["code", "name", "track_serials"],
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
    "sales_invoice_lines" => [
        "sales_invoice_id",
        "article_id",
        "size_label",
        "colour",
        "quantity",
        "rate",
    ],
    "finished_goods_stock" => ["article_id", "size_label", "quantity"],
    "finished_goods_movements" => [
        "article_id",
        "size_label",
        "movement_type",
        "quantity",
        "source_type",
        "source_id",
        "event_key",
        "occurred_at",
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
    "customer_receipts" => ["number", "customer_id"],
    "product_serials" => [
        "serial_number",
        "article_id",
        "size_label",
        "sales_invoice_id",
        "status",
        "warranty_starts_on",
        "warranty_ends_on",
    ],
    "warranty_claims" => ["product_serial_id", "status"],
];
foreach ($tables as $name => $columns) {
    Schema::create($name, function ($t) use ($columns) {
        $t->id();
        foreach ($columns as $column) {
            $t->string($column)->nullable();
        }
        $t->timestamps();
    });
}
$migration = require __DIR__ . "/../database/migrations/2026_11_02_000002_create_sales_returns.php";
$migration->up();
foreach (
    [["1100", "asset"], ["4000", "income"], ["2300", "liability"], ["1000", "asset"]]
    as [$code, $type]
) {
    DB::table("accounts")->insert([
        "code" => $code,
        "type" => $type,
        "is_active" => 1,
        "is_postable" => 1,
    ]);
}
DB::table("accounting_periods")->insert([
    "starts_on" => "2026-01-01",
    "ends_on" => "2026-12-31",
    "status" => "open",
]);
DB::table("customers")->insert(["id" => 1, "code" => "C1", "name" => "Return customer"]);
DB::table("sales_representatives")->insert(["id" => 1, "name" => "Rep"]);
DB::table("articles")->insert([
    "id" => 1,
    "code" => "A1",
    "name" => "Full article name",
    "track_serials" => 0,
]);
DB::table("finished_goods_stock")->insert([
    "article_id" => 1,
    "size_label" => "40",
    "quantity" => 5,
]);
DB::table("sales_invoices")->insert([
    "id" => 1,
    "number" => "INV1",
    "customer_id" => 1,
    "sales_rep_id" => 1,
    "invoice_date" => "2026-10-01",
    "due_date" => "2026-10-31",
    "total" => 1000,
    "tax" => 100,
    "received_amount" => 300,
    "outstanding" => 700,
    "status" => "part_paid",
    "is_opening_balance" => 0,
]);
foreach ([["BLACK", 3], ["TAN", 2]] as [$colour, $qty]) {
    DB::table("sales_invoice_lines")->insert([
        "sales_invoice_id" => 1,
        "article_id" => 1,
        "size_label" => "40",
        "colour" => $colour,
        "quantity" => $qty,
        "rate" => 200,
    ]);
}
app(PostingService::class)->post("sales_invoice", 1, "2026-10-01", "Invoice", [
    ["account_code" => "1100", "debit" => 1000, "credit" => 0],
    ["account_code" => "4000", "debit" => 0, "credit" => 900],
    ["account_code" => "2300", "debit" => 0, "credit" => 100],
]);
function ok($value, $label)
{
    if (!$value) {
        throw new RuntimeException($label);
    }
    echo "PASS: $label\n";
}
function rejectReturn($fn, $label)
{
    try {
        $fn();
        throw new RuntimeException("Accepted invalid return: " . $label);
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        ok($e->getStatusCode() === 422, $label);
    } catch (Illuminate\Validation\ValidationException $e) {
        ok(true, $label);
    }
}
$service = app(SalesReturnService::class);
$base = [
    "sales_invoice_id" => 1,
    "return_date" => "2026-11-02",
    "reason" => "Wrong size",
    "request_key" => "first",
    "lines" => [["sales_invoice_line_id" => 1, "quantity" => 1, "condition" => "sellable"]],
];
$id = $service->post($base, 1);
ok(
    (float) DB::table("finished_goods_stock")->value("quantity") === 6.0,
    "One sellable piece increases only the matching article/size stock",
);
$line = DB::table("sales_return_lines")->first();
ok(
    $line->colour === "BLACK" &&
        $line->article_name === "Full article name" &&
        (int) $line->sales_invoice_line_id === 1,
    "Return identifies the original article, colour, size and invoice line",
);
ok(
    (float) DB::table("sales_invoices")->value("outstanding") === 500.0 &&
        (float) $line->total === 200.0 &&
        (float) $line->tax === 20.0,
    "Partial return credits the original proportional price and tax",
);
ok(
    $service->post($base, 1) === $id &&
        DB::table("sales_returns")->count() === 1 &&
        DB::table("finished_goods_movements")->count() === 1,
    "Repeated submission cannot duplicate a return or stock receipt",
);
$damaged = array_merge($base, [
    "request_key" => "damaged",
    "lines" => [["sales_invoice_line_id" => 1, "quantity" => 2, "condition" => "damaged"]],
]);
$service->post($damaged, 1);
ok(
    (float) DB::table("finished_goods_stock")->value("quantity") === 6.0,
    "Damaged pieces are recorded without inflating sellable stock",
);
rejectReturn(
    fn() => $service->post(array_merge($base, ["request_key" => "excess"]), 1),
    "Cumulative returns cannot exceed the sold invoice line quantity",
);
$final = array_merge($base, [
    "request_key" => "final",
    "lines" => [["sales_invoice_line_id" => 2, "quantity" => 2, "condition" => "sellable"]],
]);
$service->post($final, 1);
$invoice = DB::table("sales_invoices")->find(1);
ok(
    (float) $invoice->total === 1000.0 &&
        (float) $invoice->returned_amount === 1000.0 &&
        (float) $invoice->outstanding === 0.0,
    "Repeated partial returns credit exactly the original total without rewriting the invoice",
);
ok(
    max(
        0,
        (float) $invoice->received_amount +
            (float) $invoice->returned_amount -
            (float) $invoice->total,
    ) === 300.0,
    "Paid amounts become visible customer credit; no cash refund is invented",
);
$cashId = DB::table("accounts")->where("code", "1000")->value("id");
ok(
    DB::table("journal_lines")->where("account_id", $cashId)->count() === 0,
    "Sales returns do not create cash movements",
);
$entries = DB::table("journal_lines as l")
    ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
    ->where("j.source_type", "sales_return");
ok(
    (float) (clone $entries)->sum("l.debit") === 1000.0 &&
        (float) (clone $entries)->sum("l.credit") === 1000.0,
    "Return journals balance and reverse the full credit amount",
);
$ledger = (new App\Http\Controllers\Api\SubledgerController())
    ->ledger(
        Illuminate\Http\Request::create("/", "GET", [
            "kind" => "customer",
            "id" => 1,
            "from" => "2026-01-01",
            "to" => "2026-11-02",
        ]),
    )
    ->getData(true);
ok((float) $ledger["closing"] === 0.0, "Customer ledger includes invoice and return credits");
DB::table("sales_invoices")->insert([
    "id" => 2,
    "number" => "INV2",
    "customer_id" => 1,
    "invoice_date" => "2026-10-01",
    "total" => 100,
    "tax" => 0,
    "received_amount" => 0,
    "outstanding" => 100,
    "status" => "unpaid",
    "is_opening_balance" => 0,
]);
DB::table("sales_invoice_lines")->insert([
    "id" => 3,
    "sales_invoice_id" => 2,
    "article_id" => 1,
    "size_label" => "40",
    "quantity" => 1,
    "rate" => 100,
]);
app(PostingService::class)->post("sales_invoice", 2, "2026-10-01", "Invoice 2", [
    ["account_code" => "1100", "debit" => 100, "credit" => 0],
    ["account_code" => "4000", "debit" => 0, "credit" => 100],
]);
$beforeStock = DB::table("finished_goods_stock")->value("quantity");
$beforeCount = DB::table("sales_returns")->count();
DB::table("accounting_periods")->update(["status" => "closed"]);
rejectReturn(
    fn() => $service->post(
        array_merge($base, [
            "sales_invoice_id" => 2,
            "request_key" => "closed",
            "lines" => [["sales_invoice_line_id" => 3, "quantity" => 1, "condition" => "sellable"]],
        ]),
        1,
    ),
    "Closed accounting period rejects the return",
);
ok(
    DB::table("sales_returns")->count() === $beforeCount &&
        DB::table("finished_goods_stock")->value("quantity") === $beforeStock,
    "Failed posting rolls back the return and stock atomically",
);
DB::table("accounting_periods")->update(["status" => "open"]);
DB::table("accounts")
    ->where("code", "4050")
    ->update(["is_active" => 0]);
rejectReturn(
    fn() => $service->post(
        array_merge($base, [
            "sales_invoice_id" => 2,
            "request_key" => "inactive-account",
            "lines" => [["sales_invoice_line_id" => 3, "quantity" => 1, "condition" => "sellable"]],
        ]),
        1,
    ),
    "Unavailable posting account rejects the return after stock preparation",
);
ok(
    DB::table("sales_returns")->count() === $beforeCount &&
        DB::table("finished_goods_stock")->value("quantity") === $beforeStock,
    "Accounting failure rolls back prepared stock movements and return lines",
);
DB::table("accounts")
    ->where("code", "4050")
    ->update(["is_active" => 1]);

DB::table("articles")
    ->where("id", 1)
    ->update(["track_serials" => 1]);
DB::table("product_serials")->insert([
    "id" => 1,
    "serial_number" => "SERIAL1",
    "sales_invoice_id" => 2,
    "article_id" => 1,
    "size_label" => "40",
    "status" => "sold",
]);
$serialRequest = array_merge($base, [
    "sales_invoice_id" => 2,
    "request_key" => "serial",
    "lines" => [
        [
            "sales_invoice_line_id" => 3,
            "quantity" => 1,
            "condition" => "sellable",
            "serial_ids" => [],
        ],
    ],
]);
rejectReturn(
    fn() => $service->post($serialRequest, 1),
    "Serialized pieces require explicit original serial identification",
);
$serialRequest["lines"][0]["serial_ids"] = [1];
$service->post($serialRequest, 1);
ok(
    DB::table("product_serials")->value("status") === "available" &&
        DB::table("product_serials")->value("sales_invoice_id") === null,
    "Returned sellable serial becomes available with its original return history retained",
);
$shares = $service->shares(
    100,
    collect([
        (object) ["id" => 10, "quantity" => 3, "rate" => 1],
        (object) ["id" => 11, "quantity" => 3, "rate" => 1],
        (object) ["id" => 12, "quantity" => 3, "rate" => 1],
    ]),
);
ok(array_sum($shares) === 100, "Cent allocation preserves the exact invoice amount");

// Verify the same credits in customer profile, aging and dated subledger views.
foreach (
    [
        "customer_receipts" => [
            "payment_account_id",
            "collector_sales_rep_id",
            "receipt_date",
            "amount",
            "status",
            "collection_type",
        ],
        "warranty_claims" => ["claim_date"],
    ]
    as $table => $columns
) {
    Schema::table($table, function ($t) use ($columns) {
        foreach ($columns as $column) {
            $t->string($column)->nullable();
        }
    });
}
foreach (
    [
        "receipt_allocations" => ["receipt_id", "invoice_id", "amount"],
        "customer_pos" => [
            "customer_id",
            "sales_rep_id",
            "po_date",
            "number",
            "customer_po_reference",
        ],
        "customer_po_lines" => ["customer_po_id", "article_id"],
        "sales_orders" => ["customer_id", "customer_po_id", "order_date"],
        "sales_order_size_lines" => ["sales_order_id", "article_id"],
        "customer_opening_balances" => ["invoice_id", "balance_date"],
    ]
    as $table => $columns
) {
    Schema::create($table, function ($t) use ($columns) {
        $t->id();
        foreach ($columns as $column) {
            $t->string($column)->nullable();
        }
    });
}
DB::table("customer_receipts")->insert([
    "id" => 1,
    "number" => "REC1",
    "customer_id" => 1,
    "receipt_date" => "2026-10-02",
    "amount" => 300,
    "status" => "posted",
]);
DB::table("receipt_allocations")->insert(["receipt_id" => 1, "invoice_id" => 1, "amount" => 300]);
app(PostingService::class)->post("customer_receipt", 1, "2026-10-02", "Payment", [
    ["account_code" => "1000", "debit" => 300, "credit" => 0],
    ["account_code" => "1100", "debit" => 0, "credit" => 300],
]);
$profile = app(App\Services\Reporting\CustomerProfileService::class)->profile(1, "2026-11-02");
ok(
    (float) $profile["summary"]["customer_credit"] === 300.0 &&
        (float) $profile["summary"]["ledger_difference"] === 0.0,
    "Customer profile reconciles paid return credit to the receivables ledger",
);
ok(
    count($profile["sales_returns"]) === 4 &&
        (float) $profile["summary"]["sales_returns"] === 1100.0,
    "Customer profile exposes every posted return credit",
);
$prior = app(App\Services\Reporting\CustomerProfileService::class)->profile(1, "2026-11-01");
ok(
    (float) $prior["summary"]["outstanding"] === 800.0 &&
        (float) $prior["summary"]["sales_returns"] === 0.0,
    "Historical profile excludes returns posted after the selected date",
);
$aging = (new App\Http\Controllers\Api\SalesController())
    ->aging(Illuminate\Http\Request::create("/", "GET", ["as_of" => "2026-11-01"]))
    ->getData(true);
ok(
    (float) $aging["total"] === 800.0,
    "Aging before the return preserves the original unpaid balance",
);
