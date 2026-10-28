<?php
// Standalone, in-memory checks. Does not read or write the business database.
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
use App\Http\Controllers\Api\AccountingSalesController;

$tables = [
    "customers" => ["name", "code", "address", "phone", "tin"],
    "sales_representatives" => ["name"],
    "articles" => ["code", "name"],
    "sales_orders" => ["number", "customer_po_id"],
    "customer_pos" => ["customer_po_reference"],
    "sales_invoices" => [
        "number",
        "customer_id",
        "sales_rep_id",
        "sales_order_id",
        "invoice_date",
        "due_date",
        "sale_type",
        "status",
        "subtotal",
        "discount",
        "tax",
        "other_charges",
        "other_deduction",
        "total",
        "received_amount",
        "outstanding",
    ],
    "sales_invoice_lines" => [
        "sales_invoice_id",
        "article_id",
        "size_label",
        "colour",
        "quantity",
        "rate",
        "line_total",
    ],
];
foreach ($tables as $name => $columns) {
    Schema::create($name, function ($table) use ($columns) {
        $table->id();
        foreach ($columns as $column) {
            $table->string($column)->nullable();
        }
    });
}
DB::table("customers")->insert([
    "id" => 1,
    "code" => "CUS-1",
    "name" => "Test customer",
    "address" => "Test address",
    "phone" => "123",
    "tin" => "TIN-1",
]);
DB::table("sales_representatives")->insert(["id" => 1, "name" => "Test rep"]);
DB::table("articles")->insert(["id" => 1, "code" => "9272", "name" => "Sandal"]);
DB::table("customer_pos")->insert(["id" => 1, "customer_po_reference" => "PO-CUSTOMER-1"]);
DB::table("sales_orders")->insert(["id" => 1, "number" => "SO-1", "customer_po_id" => 1]);
DB::table("sales_invoices")->insert([
    "id" => 1,
    "number" => "INV-1",
    "customer_id" => 1,
    "sales_rep_id" => 1,
    "sales_order_id" => 1,
    "subtotal" => 1000,
    "discount" => 100,
    "other_deduction" => 50,
    "tax" => 85,
    "other_charges" => 20,
    "total" => 955,
    "received_amount" => 200,
    "outstanding" => 755,
    "status" => "part_paid",
    "sale_type" => "credit",
]);
DB::table("sales_invoices")->insert([
    "id" => 2,
    "number" => "INV-2",
    "customer_id" => 1,
    "sales_rep_id" => 1,
    "subtotal" => 500,
    "total" => 500,
    "received_amount" => 0,
    "outstanding" => 500,
]);
DB::table("sales_invoice_lines")->insert([
    [
        "id" => 1,
        "sales_invoice_id" => 1,
        "article_id" => 1,
        "size_label" => "40",
        "colour" => "BROWN",
        "quantity" => 2,
        "rate" => 500,
        "line_total" => 1000,
    ],
    [
        "id" => 2,
        "sales_invoice_id" => 2,
        "article_id" => 1,
        "size_label" => "41",
        "colour" => "TAN",
        "quantity" => 1,
        "rate" => 500,
        "line_total" => 500,
    ],
]);
function verify($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "PASS $message\n";
}
$controller = new AccountingSalesController();
$bill = $controller->invoiceBill(1)->getData(true);
verify(
    $bill["customer_name"] === "Test customer" &&
        $bill["customer_address"] === "Test address" &&
        $bill["rep_name"] === "Test rep",
    "customer and salesperson details",
);
verify(
    $bill["reference"] === "PO-CUSTOMER-1" && $bill["order_number"] === "SO-1",
    "customer PO and order references",
);
verify(
    count($bill["lines"]) === 1 &&
        $bill["lines"][0]["size_label"] === "40" &&
        $bill["lines"][0]["colour"] === "BROWN",
    "only selected invoice items included",
);
verify(
    (float) $bill["discount"] === 100.0 &&
        (float) $bill["tax"] === 85.0 &&
        (float) $bill["other_charges"] === 20.0 &&
        (float) $bill["other_deduction"] === 50.0,
    "stored adjustments preserved",
);
verify(
    (float) $bill["total"] === 955.0 &&
        (float) $bill["received_amount"] === 200.0 &&
        (float) $bill["outstanding"] === 755.0,
    "stored invoice total and payments preserved",
);
verify(
    $controller->invoiceBill(2)->getData(true)["order_number"] === null,
    "invoice without linked PO supported",
);
try {
    $controller->invoiceBill(999);
    throw new RuntimeException("Missing invoice unexpectedly returned");
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    verify($e->getStatusCode() === 404, "missing invoice returns 404");
}
