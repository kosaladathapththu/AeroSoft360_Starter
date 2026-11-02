<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
return new class extends Migration {
    public function up(): void
    {
        Schema::table("accounts", function (Blueprint $t) {
            $t->foreignId("parent_id")->nullable()->constrained("accounts")->restrictOnDelete();
        });
    }
    public function down(): void
    {
        if (DB::table("accounts")->whereNotNull("parent_id")->exists()) {
            throw new RuntimeException("Remove account hierarchy links before rollback.");
        }
        Schema::table("accounts", function (Blueprint $t) {
            $t->dropForeign(["parent_id"]);
            $t->dropColumn("parent_id");
        });
    }
};
