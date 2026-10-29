<?php
// All checks use SQLite in memory and never alter business data.
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
use App\Services\Procurement\PurchaseReturnService;
use App\Http\Controllers\Api\BusinessWorkflowController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\SubledgerController;
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
function req($data = [], $method = "POST")
{
    return Request::create("/", $method, $data);
}
$migration = require __DIR__ .
    "/../database/migrations/2026_10_13_000001_create_procure_to_stock_foundation.php";
$migration->up();
$tables = [
    "customers" => [
        "code",
        "name",
        "phone",
        "address",
        "credit_days",
        "credit_limit",
        "status",
        "created_at",
        "updated_at",
    ],
    "sales_representatives" => ["name"],
    "article_set_templates" => ["article_id"],
    "article_set_items" => ["set_template_id", "size_label", "quantity", "unit_price"],
    "customer_pos" => [
        "number",
        "customer_id",
        "sales_rep_id",
        "customer_po_reference",
        "po_date",
        "sale_type",
        "status",
        "total",
        "cash_amount",
        "credit_amount",
        "created_at",
        "updated_at",
    ],
    "customer_po_lines" => ["fixed_rate", "custom_rate", "fixed_rates",
        "customer_po_id",
        "article_id",
        "colour",
        "order_mode",
        "set_template_id",
        "set_item_id",
        "sets",
        "pieces",
        "rate",
        "line_total",
        "created_at",
        "updated_at",
    ],
    "sales_orders" => [
        "number",
        "customer_po_id",
        "customer_id",
        "sales_rep_id",
        "order_date",
        "status",
        "total",
        "created_at",
        "updated_at",
    ],
    "sales_order_size_lines" => ["fixed_rate",
        "sales_order_id",
        "article_id",
        "size_label",
        "colour",
        "quantity",
        "invoiced_quantity",
        "rate",
        "created_at",
        "updated_at",
    ],
    "audit_logs" => ["event", "entity_type", "entity_id", "payload", "created_at"],
];
unset($tables["audit_logs"]);
$tables["articles"] = ["code", "name", "category", "status", "created_at", "updated_at"];
$tables["sales_representatives"] = ["name", "code", "status", "default_commission_rate"];
$tables["article_set_items"][] = "sort_order";
$tables["customer_receipts"] = [
    "number",
    "customer_id",
    "sales_rep_id",
    "collector_sales_rep_id",
    "receipt_date",
    "collection_type",
    "payment_method",
    "reference",
    "amount",
    "status",
    "created_at",
    "updated_at",
];
$tables["receipt_allocations"] = [
    "receipt_id",
    "invoice_id",
    "commission_payee_sales_rep_id",
    "amount",
    "days_taken",
    "commission_pieces",
    "commission_rate",
    "commission_amount",
    "commission_status",
    "commission_decision",
    "created_at",
    "updated_at",
];
$tables["commission_settings"] = ["max_collection_days"];
$tables["sales_invoices"] = [
    "number",
    "customer_id",
    "sales_order_id",
    "sales_rep_id",
    "invoice_date",
    "due_date",
    "sale_type",
    "status",
    "subtotal",
    "discount",
    "other_deduction",
    "other_deduction_description",
    "deduction_adjustments",
    "tax_type",
    "tax_rate",
    "tax",
    "other_charges",
    "other_charges_description",
    "charge_adjustments",
    "total",
    "received_amount",
    "outstanding",
    "created_at",
    "updated_at",
];
$tables["sales_invoice_lines"] = ["fixed_rate",
    "sales_invoice_id",
    "sales_order_size_line_id",
    "article_id",
    "size_label",
    "colour",
    "quantity",
    "rate",
    "line_total",
    "created_at",
    "updated_at",
];
$tables["finished_goods_stock"] = [
    "article_id",
    "size_label",
    "quantity",
    "created_at",
    "updated_at",
];
$tables["finished_goods_movements"] = [
    "article_id",
    "size_label",
    "movement_type",
    "quantity",
    "source_type",
    "source_id",
    "event_key",
    "occurred_at",
    "created_at",
    "updated_at",
];
foreach ($tables as $name => $columns) {
    Schema::create($name, function ($t) use ($columns) {
        $t->id();
        foreach ($columns as $column) {
            $t->string($column)->nullable();
        }
    });
}
$migration = require __DIR__ .
    "/../database/migrations/2026_10_13_000003_create_payroll_and_reporting.php";
