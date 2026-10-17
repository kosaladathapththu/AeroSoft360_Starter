<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('commission_settings')) {
            Schema::create('commission_settings', function (Blueprint $table) {
                $table->id();
                $table->unsignedSmallInteger('max_collection_days')->default(100);
                $table->timestamps();
            });
            DB::table('commission_settings')->insert(['max_collection_days'=>100, 'created_at'=>now(), 'updated_at'=>now()]);
        }
        if (! Schema::hasColumn('receipt_allocations', 'commission_pieces')) {
            Schema::table('receipt_allocations', function (Blueprint $table) {
                $table->decimal('commission_pieces', 18, 4)->default(0)->after('days_taken');
            });
        }
        DB::statement('UPDATE receipt_allocations allocation JOIN sales_invoices invoice ON invoice.id = allocation.invoice_id JOIN (SELECT sales_invoice_id, SUM(quantity) pieces FROM sales_invoice_lines GROUP BY sales_invoice_id) line_total ON line_total.sales_invoice_id = invoice.id SET allocation.commission_pieces = ROUND(line_total.pieces * LEAST(1, allocation.amount / GREATEST(invoice.total, 0.01)), 4)');
    }

    public function down(): void
    {
        if (Schema::hasColumn('receipt_allocations', 'commission_pieces')) Schema::table('receipt_allocations', fn (Blueprint $table) => $table->dropColumn('commission_pieces'));
        Schema::dropIfExists('commission_settings');
    }
};
