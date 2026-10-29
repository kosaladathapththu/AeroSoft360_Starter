<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        foreach (['customer_po_lines', 'sales_order_size_lines', 'sales_invoice_lines'] as $name) {
            if (!Schema::hasColumn($name, 'fixed_rate')) Schema::table($name, function (Blueprint $t) { $t->decimal('fixed_rate',18,2)->nullable(); });
        }
        Schema::table('customer_po_lines', function (Blueprint $t) {
            $t->decimal('custom_rate',18,2)->nullable();
            $t->json('fixed_rates')->nullable();
        });
        foreach (['sales_invoices', 'customer_receipts'] as $name) Schema::table($name, function (Blueprint $t) { $t->boolean('is_opening_balance')->default(false); });
        // An opening balance has no sales order or original salesperson.
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE sales_invoices MODIFY sales_order_id BIGINT UNSIGNED NULL, MODIFY sales_rep_id BIGINT UNSIGNED NULL');
            DB::statement('ALTER TABLE customer_receipts MODIFY sales_rep_id BIGINT UNSIGNED NULL');
        }
        DB::table('accounts')->insertOrIgnore([
            'code'=>'3990', 'name'=>'Opening Balance Equity', 'type'=>'equity',
            'is_postable'=>true, 'is_active'=>true, 'is_cash_account'=>false,
            'cash_flow_activity'=>'unclassified', 'created_at'=>now(), 'updated_at'=>now(),
        ]);
        Schema::create('customer_opening_balances', function (Blueprint $t) {
            $t->id(); $t->foreignId('customer_id')->unique()->constrained();
            $t->decimal('amount',18,2); $t->date('balance_date'); $t->date('due_date')->nullable();
            $t->foreignId('offset_account_id')->constrained('accounts');
            $t->unsignedBigInteger('invoice_id')->nullable(); $t->unsignedBigInteger('receipt_id')->nullable();
            $t->unsignedBigInteger('journal_id'); $t->timestamps();
        });
    }
    public function down(): void
    {
        // Financial opening entries must be reversed through accounting, never dropped silently.
        throw new RuntimeException('Reverse opening balances before removing this accounting feature.');
    }
};