$migration->up();
$migration = require __DIR__ .
    "/../database/migrations/2026_10_17_000017_add_payment_status_to_payroll_items.php";
$migration->up();
$migration = require __DIR__ .
    "/../database/migrations/2026_10_17_000013_create_stock_adjustments.php";
$migration->up();
DB::table("accounts")->insertOrIgnore(
    array_map(
        fn($a) => ["code" => $a[0], "name" => $a[0], "type" => $a[1], "is_postable" => true],
        [
            ["1000", "asset"],
            ["1100", "asset"],
            ["1300", "asset"],
            ["2100", "liability"],
            ["2250", "liability"],
            ["3000", "equity"],
            ["4000", "income"],
            ["5000", "expense"],
            ["5100", "expense"],
            ["5400", "expense"],
        ],
    ),
);
$migration = require __DIR__ .
    "/../database/migrations/2026_10_28_000001_create_payment_vouchers.php";
$migration->up();
$migration = require __DIR__ .
    "/../database/migrations/2026_10_28_000002_add_chart_of_accounts_controls.php";
$migration->up();
DB::table("articles")->insert([
    "id" => 1,
    "code" => "SHOE-1",
    "name" => "Shoe",
    "category" => "Shoes",
    "status" => "active",
]);
DB::table("materials")->insert([
    "id" => 1,
    "code" => "RAW-1",
    "name" => "Rubber",
    "category" => "Rubber",
    "unit" => "kg",
    "active" => true,
]);
$migration = require __DIR__ .
    "/../database/migrations/2026_10_28_000003_add_connected_business_workflows.php";
$migration->up();
DB::table("accounting_periods")->insert([
    ["name" => "2026", "starts_on" => "2026-01-01", "ends_on" => "2026-12-31", "status" => "open"],
    [
        "name" => "2027",
        "starts_on" => "2027-01-01",
        "ends_on" => "2027-12-31",
        "status" => "closed",
    ],
]);
DB::table("customers")->insert([
    "id" => 1,
    "code" => "CUS-1",
    "name" => "Customer",
    "status" => "active",
]);
DB::table("sales_representatives")->insert([
    "id" => 1,
    "code" => "REP-1",
    "name" => "Salesperson",
    "status" => "active",
    "default_commission_rate" => 0,
]);
DB::table("article_set_templates")->insert(["id" => 1, "article_id" => 1]);
DB::table("article_set_items")->insert([
    "id" => 1,
    "set_template_id" => 1,
    "size_label" => "40",
    "quantity" => 2,
    "unit_price" => 100,
    "sort_order" => 1,
]);
$migration = require __DIR__ .
    "/../database/migrations/2026_10_28_000004_add_serials_and_warranties.php";
$migration->up();
$migration = require __DIR__ .
    "/../database/migrations/2026_10_28_000005_add_point_of_sale_checkouts.php";
$migration->up();
$quotes = new QuotationController();
$business = new BusinessWorkflowController();
$ledger = new SubledgerController();
$posting = new PostingService();
$quote = [
    "customer_id" => 1,
    "sales_rep_id" => 1,
    "quotation_date" => "2026-10-01",
    "valid_until" => "2026-10-31",
    "sale_type" => "credit",
    "notes" => "Offer",
    "lines" => [["set_item_id" => 1, "quantity" => 3, "rate" => 90, "colour" => "BROWN"]],
];
$qid = $quotes->store(req($quote))->getData(true)["id"];
check(
    DB::table("sales_orders")->count() === 0 && DB::table("journal_entries")->count() === 0,
    "quotation does not post stock, order or accounting",
);
rejects(fn() => $quotes->update(req($quote, "PUT"), $qid), "quotation edit needs a reason");
$quotes->update(req($quote + ["reason" => "Negotiated price"], "PUT"), $qid);
rejects(
    fn() => $quotes->convert(req(["order_date" => "2026-11-01"]), $qid),
    "expired quote cannot convert",
);
check(DB::table("customer_pos")->count() === 0, "failed conversion creates no PO");
DB::table("article_set_items")
    ->where("id", 1)
    ->update(["unit_price" => 120]);
