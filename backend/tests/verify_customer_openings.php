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

foreach (
    [
        "customers" => ["tin", "phone", "address", "status", "created_at", "updated_at"],
        "accounts" => ["type", "is_postable", "is_active", "is_cash_account"],
        "sales_invoices" => [
            "sale_type",
            "subtotal",
            "discount",
            "tax",
            "received_amount",
            "outstanding",
            "created_at",
            "updated_at",
        ],
        "customer_receipts" => [
            "sales_rep_id",
            "collection_type",
            "payment_method",
            "reference",
            "created_at",
            "updated_at",
        ],
        "journal_entries" => ["accounting_period_id", "posted_at", "created_at", "updated_at"],
        "journal_lines" => ["description", "created_at", "updated_at"],
    ]
    as $table => $columns
) {
    Schema::table($table, function ($t) use ($columns) {
        foreach ($columns as $column) {
            $t->string($column)->nullable();
        }
    });
}
Schema::create("accounting_periods", function ($t) {
    $t->id();
    $t->date("starts_on");
    $t->date("ends_on");
    $t->string("status");
});
DB::table("accounting_periods")->insert([
    "starts_on" => "2026-01-01",
    "ends_on" => "2026-12-31",
    "status" => "open",
]);
foreach (
    [
        ["1100", "Receivable", "asset"],
        ["3990", "Opening Equity", "equity"],
        ["1000", "Cash", "asset"],
    ]
    as [$code, $name, $type]
) {
    DB::table("accounts")->insert([
        "code" => $code,
        "name" => $name,
        "type" => $type,
        "is_postable" => 1,
        "is_active" => 1,
        "is_cash_account" => $code === "1000" ? 1 : 0,
    ]);
}
foreach (["sales_invoices", "customer_receipts"] as $table) {
    Schema::table($table, function ($t) {
        $t->boolean("is_opening_balance")->default(false);
    });
}
Schema::create("customer_opening_balances", function ($t) {
    $t->id();
    $t->integer("customer_id")->unique();
    $t->decimal("amount", 18, 2);
    $t->date("balance_date");
    $t->date("due_date")->nullable();
    $t->integer("offset_account_id");
    $t->integer("invoice_id")->nullable();
    $t->integer("receipt_id")->nullable();
    $t->integer("journal_id");
    $t->timestamps();
});
function createCustomer($code, $extra = [])
{
    return (new App\Http\Controllers\Api\SalesController())
        ->storeCustomer(
            Illuminate\Http\Request::create(
                "/",
                "POST",
                array_merge(
                    [
                        "code" => $code,
                        "name" => "Opening customer",
                        "credit_days" => 30,
                        "credit_limit" => 1000,
                    ],
                    $extra,
                ),
            ),
        )
        ->getData(true);
}
$c = createCustomer("C1", [
    "opening_balance" => 500,
    "opening_type" => "receivable",
    "opening_date" => "2026-10-01",
    "opening_due_date" => "2026-09-01",
]);
$p = (new CustomerProfileService())->profile($c["id"], "2026-10-29");
check(
    $p["summary"]["outstanding"] == 500 && $p["summary"]["overdue"] == 500,
    "Opening receivable appears in aging",
);
check(
    $p["summary"]["total_invoiced"] == 0 && $p["summary"]["opening_receivable"] == 500,
    "Opening receivable is not sales turnover",
);
check(
    $p["summary"]["ledger_balance"] == 500 && $p["summary"]["ledger_difference"] == 0,
    "Opening receivable reconciles to posted customer ledger",
);
$before = (new CustomerProfileService())->profile($c["id"], "2026-09-30");
check(
    $before["summary"]["outstanding"] == 0,
    "Opening balance is excluded before its balance date",
);
$c2 = createCustomer("C2", [
    "opening_balance" => 75,
    "opening_type" => "credit",
    "opening_date" => "2026-10-01",
]);
$p = (new CustomerProfileService())->profile($c2["id"], "2026-10-29");
check(
    $p["summary"]["customer_credit"] == 75 && $p["summary"]["net_balance"] == -75,
    "Opening customer credit reduces net receivables",
);
check(
    $p["summary"]["total_received"] == 0 && $p["summary"]["ledger_balance"] == -75,
    "Opening credit is not cash received and reconciles to ledger",
);
check(
    DB::table("journal_lines")
        ->join("accounts", "accounts.id", "=", "journal_lines.account_id")
        ->where("accounts.code", "1000")
        ->count() === 0,
    "Opening entries never change cash",
);
$c3 = createCustomer("C3");
check(
    DB::table("customer_opening_balances")->count() === 2,
    "Zero opening does not post a journal",
);
try {
    createCustomer("BAD", ["opening_balance" => 25, "opening_date" => "2025-01-01"]);
    check(false, "Closed period must fail");
} catch (Illuminate\Validation\ValidationException $e) {
    check(
        !DB::table("customers")->where("code", "BAD")->exists(),
        "Unavailable period rolls back customer and opening documents",
    );
}
try {
    createCustomer("BAD2", [
        "opening_balance" => 25,
        "opening_date" => "2026-01-01",
        "opening_account_id" => DB::table("accounts")->where("code", "1000")->value("id"),
    ]);
    check(false, "Cash offset must fail");
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    check(
        !DB::table("customers")->where("code", "BAD2")->exists(),
        "Cash account cannot be used as opening equity offset",
    );
}

