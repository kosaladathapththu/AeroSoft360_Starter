<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('aero_production_batches', function (Blueprint $table) {
            $table->unsignedInteger('planned_quantity')->default(0)->after('product_id');
            $table->unsignedInteger('accepted_quantity')->default(0)->after('planned_quantity');
            $table->unsignedInteger('rejected_quantity')->default(0)->after('accepted_quantity');
        });
    }

    public function down(): void
    {
        Schema::table('aero_production_batches', function (Blueprint $table) {
            $table->dropColumn(['planned_quantity', 'accepted_quantity', 'rejected_quantity']);
        });
    }
};
