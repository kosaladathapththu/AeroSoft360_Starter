<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('head_office_commission_settings', function (Blueprint $table) {
            $table->id();
            $table->string('password_hash')->nullable();
            $table->decimal('rate_per_piece', 14, 2)->default(0);
            $table->unsignedInteger('max_collection_days')->default(100);
            $table->timestamps();
        });
        DB::table('head_office_commission_settings')->insert(['id' => 1, 'created_at' => now(), 'updated_at' => now()]);
        foreach (['manual_commissions', 'receipt_allocations'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->string('commission_category', 20)->default('direct'));
        }
        $headOffice = DB::table('sales_representatives')->where('channel', 'head_office')->pluck('id');
        DB::table('manual_commissions')->whereIn('sales_rep_id', $headOffice)->update(['commission_category' => 'head_office']);
        DB::table('receipt_allocations')->whereIn('commission_payee_sales_rep_id', $headOffice)->update(['commission_category' => 'head_office']);
    }

    public function down(): void
    {
        foreach (['manual_commissions', 'receipt_allocations'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('commission_category'));
        }
        Schema::dropIfExists('head_office_commission_settings');
    }
};
