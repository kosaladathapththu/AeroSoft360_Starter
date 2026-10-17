<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('number')->unique();
            $table->foreignId('material_id')->constrained();
            $table->string('batch_number', 80);
            $table->date('adjustment_date');
            $table->string('adjustment_type', 20);
            $table->decimal('quantity', 18, 4);
            $table->decimal('unit_cost', 18, 4);
            $table->decimal('total', 18, 2);
            $table->string('reason');
            $table->string('status', 20)->default('posted');
            $table->timestamps();
        });
        DB::table('accounts')->insertOrIgnore(['code'=>'5000','name'=>'Cost of Raw Materials','type'=>'expense','is_postable'=>true,'created_at'=>now(),'updated_at'=>now()]);
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};