$so = $quotes->convert(req(["order_date" => "2026-10-20"]), $qid)->getData(true)["sales_order_id"];
check(
    (float) DB::table("sales_orders")->where("id", $so)->value("total") === 270.0 &&
        (float) DB::table("sales_order_size_lines")->where("sales_order_id", $so)->value("rate") ===
            90.0,
    "conversion preserves quoted price despite catalog price change",
);
$quotes->convert(req(["order_date" => "2026-10-20"]), $qid);
check(
    DB::table("sales_orders")->count() === 1 && DB::table("customer_pos")->count() === 1,
    "quotation converts once with a traceable customer PO",
);
rejects(
    fn() => $quotes->update(req($quote + ["reason" => "Late edit"], "PUT"), $qid),
    "converted quotation is locked",
);
check(
    $quotes->index()->getData(true)["quotations"][0]["sales_order"] !== null,
    "quotation list includes its sales order reference",
);

DB::table("suppliers")->insert([
    "id" => 1,
    "code" => "SUP-1",
    "name" => "Supplier",
    "payment_days" => 30,
    "status" => "active",
]);
$po = DB::table("purchase_orders")->insertGetId([
    "number" => "PO-1",
    "supplier_id" => 1,
    "order_date" => "2026-10-01",
    "status" => "approved",
    "total" => 1000,
]);
$pol = DB::table("purchase_order_lines")->insertGetId([
    "purchase_order_id" => $po,
    "material_id" => 1,
    "quantity" => 10,
    "received_quantity" => 0,
    "unit_cost" => 100,
    "line_total" => 1000,
]);
$grn = (new App\Services\Procurement\GoodsReceiptService($posting))->receive($po, [
    "received_on" => "2026-10-02",
    "supplier_invoice" => null,
    "lines" => [["purchase_order_line_id" => $pol, "batch_number" => "B1", "quantity" => 10]],
]);
$gid = $grn["id"];
$gl = DB::table("goods_receipt_lines")->value("id");
$journalCount = DB::table("journal_entries")->count();
$business->supplierInvoice(
    req([
        "goods_receipt_id" => $gid,
        "invoice_number" => "SUP-INV-1",
        "invoice_date" => "2026-10-03",
        "due_date" => "2026-10-10",
    ]),
);
check(
    DB::table("journal_entries")->count() === $journalCount,
    "supplier invoice registration does not double-post GRN liability",
);
rejects(
    fn() => $business->supplierInvoice(
        req([
            "goods_receipt_id" => $gid,
            "invoice_number" => "SUP-INV-2",
            "invoice_date" => "2026-10-03",
            "due_date" => "2026-10-10",
        ]),
    ),
    "one supplier invoice per goods receipt",
);
$aging = new App\Services\Reporting\AgingReportService();
check(
    $aging->report("2026-10-20")["rows"][0]["due_date"] === "2026-10-10",
    "supplier invoice due date feeds aging",
);
$returns = new PurchaseReturnService($posting);
$return = [
    "goods_receipt_id" => $gid,
    "return_date" => "2026-10-12",
    "reason" => "Damaged rubber",
    "lines" => [["goods_receipt_line_id" => $gl, "quantity" => 2]],
];
$rid = $returns->post($return, 1);
check(
    (float) DB::table("stock_balances")->value("quantity") === 8.0 &&
        $aging->report("2026-10-20")["totals"]["total"] === 800.0,
    "return reduces batch stock and supplier outstanding",
);
check(
    $aging->report("2026-10-10")["totals"]["total"] === 1000.0,
    "historical aging excludes later returns",
);
$bad = $return;
$bad["lines"][0]["quantity"] = 9;
rejects(fn() => $returns->post($bad, 1), "return cannot exceed remaining receipt quantity");
check(
    (float) DB::table("stock_balances")->value("quantity") === 8.0,
    "rejected return leaves stock unchanged",
);
$bad = $return;
$bad["lines"][] = $bad["lines"][0];
rejects(fn() => $returns->post($bad, 1), "duplicate return lines rejected atomically");
$ids = DB::table("accounts")->pluck("id", "code");
$voucherService = new PaymentVoucherService($posting);
$v = [
    "kind" => "supplier",
    "payment_date" => "2026-10-20",
    "payment_method" => "cash",
    "payment_account_id" => $ids["1000"],
    "goods_receipt_id" => $gid,
    "description" => "Settle supplier",
    "lines" => [["description" => "Settlement", "amount" => 900]],
];
$vid = $voucherService->save($v, null, 1);
rejects(
    fn() => $voucherService->post($vid, 1),
    "supplier payment checks returns before permitting payment",
);
$v["lines"][0]["amount"] = 300;
$vid = $voucherService->save($v, null, 1);
$voucherService->post($vid, 1);
check(
    $aging->report("2026-10-20")["totals"]["total"] === 500.0,
    "supplier voucher settles returned receipt balance",
);
$supplierLedger = $ledger
    ->ledger(
        req(["kind" => "supplier", "id" => 1, "from" => "2026-10-01", "to" => "2026-10-31"], "GET"),
    )
    ->getData(true);
