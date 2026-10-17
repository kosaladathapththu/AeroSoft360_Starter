<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('payroll_items', 'payment_status')) {
            Schema::table('payroll_items', function (Blueprint $table) {
                $table->string('payment_status', 20)->default('unpaid')->after('net_salary');
                $table->timestamp('paid_at')->nullable()->after('payment_status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('payroll_items', 'payment_status')) {
            Schema::table('payroll_items', fn (Blueprint $table) => $table->dropColumn(['payment_status', 'paid_at']));
        }
    }
};
