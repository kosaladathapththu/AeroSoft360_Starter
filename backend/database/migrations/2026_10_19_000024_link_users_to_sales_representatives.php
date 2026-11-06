<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn("users", "sales_rep_id")) {
            Schema::table(
                "users",
                fn(Blueprint $table) => $table
                    ->foreignId("sales_rep_id")
                    ->nullable()
                    ->after("role_id")
                    ->constrained("sales_representatives")
                    ->nullOnDelete(),
            );
        }

        $now = now();
        $roleId = DB::table("roles")->where("code", "sales_person")->value("id");
        if (!$roleId) {
            $roleId = DB::table("roles")->insertGetId([
                "code" => "sales_person",
                "name" => "Salesperson",
                "created_at" => $now,
                "updated_at" => $now,
            ]);
        }
        foreach (["workspace.view", "accounting.manage"] as $code) {
            $permissionId = DB::table("permissions")->where("code", $code)->value("id");
            if ($permissionId) {
                DB::table("role_permissions")->updateOrInsert([
                    "role_id" => $roleId,
                    "permission_id" => $permissionId,
                ]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn("users", "sales_rep_id")) {
            Schema::table("users", function (Blueprint $table) {
                $table->dropForeign(["sales_rep_id"]);
                $table->dropColumn("sales_rep_id");
            });
        }
    }
};
