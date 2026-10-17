<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('accounts')->insertOrIgnore([
            'code'=>'2300', 'name'=>'Taxes Payable', 'type'=>'liability', 'is_postable'=>true,
            'created_at'=>now(), 'updated_at'=>now(),
        ]);
    }

    public function down(): void
    {
        // Keep the account because posted journals may reference it.
    }
};