check($supplierLedger["closing"] === 500, "supplier ledger reconciles GRN less return and payment");
$returns->cancel($rid, "2026-10-25", "Return recalled", 1);
check(
    (float) DB::table("stock_balances")->value("quantity") === 10.0 &&
        $aging->report("2026-10-26")["totals"]["total"] === 700.0,
    "return reversal restores stock and supplier liability",
);
check(
    $aging->report("2026-10-24")["totals"]["total"] === 500.0,
    "historical aging keeps return until reversal date",
);
$supplierLedger = $ledger
    ->ledger(
        req(["kind" => "supplier", "id" => 1, "from" => "2026-10-01", "to" => "2026-10-31"], "GET"),
    )
    ->getData(true);
check($supplierLedger["closing"] === 700, "supplier ledger includes return reversal");
$stockLedger = $ledger
    ->ledger(
        req(
            [
                "kind" => "raw",
                "id" => 1,
                "from" => "2026-10-01",
                "to" => "2026-10-31",
                "variant" => "B1",
            ],
            "GET",
        ),
    )
    ->getData(true);
check(
    $stockLedger["closing"] === 10 && count($stockLedger["rows"]) === 3,
    "stock ledger traces receipt, return and reversal",
);

$invoice = DB::table("sales_invoices")->insertGetId(["number" => "INV-TEST", "customer_id" => 1]);
$receipt = DB::table("customer_receipts")->insertGetId([
    "number" => "REC-TEST",
    "customer_id" => 1,
]);
DB::transaction(
    fn() => $posting->post("sales_invoice", $invoice, "2026-10-05", "Customer invoice", [
        ["account_code" => "1100", "debit" => 100, "credit" => 0],
        ["account_code" => "4000", "debit" => 0, "credit" => 100],
    ]),
);
DB::transaction(
    fn() => $posting->post("customer_receipt", $receipt, "2026-10-15", "Customer receipt", [
        ["account_code" => "1000", "debit" => 40, "credit" => 0],
        ["account_code" => "1100", "debit" => 0, "credit" => 40],
    ]),
);
$customerLedger = $ledger
    ->ledger(
        req(["kind" => "customer", "id" => 1, "from" => "2026-10-10", "to" => "2026-10-31"], "GET"),
    )
    ->getData(true);
check(
    $customerLedger["opening"] === 100 && $customerLedger["closing"] === 60,
    "customer ledger carries opening invoices and later collections",
);

$template = $business
    ->recurring(
        req([
            "description" => "Monthly accrual",
            "starts_on" => "2026-01-31",
            "interval_months" => 1,
            "lines" => [
                ["account_code" => "5400", "debit" => 50, "credit" => 0],
                ["account_code" => "2100", "debit" => 0, "credit" => 50],
            ],
        ]),
        $posting,
    )
    ->getData(true)["id"];
