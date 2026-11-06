<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // A holding asset, deliberately excluded from cash/bank balances.
        $existing = DB::table('accounts')->where('code', '1120')->first();
        if ($existing && ($existing->name !== 'Cheques in Hand' || $existing->type !== 'asset' || $existing->is_cash_account)) {
            throw new RuntimeException('Account 1120 is already used. Resolve this code conflict before installing cheque collections.');
        }
        DB::table('accounts')->insertOrIgnore([
            'code' => '1120', 'name' => 'Cheques in Hand', 'type' => 'asset',
            'is_postable' => true, 'is_active' => true, 'is_cash_account' => false,
            'is_system' => true, 'cash_flow_activity' => 'operating',
            'parent_id' => DB::table('accounts')->where('type', 'asset')->where('is_postable', false)->whereIn('name', ['Current Assets', 'Assets'])->orderBy('name')->value('id'),
            'description' => 'Customer cheques awaiting bank clearance; not available cash.',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Schema::create('customer_collections', function (Blueprint $t) {
            $t->id();
            $t->uuid('request_key')->unique();
            $t->string('request_fingerprint', 64);
            $t->string('number', 40)->unique();
            $t->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $t->foreignId('collector_sales_rep_id')->constrained('sales_representatives')->restrictOnDelete();
            $t->foreignId('payment_account_id')->constrained('accounts')->restrictOnDelete();
            $t->date('receipt_date');
            $t->string('payment_method', 20);
            $t->decimal('amount', 18, 2);
            $t->string('reference', 80)->nullable();
            $t->string('cheque_number', 80)->nullable();
            $t->string('cheque_bank', 160)->nullable();
            $t->date('cheque_date')->nullable();
            $t->string('status', 20); // received / held / cleared / returned
            $t->date('cleared_date')->nullable();
            $t->foreignId('cleared_account_id')->nullable()->constrained('accounts')->restrictOnDelete();
            $t->date('returned_date')->nullable();
            $t->string('return_reason', 500)->nullable();
            $t->timestamps();
        });
        Schema::create('customer_collection_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('collection_id')->constrained('customer_collections')->restrictOnDelete();
            $t->foreignId('invoice_id')->constrained('sales_invoices')->restrictOnDelete();
            $t->foreignId('receipt_id')->unique()->constrained('customer_receipts')->restrictOnDelete();
            $t->decimal('amount', 18, 2);
            $t->decimal('planned_commission', 18, 2)->default(0);
            $t->string('planned_commission_status', 40);
            $t->unique(['collection_id', 'invoice_id']);
        });
    }

    public function down(): void
    {
        if (DB::table('customer_collections')->exists()) {
            throw new RuntimeException('Posted collections must be retained. Restore application code without removing collection history.');
        }
        Schema::dropIfExists('customer_collection_lines');
        Schema::dropIfExists('customer_collections');
    }
};
