<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table("articles", fn(Blueprint $t) => $t->boolean("track_serials")->default(false));
        Schema::create("product_serials", function (Blueprint $t) {
            $t->id();
            $t->string("serial_number", 100)->unique();
            $t->foreignId("article_id")->constrained();
            $t->string("size_label", 30);
            $t->date("received_on");
            $t->unsignedSmallInteger("warranty_months")->default(12);
            $t->foreignId("sales_invoice_id")->nullable()->constrained();
            $t->date("warranty_starts_on")->nullable();
            $t->date("warranty_ends_on")->nullable();
            $t->string("status", 20)->default("available");
            $t->timestamps();
            $t->index(["article_id", "size_label", "status"]);
        });
        Schema::create("warranty_claims", function (Blueprint $t) {
            $t->id();
            $t->foreignId("product_serial_id")->constrained();
            $t->date("claim_date");
            $t->string("issue", 1000);
            $t->string("status", 20)->default("open");
            $t->string("resolution", 1000)->nullable();
            $t->date("resolved_on")->nullable();
            $t->unsignedBigInteger("created_by")->nullable();
            $t->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists("warranty_claims");
        Schema::dropIfExists("product_serials");
        Schema::table("articles", fn(Blueprint $t) => $t->dropColumn("track_serials"));
    }
};