$business->runRecurring(req(["posting_date" => "2026-01-31"]), $template, $posting);
check(
    DB::table("recurring_journals")->where("id", $template)->value("next_date") === "2026-02-28",
    "recurring journal handles end-of-month dates",
);
$before = DB::table("journal_entries")->count();
$business->runRecurring(req(["posting_date" => "2026-01-31"]), $template, $posting);
check(DB::table("journal_entries")->count() === $before, "recurring period cannot post twice");
$business->runRecurring(req(["posting_date" => "2026-02-28"]), $template, $posting);
check(
    DB::table("recurring_journals")->where("id", $template)->value("next_date") === "2026-03-31",
    "recurring schedule preserves original month-end anchor",
);
rejects(
    fn() => $business->recurring(
        req([
            "description" => "Bad",
            "starts_on" => "2026-10-01",
            "interval_months" => 1,
            "lines" => [
                ["account_code" => "5400", "debit" => 50, "credit" => 0],
                ["account_code" => "2100", "debit" => 0, "credit" => 40],
            ],
        ]),
        $posting,
    ),
    "unbalanced recurring template rejected",
);
$closed = $business
    ->recurring(
        req([
            "description" => "Closed",
            "starts_on" => "2025-10-01",
            "interval_months" => 1,
            "lines" => [
                ["account_code" => "5400", "debit" => 50, "credit" => 0],
                ["account_code" => "2100", "debit" => 0, "credit" => 50],
            ],
        ]),
        $posting,
    )
    ->getData(true)["id"];
rejects(
    fn() => $business->runRecurring(req(["posting_date" => "2025-10-01"]), $closed, $posting),
    "unavailable accounting period rejects recurring posting",
);
check(
    DB::table("recurring_journal_runs")->where("recurring_journal_id", $closed)->count() === 0,
    "failed recurring posting leaves no run or schedule advancement",
);

$import = [
    "import_key" => "123e4567-e89b-42d3-a456-426614174000",
    "adjustment_date" => "2026-10-25",
    "reason" => "Verified opening stock",
    "rows" => [
        [
            "kind" => "raw",
            "code" => "RAW-1",
            "batch_number" => "B2",
            "size_label" => null,
            "quantity" => 3,
            "unit_cost" => 10,
        ],
        [
            "kind" => "finished",
            "code" => "SHOE-1",
            "batch_number" => null,
            "size_label" => "40",
            "quantity" => 5,
            "unit_cost" => null,
        ],
    ],
];
$business->bulkStock(req($import), $posting);
check(
    (float) DB::table("stock_balances")->where("batch_number", "B2")->value("quantity") === 3.0 &&
        (float) DB::table("finished_goods_stock")->value("quantity") === 5.0,
    "bulk import connects raw accounting and finished-size stock",
);
$business->bulkStock(req($import), $posting);
check(
    (float) DB::table("stock_balances")->where("batch_number", "B2")->value("quantity") === 3.0,
    "retrying import reference does not add stock twice",
);
$bad = $import;
$bad["import_key"] = "123e4567-e89b-42d3-a456-426614174001";
$bad["rows"][1]["code"] = "MISSING";
rejects(fn() => $business->bulkStock(req($bad), $posting), "invalid bulk row rejects whole file");
check(
    (float) DB::table("stock_balances")->where("batch_number", "B2")->value("quantity") === 3.0 &&
        DB::table("stock_import_batches")->count() === 1,
    "failed bulk import rolls back earlier rows, journals and import key",
);

$preview = $business
    ->cashPreview(req(["account_id" => $ids["1000"], "closing_date" => "2026-10-26"], "GET"))
    ->getData(true);
rejects(
    fn() => $business->closeCash(
        req(["account_id" => $ids["1000"], "closing_date" => "2026-10-26", "counted" => 0]),
    ),
    "cash difference requires an explanation",
);
$closing = $business
    ->closeCash(
        req([
            "account_id" => $ids["1000"],
            "closing_date" => "2026-10-26",
            "counted" => 0,
            "notes" => "Cash funding under review",
        ]),
    )
    ->getData(true)["id"];
