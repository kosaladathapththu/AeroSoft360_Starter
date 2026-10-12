<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
 public function up(): void {
  Schema::create('aero_roles', function(Blueprint $t){$t->id();$t->string('code')->unique();$t->string('name');$t->timestamps();});
  Schema::create('aero_permissions', function(Blueprint $t){$t->id();$t->string('code')->unique();$t->string('description')->nullable();$t->timestamps();});
  Schema::create('aero_role_permissions', function(Blueprint $t){$t->foreignId('role_id')->constrained('aero_roles')->cascadeOnDelete();$t->foreignId('permission_id')->constrained('aero_permissions')->cascadeOnDelete();$t->primary(['role_id','permission_id']);});
  Schema::create('aero_user_roles', function(Blueprint $t){$t->foreignId('user_id')->constrained('users')->cascadeOnDelete();$t->foreignId('role_id')->constrained('aero_roles')->cascadeOnDelete();$t->primary(['user_id','role_id']);});
  Schema::create('aero_audit_logs', function(Blueprint $t){$t->id();$t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();$t->string('action',100);$t->string('entity_type',120);$t->string('entity_id',100);$t->json('before')->nullable();$t->json('after')->nullable();$t->timestamp('created_at')->useCurrent();});
 }
 public function down(): void { foreach(['aero_audit_logs','aero_user_roles','aero_role_permissions','aero_permissions','aero_roles'] as $table) Schema::dropIfExists($table); }
};
