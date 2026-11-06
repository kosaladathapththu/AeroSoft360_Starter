<?php
// This fixture uses SQLite memory only. No business database writes or migrations.
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
use Carbon\Carbon;
use App\Services\Reporting\DashboardService;
Carbon::setTestNow(Carbon::parse("2026-11-03 12:00:00", "Asia/Colombo"));
$tables = [
    "customers" => ["code", "name", "status"],
    "sales_invoices" => [
        "number",
        "customer_id",
        "invoice_date",
        "due_date",
        "status",
        "is_opening_balance",
        "total",
        "outstanding",
    ],
    "customer_opening_balances" => ["invoice_id", "balance_date"],
    "customer_receipts" => [
        "number",
        "customer_id",
        "receipt_date",
        "status",
        "is_opening_balance",
        "amount",
    ],
    "receipt_allocations" => ["invoice_id", "receipt_id", "amount"],
    "sales_returns" => ["sales_invoice_id", "return_date", "total"],
    "sales_orders" => ["order_date", "status"],
    "sales_order_size_lines" => ["sales_order_id", "quantity", "invoiced_quantity"],
    "accounts" => ["code", "type", "is_postable", "is_cash_account", "is_active"],
    "journal_entries" => ["posting_date", "status"],
    "journal_lines" => ["journal_entry_id", "account_id", "debit", "credit"],
    "suppliers" => ["code", "name", "payment_days"],
    "goods_receipts" => [
        "number",
        "supplier_id",
        "supplier_invoice",
        "received_on",
        "total",
        "status",
    ],
    "supplier_invoices" => ["goods_receipt_id", "invoice_date", "due_date"],
    "payment_vouchers" => [
        "goods_receipt_id",
        "journal_id",
        "payment_date",
        "status",
        "void_date",
        "total",
    ],
    "purchase_returns" => [
        "goods_receipt_id",
        "journal_id",
        "return_date",
        "status",
        "void_date",
        "total",
    ],
    "purchase_orders" => ["order_date", "status"],
    "articles" => ["code", "name", "status"],
    "article_set_templates" => ["article_id", "status"],
    "article_set_items" => ["set_template_id", "size_label"],
    "finished_goods_stock" => ["article_id", "size_label", "quantity"],
];
foreach ($tables as $name => $columns) {
    Schema::create($name, function ($t) use ($columns) {
        $t->id();
        foreach ($columns as $column) {
            if (
                in_array($column, [
                    "quantity",
                    "invoiced_quantity",
                    "total",
                    "amount",
                    "outstanding",
                    "debit",
                    "credit",
                ])
            ) {
                $t->decimal($column, 18, 2)->nullable();
            } else {
                $t->string($column)->nullable();
            }
        }
    });
}
$insert = fn($table, $values) => DB::table($table)->insertGetId($values);
$customer = $insert("customers", ["code" => "C1", "name" => "Real customer", "status" => "active"]);
$invoice = function (
    $number,
    $total,
    $date,
    $due = null,
    $opening = false,
    $status = "unpaid",
) use ($insert, $customer) {
    return $insert("sales_invoices", [
        "number" => $number,
        "customer_id" => $customer,
        "total" => $total,
        "invoice_date" => $date,
        "due_date" => $due,
        "is_opening_balance" => (int) $opening,
        "status" => $status,
        "outstanding" => 99999,
    ]);
};
$opening = $invoice("OPEN", 1000, "2025-01-01", null, true);
$sale = $invoice("SALE1", 600, "2026-11-01", "2026-11-02");
$invoice("SALE2", 300, "2026-11-03", "2026-11-03");
$invoice("VOID", 400, "2026-11-02", null, false, "void");
$invoice("FUTURE", 200, "2026-11-04");
$futureOpening = $invoice("LATER-OPEN", 2000, "2025-01-01", null, true);
$insert("customer_opening_balances", [
    "invoice_id" => $futureOpening,
    "balance_date" => "2026-11-04",
]);
$old = $invoice("OLD", 200, "2026-08-01", "2026-08-10");
$receipt = function (
    $number,
    $amount,
    $date,
    $invoiceId,
    $status = "posted",
    $isOpening = false,
) use ($insert, $customer) {
    $id = $insert("customer_receipts", [
        "number" => $number,
        "customer_id" => $customer,
        "receipt_date" => $date,
        "status" => $status,
        "is_opening_balance" => (int) $isOpening,
        "amount" => $amount,
    ]);
    if ($invoiceId) {
        $insert("receipt_allocations", [
            "receipt_id" => $id,
            "invoice_id" => $invoiceId,
            "amount" => $amount,
        ]);
    }
};
$receipt("R1", 200, "2026-11-02", $opening);
$receipt("R2", 100, "2026-11-03", $sale);
$receipt("FUTURE-R", 50, "2026-11-04", $sale);
$receipt("DRAFT-R", 70, "2026-11-03", $sale, "draft");
$receipt("OPEN-CREDIT", 999, "2026-11-02", null, "posted", true);
$receipt("OLD-R", 25, "2026-08-11", $old);
$insert("sales_returns", [
    "sales_invoice_id" => $opening,
    "return_date" => "2026-11-03",
    "total" => 100,
]);
$insert("sales_returns", [
    "sales_invoice_id" => $sale,
    "return_date" => "2026-11-04",
    "total" => 40,
]);
$order = $insert("sales_orders", ["order_date" => "2026-11-01", "status" => "part_invoiced"]);
$insert("sales_order_size_lines", [
    "sales_order_id" => $order,
    "quantity" => 10,
    "invoiced_quantity" => 4,
]);
$cancelled = $insert("sales_orders", ["order_date" => "2026-11-01", "status" => "cancelled"]);
$insert("sales_order_size_lines", [
    "sales_order_id" => $cancelled,
    "quantity" => 9,
    "invoiced_quantity" => 0,
]);
$account = $insert("accounts", [
    "code" => "1000",
    "type" => "asset",
    "is_postable" => 1,
    "is_cash_account" => 1,
    "is_active" => 1,
]);
foreach (
    [
        ["2026-11-03", "posted", 500, 20],
        ["2026-11-03", "draft", 100, 0],
        ["2026-11-04", "posted", 100, 0],
    ]
    as [$date, $status, $debit, $credit]
) {
    $j = $insert("journal_entries", ["posting_date" => $date, "status" => $status]);
    $insert("journal_lines", [
        "journal_entry_id" => $j,
        "account_id" => $account,
        "debit" => $debit,
        "credit" => $credit,
    ]);
}
$supplier = $insert("suppliers", ["code" => "S1", "name" => "Supplier", "payment_days" => 10]);
$grn = $insert("goods_receipts", [
    "number" => "GRN1",
    "supplier_id" => $supplier,
    "total" => 400,
    "received_on" => "2026-11-01",
    "status" => "posted",
]);
$insert("goods_receipts", [
    "number" => "GRN2",
    "supplier_id" => $supplier,
    "total" => 80,
    "received_on" => "2026-11-01",
    "status" => "posted",
]);
$insert("supplier_invoices", [
    "goods_receipt_id" => $grn,
    "invoice_date" => "2026-11-01",
    "due_date" => "2026-11-02",
]);
$insert("payment_vouchers", [
    "goods_receipt_id" => $grn,
    "journal_id" => 1,
    "payment_date" => "2026-11-02",
    "status" => "posted",
    "total" => 100,
]);
$insert("purchase_returns", [
    "goods_receipt_id" => $grn,
    "journal_id" => 1,
    "return_date" => "2026-11-03",
    "status" => "posted",
    "total" => 50,
]);
foreach (["draft", "approved", "part_received", "cancelled"] as $status) {
    $insert("purchase_orders", ["order_date" => "2026-11-01", "status" => $status]);
}
$article = $insert("articles", ["code" => "A1", "name" => "Sandal", "status" => "active"]);
$template = $insert("article_set_templates", ["article_id" => $article, "status" => "active"]);
foreach ([40, 41, 42, 43, 40] as $size) {
    $insert("article_set_items", ["set_template_id" => $template, "size_label" => $size]);
}
foreach ([[40, 2], [41, 0], [42, 20]] as [$size, $quantity]) {
    $insert("finished_goods_stock", [
        "article_id" => $article,
        "size_label" => $size,
        "quantity" => $quantity,
    ]);
}
$inactive = $insert("article_set_templates", ["article_id" => $article, "status" => "inactive"]);
$insert("article_set_items", ["set_template_id" => $inactive, "size_label" => 44]);
$before = DB::table("sales_invoices")->get()->toJson();
$data = (new DashboardService())->report(30);
$checks = 0;
$check = function ($condition, $label) use (&$checks) {
    if (!$condition) {
        throw new RuntimeException($label);
    }
    $checks++;
    echo "PASS $label\n";
};
$check(
    $data["outstanding_total"] == 1675,
    "AR uses dated receipts and credits rather than cached balances",
);
$check(
    $data["opening_receivables_total"] == 700 && $data["sales_receivables_total"] == 975,
    "Opening and sales receivables are separate",
);
$check(
    $data["period_sales"] == 900 && $data["period_invoice_count"] === 2,
    "Opening, void and future documents are excluded from period sales",
);
$check(
    $data["collections_total"] == 300,
    "Collections exclude draft, future and opening credit documents",
);
$check(
    $data["overdue_count"] === 2 && $data["overdue_total"] == 675,
    "Due today is current and old dated debt is overdue",
);
$check(
    $data["terms_missing_count"] === 1 && $data["aging"]["terms_not_set"] == 700,
    "Unknown terms are never invented or marked overdue",
);
$check(
    array_sum($data["aging"]) == $data["outstanding_total"],
    "Aging bands reconcile to receivables",
);
$check($data["cash_balance"] == 480, "Cash uses posted journals through today");
$check(
    $data["dispatch_count"] === 1 && $data["dispatch_pieces"] === 6,
    "Dispatch counts remaining pieces, excluding cancelled orders",
);
$check(
    $data["supplier_payables"] == 330 && $data["supplier_overdue_count"] === 1,
    "Payables reflect supplier payments and returns",
);
$check(
    $data["unbilled_receipts"] === 1 &&
        $data["draft_purchase_orders"] === 1 &&
        $data["awaiting_goods"] === 2,
    "Purchasing tasks follow actual document stages",
);
$check(
    $data["stock"] === [
        "pieces" => 22.0,
        "low" => 1,
        "out" => 1,
        "unrecorded" => 1,
        "threshold" => 5,
        "variants" => 4,
    ],
    "Stock distinguishes low, zero and unrecorded sizes without duplicate templates",
);
$check(
    count($data["trend"]) === 30 && $data["period"]["from"] === "2026-10-05",
    "Thirty-day window is inclusive of today",
);
$check(
    collect($data["trend"])->sum("sales") == 900 &&
        collect($data["trend"])->sum("collections") == 300,
    "Chart totals match KPI values",
);
$check(
    $data["period_return_credits"] == 100,
    "Future returns do not affect current period credits",
);
$check(
    count($data["recent_invoices"]) === 2 && count($data["recent_receipts"]) === 2,
    "Recent activity uses the same period and document exclusions",
);
$check(
    $data["top_customers"][0]["outstanding"] == 1675,
    "Priority customer amount reconciles to the same receivables basis",
);
$check(
    (new DashboardService())->report(7)["period"]["from"] === "2026-10-28",
    "Seven-day preset uses an inclusive business-date window",
);
$check(
    (new \App\Http\Controllers\Api\AccountingSalesController())
        ->dashboard(\Illuminate\Http\Request::create("/", "GET", ["days" => 90]))
        ->getData(true)["period"]["days"] === 90,
    "Dashboard endpoint accepts the supported ninety-day preset",
);
try {
    (new \App\Http\Controllers\Api\AccountingSalesController())->dashboard(
        \Illuminate\Http\Request::create("/", "GET", ["days" => 8]),
    );
    throw new RuntimeException("Unsupported period was accepted");
} catch (\Illuminate\Validation\ValidationException $e) {
    $check(true, "Dashboard endpoint rejects unsupported periods");
}
$check(
    DB::table("sales_invoices")->get()->toJson() === $before,
    "Dashboard never mutates source data",
);
echo "$checks dashboard checks passed.\n";