rejects(
    fn() => $business->closeCash(
        req([
            "account_id" => $ids["1000"],
            "closing_date" => "2026-10-26",
            "counted" => 0,
            "notes" => "Duplicate",
        ]),
    ),
    "closed account/day cannot close twice",
);
$business->reopenCash(req(["reason" => "Review funding"]), $closing);
check(
    DB::table("cash_closings")->where("id", $closing)->value("status") === "reopened",
    "cash closing reopens only through a reasoned audit action",
);

DB::table("employees")->insert([
    "id" => 1,
    "employee_no" => "EMP1",
    "name" => "Office employee",
    "department" => "Head Office",
    "designation" => "Clerk",
    "basic_salary" => 100,
    "status" => "active",
]);
$payroll = DB::table("payroll_runs")->insertGetId([
    "number" => "PAY-TEST",
    "period_start" => "2026-10-01",
    "period_end" => "2026-10-20",
    "status" => "posted",
    "gross_total" => 100,
    "deduction_total" => 0,
    "net_total" => 100,
]);
$payline = DB::table("payroll_items")->insertGetId([
    "payroll_run_id" => $payroll,
    "employee_id" => 1,
    "basic_salary" => 100,
    "net_salary" => 100,
    "payment_status" => "unpaid",
]);
DB::transaction(
    fn() => $posting->post("payroll_run", $payroll, "2026-10-20", "Payroll accrual", [
        ["account_code" => "5100", "debit" => 100, "credit" => 0],
        ["account_code" => "2250", "debit" => 0, "credit" => 100],
    ]),
);
$salary = new App\Services\Accounting\SalaryPaymentService($posting);
$payment = $salary->pay(
    [
        "payroll_item_id" => $payline,
        "payment_account_id" => $ids["1000"],
        "payment_date" => "2026-10-26",
    ],
    1,
);
check(
    DB::table("payroll_items")->where("id", $payline)->value("payment_status") === "paid",
    "salary payment updates the original payroll status",
);
$before = DB::table("journal_entries")->count();
$salary->pay(
    [
        "payroll_item_id" => $payline,
        "payment_account_id" => $ids["1000"],
        "payment_date" => "2026-10-26",
    ],
    1,
);
check(DB::table("journal_entries")->count() === $before, "salary cannot be paid twice");
$salary->cancel($payment, "2026-10-27", "Bank returned payment", 1);
check(
    DB::table("payroll_items")->where("id", $payline)->value("payment_status") === "unpaid",
    "salary reversal restores payable and unpaid status",
);
check(
    DB::table("salary_payments")->where("id", $payment)->value("reversal_journal_id") !== null,
    "salary reversal retains linked journal history",
);
rejects(
    fn() => (new App\Http\Controllers\Api\PayrollReportController())->updatePayrollItemPayment(
        req(["payment_status" => "paid"]),
        $payline,
    ),
    "paid-flag-only updates are blocked",
);

$business->term(req(["kind" => "brand", "name" => "Aero Brand"]));
$business->assignProduct(
    req([
        "article_id" => 1,
        "category" => "Shoes",
        "brand" => "Aero Brand",
        "unit" => "piece",
        "reason" => "Set classifications",
    ]),
);
check(
    DB::table("articles")->where("id", 1)->value("brand") === "Aero Brand",
    "master classifications update the original pricing article",
);
check(
    DB::table("audit_logs")->where("event", "product.classification_changed")->exists() &&
        DB::table("audit_logs")->where("event", "stock.bulk_imported")->exists(),
    "connected workflows preserve audit events",
);
check(
    $business->index(req(["as_of" => "2026-10-28"], "GET"))->getStatusCode() === 200,
    "connected workspace metadata loads with all relationships",
);

$serials = new App\Services\Inventory\SerialWarrantyService();
DB::table("articles")
    ->where("id", 1)
    ->update(["track_serials" => true]);
