<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $account = DB::table('accounts')->where('code', '5500')->first();
        if ($account && ($account->type !== 'expense' || strtolower($account->name) !== 'bank charges')) {
            throw new RuntimeException('Account 5500 is in use. Resolve the Bank Charges account conflict first.');
        }
        DB::table('accounts')->insertOrIgnore([
            'code' => '5500', 'name' => 'Bank Charges', 'type' => 'expense',
            'is_postable' => true, 'is_active' => true, 'is_cash_account' => false,
            'is_system' => true, 'cash_flow_activity' => 'operating',
            'description' => 'Card processing fees paid by the business.',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Schema::table('customer_collections', function (Blueprint $table) {
            $table->decimal('bank_charge_rate', 5, 2)->default(0);
            $table->decimal('bank_charge_amount', 18, 2)->default(0);
        });
    }

    public function down(): void
    {
        // Retain recorded charges and the expense account for financial history.
    }
};
