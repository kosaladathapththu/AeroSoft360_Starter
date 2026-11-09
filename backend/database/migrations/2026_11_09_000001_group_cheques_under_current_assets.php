<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::transaction(function () {
            $cheques = DB::table('accounts')->where('code', '1120')->first();
            if (!$cheques || $cheques->name !== 'Cheques in Hand' || $cheques->type !== 'asset' || $cheques->is_cash_account) {
                throw new RuntimeException('Install the customer collection holding account before grouping it.');
            }
            // Retain an existing valid hierarchy chosen by the administrator.
            if ($cheques->parent_id) return;
            $parent = DB::table('accounts')->where('name', 'Current Assets')->where('type', 'asset')
                ->where('is_postable', false)->where('is_active', true)->first();
            if (!$parent) {
                if (DB::table('accounts')->where('code', '100')->exists()) {
                    throw new RuntimeException('Account code 100 is in use. Create a Current Assets group before retrying.');
                }
                $id = DB::table('accounts')->insertGetId([
                    'code' => '100', 'name' => 'Current Assets', 'type' => 'asset',
                    'is_postable' => false, 'is_active' => true, 'is_cash_account' => false,
                    'is_system' => true, 'cash_flow_activity' => 'unclassified',
                    'description' => 'Group for short-term assets, including cheques awaiting clearance.',
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            } else {
                $id = $parent->id;
            }
            DB::table('accounts')->where('id', $cheques->id)->update(['parent_id' => $id, 'updated_at' => now()]);
        });
    }

    public function down(): void
    {
        // Keep the account hierarchy and all posted history when rolling back code.
    }
};