$serialData = [
    "article_id" => 1,
    "size_label" => "40",
    "received_on" => "2026-10-25",
    "warranty_months" => 12,
    "serial_numbers" => ["SER-001", "SER-002"],
];
$serialIds = $serials->register($serialData, 1);
check(
    (float) DB::table("finished_goods_stock")->value("quantity") === 5.0,
    "serial registration never adds stock",
);
rejects(fn() => $serials->register($serialData, 1), "duplicate serial registration rejected");
$tooMany = $serialData;
$tooMany["serial_numbers"] = ["A", "B", "C", "D"];
rejects(fn() => $serials->register($tooMany, 1), "available serials cannot exceed existing stock");
$sold = DB::table("sales_invoices")->insertGetId([
    "number" => "INV-SERIAL",
    "customer_id" => 1,
    "invoice_date" => "2026-10-26",
]);
DB::table("sales_invoice_lines")->insert([
    "sales_invoice_id" => $sold,
    "article_id" => 1,
    "size_label" => "40",
    "quantity" => 2,
]);
DB::transaction(
    fn() => (new App\Services\Inventory\FinishedGoodsInventoryService())->issueInvoice(
        $sold,
        "2026-10-26",
    ),
);
check(
    DB::table("product_serials")->where("sales_invoice_id", $sold)->count() === 2 &&
        (float) DB::table("finished_goods_stock")->value("quantity") === 3.0,
    "invoicing issues serials and stock in the same transaction",
);
check(
    DB::table("product_serials")->where("id", $serialIds[0])->value("warranty_ends_on") ===
        "2027-10-26",
    "warranty starts from original invoice date",
);
DB::transaction(
    fn() => (new App\Services\Inventory\FinishedGoodsInventoryService())->issueInvoice(
        $sold,
        "2026-10-26",
    ),
);
check(
    DB::table("product_serials")->where("sales_invoice_id", $sold)->count() === 2 &&
        (float) DB::table("finished_goods_stock")->value("quantity") === 3.0,
    "repeated invoice issue does not duplicate serial or stock issue",
);
rejects(
    fn() => $serials->guardInvoice($sold),
    "issued serial/warranty history protects invoice from editing or deletion",
);
$uncovered = DB::table("sales_invoices")->insertGetId([
    "number" => "INV-NEEDS-SERIAL",
    "customer_id" => 1,
    "invoice_date" => "2026-10-26",
]);
DB::table("sales_invoice_lines")->insert([
    "sales_invoice_id" => $uncovered,
    "article_id" => 1,
    "size_label" => "40",
    "quantity" => 1,
]);
rejects(
    fn() => DB::transaction(
        fn() => (new App\Services\Inventory\FinishedGoodsInventoryService())->issueInvoice(
            $uncovered,
            "2026-10-26",
        ),
    ),
    "serial-tracked article cannot dispatch without an available serial",
);
check(
    (float) DB::table("finished_goods_stock")->value("quantity") === 3.0,
    "failed serial dispatch rolls back stock",
);
$claim = $serials->claim(
    [
        "product_serial_id" => $serialIds[0],
        "claim_date" => "2026-10-27",
        "issue" => "Sole detached",
    ],
    1,
);
rejects(
    fn() => $serials->claim(
        [
            "product_serial_id" => $serialIds[0],
            "claim_date" => "2026-10-27",
            "issue" => "Second claim",
        ],
        1,
    ),
    "one open warranty claim per serial",
);
rejects(
    fn() => $serials->claim(
        ["product_serial_id" => $serialIds[1], "claim_date" => "2027-11-01", "issue" => "Expired"],
        1,
    ),
    "claim outside warranty period rejected",
);
$serials->resolve(
    $claim,
    ["status" => "resolved", "resolution" => "Repaired sole", "resolved_on" => "2026-10-28"],
    1,
);
check(
    DB::table("warranty_claims")->where("id", $claim)->value("status") === "resolved",
    "warranty resolution retained with service outcome",
);
rejects(
    fn() => $serials->resolve(
        $claim,
        ["status" => "rejected", "resolution" => "Rewrite", "resolved_on" => "2026-10-28"],
        1,
    ),
    "closed warranty outcome cannot be silently rewritten",
);
$legacy = $serialData;
$legacy["serial_numbers"] = ["SER-LEGACY"];
$legacy["sales_invoice_id"] = $uncovered;
$serials->register($legacy, 1);
check(
    (float) DB::table("finished_goods_stock")->value("quantity") === 3.0,
    "serial can be linked to existing invoiced quantity without adding or issuing stock again",
);
$legacy["serial_numbers"] = ["SER-EXCESS"];
rejects(
    fn() => $serials->register($legacy, 1),
    "serials cannot exceed original invoice product/size quantity",
);
check(
    !DB::table("product_serials")->where("serial_number", "SER-EXCESS")->exists(),
    "failed invoice serial registration rolls back new serial",
);
check(
    (new App\Http\Controllers\Api\SerialWarrantyController())->index()->getData(true)["serials"][0][
        "customer"
    ] === "Customer",
    "serial ownership comes from linked invoice customer",
);

