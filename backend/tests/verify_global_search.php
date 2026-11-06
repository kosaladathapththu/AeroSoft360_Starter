<?php
// In-memory database only; no business records are modified.
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
use App\Http\Controllers\Api\GlobalSearchController;
Schema::create("customers", function ($t) {
    $t->id();
    $t->string("code");
    $t->string("name");
    $t->string("phone");
});
Schema::create("sales_invoices", function ($t) {
    $t->id();
    $t->string("number");
    $t->string("status");
});
Schema::create("users", function ($t) {
    $t->id();
    $t->string("name");
    $t->string("password");
});
DB::table("customers")->insert([
    "code" => "CUS-001",
    "name" => "City Footwear",
    "phone" => "0771234567",
]);
DB::table("sales_invoices")->insert(["number" => "INV-2610-0001", "status" => "unpaid"]);
DB::table("users")->insert(["name" => "Secret user", "password" => "sensitive-password"]);
function searchResult($query)
{
    return (new GlobalSearchController())
        ->index(Request::create("/", "GET", ["q" => $query]))
        ->getData(true)["results"];
}
function check($ok, $label)
{
    if (!$ok) {
        throw new RuntimeException($label);
    }
    echo "PASS: $label\n";
}
check(count(searchResult("city")) === 1, "Search finds records outside the currently open page");
check(count(searchResult("footwear city")) === 1, "All words match regardless of order");
check(count(searchResult("city unknown")) === 0, "Every word is required");
check(
    searchResult("INV 2610 0001")[0]["page"] === "Invoices",
    "Document codes match across separators and route to invoices",
);
check(count(searchResult("077123")) === 1, "Phone fragments are searchable");
check(count(searchResult("sensitive")) === 0, "Credentials and user tables are excluded");
check(count(searchResult("%%%")) === 0, "Punctuation cannot return the whole database");
check(count(searchResult("city' OR 1=1")) === 0, "SQL-like text stays query data");
for ($i = 2; $i <= 10; $i++) {
    DB::table("customers")->insert([
        "code" => "CUS-" . $i,
        "name" => "City Shop",
        "phone" => "123",
    ]);
}
check(count(searchResult("city")) === 5, "Broad queries have a bounded result count per module");
check(
    searchResult("city")[0]["query"] === "CUS-10",
    "Result supplies an exact document identifier for destination filtering",
);
