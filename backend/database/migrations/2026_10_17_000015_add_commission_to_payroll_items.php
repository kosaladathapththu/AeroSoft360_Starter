<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('payroll_items', 'commission')) {
            Schema::table('payroll_items', function (Blueprint $table) {
                $table->decimal('commission', 18, 2)->default(0)->after('incentive');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('payroll_items', 'commission')) {
            Schema::table('payroll_items', fn (Blueprint $table) => $table->dropColumn('commission'));
        }
    }
};
