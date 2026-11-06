<?php
// Exercises real manual creation and conversion against an isolated in-memory database.
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
use App\Http\Controllers\Api\SalesController;
use App\Http\Controllers\Api\AccountingSalesController;
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
foreach ($tables as $table => $columns) {
    Schema::create($table, function ($schema) use ($columns) {
        $schema->id();
        foreach ($columns as $column) {
            $schema->string($column)->nullable();
        }
    });
}
DB::table("customers")->insert(["id" => 1, "code" => "CUS-1", "name" => "Customer"]);
DB::table("sales_representatives")->insert([
    ["id" => 1, "name" => "Rep"],
    ["id" => 2, "name" => "Logged in rep"],
]);
DB::table("article_set_templates")->insert([
    ["id" => 1, "article_id" => 1],
    ["id" => 2, "article_id" => 2],
]);
DB::table("article_set_items")->insert([
    ["id" => 1, "set_template_id" => 1, "size_label" => "40", "quantity" => 2, "unit_price" => 100],
    ["id" => 2, "set_template_id" => 1, "size_label" => "41", "quantity" => 1, "unit_price" => 150],
]);
function check($value, $name)
{
    if (!$value) {
        throw new RuntimeException($name);
    }
    echo "PASS $name\n";
}
function createOrder($values, $actor = null)
{
    $request = Request::create("/", "POST", $values);
    if ($actor) {
        $request->attributes->set("auth_user", (object) $actor);
    }
    return (new AccountingSalesController())->manualSalesOrder($request, new SalesController());
}
$base = [
    "customer_id" => 1,
    "sales_rep_id" => 1,
    "po_date" => "2026-10-27",
    "sale_type" => "credit",
    "lines" => [
        ["order_mode" => "badge", "set_template_id" => 1, "quantity" => 3, "colour" => "BROWN"],
    ],
];
DB::beginTransaction();
$response = createOrder($base);
$order = $response->getData(true)["sales_order"];
check($response->getStatusCode() === 201, "manual sales order returns created response");
check(
    $order["order_date"] === "2026-10-27" && (float) $order["total"] === 1050.0,
    "order date and full-set total preserved",
);
$lines = DB::table("sales_order_size_lines")->orderBy("id")->get();
check(
    $lines->count() === 2 &&
        (float) $lines[0]->quantity === 6.0 &&
        (float) $lines[1]->quantity === 3.0 &&
        $lines[0]->colour === "BROWN",
    "set expands into correct sizes and colour",
);
check(
    DB::table("customer_pos")->value("status") === "ordered" &&
        DB::table("audit_logs")->count() === 0,
    "unchanged quantities convert without unnecessary reasons",
);
DB::rollBack();
DB::beginTransaction();
$custom = array_replace($base, [
    "lines" => [["order_mode" => "size", "set_item_id" => 1, "quantity" => 5, "colour" => "BLUE"]],
]);
createOrder($custom);
check(
    DB::table("sales_order_size_lines")->count() === 1 &&
        (float) DB::table("sales_orders")->value("total") === 500.0,
    "individual-size manual order supported",
);
DB::rollBack();
DB::beginTransaction();
$new = array_replace($base, [
    "customer_id" => null,
    "customer_name" => "New customer",
    "customer_phone" => "0770000000",
]);
createOrder($new, ["id" => 42, "sales_rep_id" => 2]);
check(
    DB::table("customers")->count() === 2 &&
        DB::table("customers")->where("name", "New customer")->exists(),
    "new customer created with sales order",
);
check(
    (int) DB::table("sales_orders")->value("sales_rep_id") === 2,
    "logged-in salesperson assignment preserved",
);
DB::rollBack();
$broken = array_replace($new, [
    "lines" => [["order_mode" => "badge", "set_template_id" => 2, "quantity" => 1]],
]);
try {
    createOrder($broken);
    throw new RuntimeException("Empty set unexpectedly converted");
} catch (Illuminate\Validation\ValidationException $e) {
    check(
        DB::table("customers")->count() === 1 &&
            DB::table("customer_pos")->count() === 0 &&
            DB::table("sales_orders")->count() === 0,
        "failed conversion rolls back new customer and PO",
    );
}
