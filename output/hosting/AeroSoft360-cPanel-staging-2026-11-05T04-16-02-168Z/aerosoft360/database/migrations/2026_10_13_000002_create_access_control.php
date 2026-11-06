<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void
    {
        Schema::create(
            "roles",
            fn(Blueprint $t) => tap($t, function ($t) {
                $t->id();
                $t->string("code", 40)->unique();
                $t->string("name");
                $t->timestamps();
            }),
        );
        Schema::create(
            "permissions",
            fn(Blueprint $t) => tap($t, function ($t) {
                $t->id();
                $t->string("code", 80)->unique();
                $t->string("name");
                $t->timestamps();
            }),
        );
        Schema::create(
            "role_permissions",
            fn(Blueprint $t) => tap($t, function ($t) {
                $t->foreignId("role_id")->constrained()->cascadeOnDelete();
                $t->foreignId("permission_id")->constrained()->cascadeOnDelete();
                $t->primary(["role_id", "permission_id"]);
            }),
        );
        Schema::create(
            "users",
            fn(Blueprint $t) => tap($t, function ($t) {
                $t->id();
                $t->foreignId("role_id")->constrained();
                $t->string("name");
                $t->string("email")->unique();
                $t->string("password");
                $t->boolean("active")->default(true);
                $t->timestamps();
            }),
        );
        Schema::create(
            "access_tokens",
            fn(Blueprint $t) => tap($t, function ($t) {
                $t->id();
                $t->foreignId("user_id")->constrained()->cascadeOnDelete();
                $t->string("token_hash", 64)->unique();
                $t->timestamp("last_used_at")->nullable();
                $t->timestamp("expires_at");
                $t->timestamps();
            }),
        );
    }
    public function down(): void
    {
        foreach (["access_tokens", "users", "role_permissions", "permissions", "roles"] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