$serials->register(
    [
        "article_id" => 1,
        "size_label" => "40",
        "received_on" => "2026-10-25",
        "warranty_months" => 6,
        "serial_numbers" => ["POS-SERIAL"],
    ],
    1,
);
$pos = new App\Http\Controllers\Api\PointOfSaleController();
$accounting = new App\Http\Controllers\Api\AccountingSalesController();
$salesController = new App\Http\Controllers\Api\SalesController();
$checkout = [
    "checkout_key" => "123e4567-e89b-42d3-a456-426614174100",
    "customer_id" => 1,
    "sales_rep_id" => 1,
    "invoice_date" => "2026-10-28",
    "payment_method" => "cash",
    "payment_account_id" => $ids["1000"],
    "discount" => 0,
    "expected_total" => 120,
    "lines" => [["set_item_id" => 1, "quantity" => 1]],
];
$result = $pos->checkout(req($checkout), $accounting, $salesController, $posting)->getData(true);
check(
    DB::table("sales_invoices")->where("id", $result["invoice_id"])->value("status") === "paid" &&
        (float) DB::table("sales_invoices")
            ->where("id", $result["invoice_id"])
            ->value("outstanding") === 0.0,
    "POS checkout creates and fully settles the actual sales invoice",
);
check(
    DB::table("product_serials")->where("serial_number", "POS-SERIAL")->value("sales_invoice_id") ==
        $result["invoice_id"],
    "POS uses invoice serial/warranty issuing",
);
check(
    DB::table("customer_receipts")
        ->where("id", $result["receipt_id"])
        ->value("payment_account_id") == $ids["1000"],
    "POS receipt uses selected cash account",
);
$count = DB::table("sales_invoices")->count();
$pos->checkout(req($checkout), $accounting, $salesController, $posting);
check(
    DB::table("sales_invoices")->count() === $count,
    "repeated POS checkout does not create another sale or receipt",
);
$bad = $checkout;
$bad["checkout_key"] = "123e4567-e89b-42d3-a456-426614174101";
$bad["expected_total"] = 100;
rejects(
    fn() => $pos->checkout(req($bad), $accounting, $salesController, $posting),
    "POS rechecks catalog price before checkout",
);
$bad = $checkout;
$bad["checkout_key"] = "123e4567-e89b-42d3-a456-426614174102";
rejects(
    fn() => $pos->checkout(req($bad), $accounting, $salesController, $posting),
    "POS rejects missing required serial",
);
check(
    DB::table("sales_invoices")->count() === $count && DB::table("pos_checkouts")->count() === 1,
    "failed POS checkout rolls back invoice, receipt, stock and checkout reference",
);
$paidReturn = $return;
$paidReturn["return_date"] = "2026-10-28";
$paidReturn["lines"][0]["quantity"] = 8;
rejects(
    fn() => $returns->post($paidReturn, 1),
    "return cannot consume the portion already settled by supplier payment",
);
check(
    (float) DB::table("stock_balances")->where("batch_number", "B1")->value("quantity") === 10.0,
    "return rejected against paid balance rolls back reserved batch quantity",
);
$live = $business->index(req(["as_of" => "2026-10-28"], "GET"))->getData(true);
check(
    $live["cash_closings"][0]["ledger_changed"] === true,
    "backdated payments after cash closing are flagged for review",
);
check(
    collect($live["liability_balances"])->firstWhere("code", "2250")["balance"] === 100,
    "all payables includes the restored salary liability after reversal",
);
