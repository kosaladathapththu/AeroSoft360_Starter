<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // A fresh installation is populated by DatabaseSeeder after migrations.
        if (DB::table('permissions')->count() === 0) return;
        $permissionId = DB::table('permissions')->where('code', 'admin.manage')->value('id');
        if (! $permissionId) $permissionId = DB::table('permissions')->insertGetId(['code'=>'admin.manage','name'=>'Manage users, roles and permissions','created_at'=>now(),'updated_at'=>now()]);
        $adminRole = DB::table('roles')->where('code', 'administrator')->value('id');
        if ($adminRole) DB::table('role_permissions')->updateOrInsert(['role_id'=>$adminRole,'permission_id'=>$permissionId]);
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('code', 'admin.manage')->value('id');
        if ($permissionId) { DB::table('role_permissions')->where('permission_id',$permissionId)->delete(); DB::table('permissions')->where('id',$permissionId)->delete(); }
    }
};