$controller = new App\Http\Controllers\Api\AccountOpeningController();
$cashId = DB::table("accounts")->where("code", "1000")->value("id");
$openingRequest = Illuminate\Http\Request::create("/", "POST", [
    "amount" => 1000,
    "side" => "debit",
    "balance_date" => "2026-01-01",
    "reason" => "Previous ledger closing",
]);
$controller->store($openingRequest, $cashId, new App\Services\Accounting\PostingService());
$cashFlow = (new App\Services\Reporting\CashFlowService())->report("2026-01-01", "2026-10-29");
check(
    $cashFlow["opening_balance"] == 1000 &&
        $cashFlow["closing_balance"] == 1000 &&
        $cashFlow["net_change"] == 0,
    "Cash brought forward is opening cash, not an operating inflow",
);
try {
    $controller->store($openingRequest, $cashId, new App\Services\Accounting\PostingService());
    check(false, "Duplicate opening must fail");
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    check($e->getStatusCode() === 422, "Account opening cannot be posted twice");
}
try {
    $controller->store(
        $openingRequest,
        DB::table("accounts")->where("code", "1100")->value("id"),
        new App\Services\Accounting\PostingService(),
    );
    check(false, "Direct receivable must fail");
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    check(
        $e->getStatusCode() === 422,
        "Receivable control balances must come from customer accounts",
    );
}

Schema::table("sales_representatives", function ($t) {
    $t->decimal("default_commission_rate", 18, 2)->default(10);
});
Schema::table("sales_invoice_lines", function ($t) {
    $t->decimal("quantity", 18, 2)->nullable();
});
Schema::table("receipt_allocations", function ($t) {
    foreach (
        [
            "commission_payee_sales_rep_id",
            "days_taken",
            "commission_pieces",
            "commission_rate",
            "commission_amount",
            "commission_status",
            "commission_decision",
            "created_at",
            "updated_at",
        ]
        as $col
    ) {
        $t->string($col)->nullable();
    }
});
Schema::create("commission_settings", function ($t) {
    $t->id();
    $t->integer("max_collection_days");
});
Schema::create("audit_logs", function ($t) {
    $t->id();
    foreach (["event", "entity_type", "entity_id", "payload", "created_at"] as $col) {
        $t->string($col)->nullable();
    }
});
DB::table("sales_representatives")->insert([
    "id" => 1,
    "name" => "Collector",
    "default_commission_rate" => 10,
]);
$invoice = DB::table("sales_invoices")->where("customer_id", $c["id"])->first();
$payment = Illuminate\Http\Request::create("/", "POST", [
    "invoice_id" => $invoice->id,
    "collector_sales_rep_id" => 1,
    "receipt_date" => "2026-10-20",
    "collection_type" => "partial",
    "payment_method" => "cash",
    "payment_account_id" => $cashId,
    "commission_decision" => "invoice_salesperson",
    "amount" => 200,
]);
$result = (new App\Http\Controllers\Api\AccountingSalesController())
    ->receipt(
        $payment,
        new App\Http\Controllers\Api\SalesController(),
        new App\Services\Accounting\PostingService(),
    )
    ->getData(true);
check(
    $result["commission"] == 0 && $result["commission_decision"] === "cancel",
    "Opening receivable collections do not earn sales commission",
);
$p = (new CustomerProfileService())->profile($c["id"], "2026-10-29");
check(
    $p["summary"]["outstanding"] == 300 &&
        $p["summary"]["total_received"] == 200 &&
        $p["summary"]["ledger_difference"] == 0,
    "A normal collection settles the opening balance and keeps aging and ledger reconciled",
);
