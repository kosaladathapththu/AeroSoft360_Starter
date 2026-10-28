<?php
// Isolated regression checks: uses an in-memory database, never the configured business database.
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
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\SalesController;

Schema::create("customer_pos", function (Blueprint $t) {
    $t->id();
    $t->integer("customer_id");
    $t->integer("sales_rep_id");
    $t->string("status");
    $t->timestamps();
});
Schema::create("customer_po_lines", function (Blueprint $t) {
    $t->id();
    $t->integer("customer_po_id");
    $t->integer("article_id");
    $t->integer("set_template_id");
    $t->integer("set_item_id")->nullable();
    $t->string("order_mode");
    $t->decimal("pieces");
    $t->decimal("sets");
    $t->string("colour");
});
Schema::create("article_set_items", function (Blueprint $t) {
    $t->id();
    $t->integer("set_template_id");
    $t->string("size_label");
    $t->decimal("quantity");
    $t->decimal("unit_price");
});
Schema::create("sales_orders", function (Blueprint $t) {
    $t->id();
    $t->string("number");
    $t->integer("customer_po_id");
    $t->integer("customer_id");
    $t->integer("sales_rep_id");
    $t->date("order_date");
    $t->string("status");
    $t->decimal("total");
    $t->timestamps();
});
Schema::create("sales_order_size_lines", function (Blueprint $t) {
    $t->id();
    $t->integer("sales_order_id");
    $t->integer("article_id");
    $t->string("size_label");
    $t->string("colour");
    $t->decimal("quantity");
    $t->decimal("invoiced_quantity");
    $t->decimal("rate");
    $t->timestamps();
});
Schema::create("audit_logs", function (Blueprint $t) {
    $t->id();
    $t->string("event");
    $t->string("entity_type");
    $t->integer("entity_id");
    $t->text("payload");
    $t->timestamp("created_at");
});
DB::table("customer_pos")->insert([
    "id" => 1,
    "customer_id" => 1,
    "sales_rep_id" => 1,
    "status" => "draft",
]);
DB::table("customer_po_lines")->insert([
    "id" => 1,
    "customer_po_id" => 1,
    "article_id" => 1,
    "set_template_id" => 1,
    "order_mode" => "badge",
    "pieces" => 4,
    "sets" => 1,
    "colour" => "BROWN",
]);
foreach ([40, 41] as $index => $size) {
    DB::table("article_set_items")->insert([
        "id" => $index + 1,
        "set_template_id" => 1,
        "size_label" => $size,
        "quantity" => 2,
        "unit_price" => 100,
    ]);
}

function check($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}
function review(array $lines)
{
    $request = Request::create("/review", "POST", [
        "order_date" => "2026-10-27",
        "lines" => $lines,
    ]);
    $request->attributes->set("auth_user", (object) ["id" => 42]);
    return (new SalesController())->convert($request, 1);
}
function line($item, $quantity, $reason = null)
{
    return [
        "customer_po_line_id" => 1,
        "set_item_id" => $item,
        "quantity" => $quantity,
        "reason" => $reason,
    ];
}
function rejects($name, array $lines)
{
    try {
        review($lines);
        throw new RuntimeException("$name: unexpectedly accepted");
    } catch (Illuminate\Validation\ValidationException $e) {
        check(isset($e->errors()["lines.0.reason"]), "$name: missing reason error");
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        check($e->getStatusCode() === 422, "$name: wrong status");
    }
    check(DB::table("sales_orders")->count() === 0, "$name: saved an order");
    check(DB::table("audit_logs")->count() === 0, "$name: saved a partial audit");
    check(DB::table("customer_pos")->value("status") === "draft", "$name: modified the PO");
    echo "PASS $name\n";
}
rejects("edit requires reason", [line(1, 1), line(2, 2)]);
rejects("removal requires reason", [line(1, 0), line(2, 2)]);
rejects("whitespace reason rejected", [line(1, 0, "   "), line(2, 2)]);
rejects("omitted sizes rejected", [line(1, 2)]);
rejects("duplicate size rejected", [line(1, 2), line(1, 2)]);
rejects("excess quantity rejected", [line(1, 3, "Requested"), line(2, 2)]);
rejects("all removed rejected", [line(1, 0, "Unavailable"), line(2, 0, "Unavailable")]);
foreach ([false, true] as $remove) {
    DB::beginTransaction();
    $response = review([line(1, $remove ? 0 : 1, "  Stock unavailable  "), line(2, 2)]);
    check($response->getStatusCode() === 201, "Valid review rejected");
    $audit = json_decode(DB::table("audit_logs")->value("payload"), true);
    $change = $audit["changes"][0];
    check(
        $change["reason"] === "Stock unavailable" &&
            $change["original_quantity"] == 2 &&
            $change["quantity"] === ($remove ? 0 : 1),
        "Incorrect saved reason or quantities",
    );
    check(
        $audit["user_id"] === 42 && $change["action"] === ($remove ? "removed" : "edited"),
        "Missing reviewer or action",
    );
    check(
        DB::table("sales_order_size_lines")->count() === ($remove ? 1 : 2),
        "Incorrect order lines",
    );
    check(
        (float) DB::table("sales_orders")->value("total") === ($remove ? 200.0 : 300.0),
        "Incorrect total",
    );
    DB::rollBack();
    echo "PASS " . ($remove ? "removal" : "edit") . " reason saved with reviewer and quantities\n";
}
DB::beginTransaction();
review([line(1, 2), line(2, 2)]);
check(DB::table("audit_logs")->count() === 0, "Unchanged order incorrectly requires audit reasons");
DB::rollBack();
echo "PASS unchanged order needs no reason\n";
