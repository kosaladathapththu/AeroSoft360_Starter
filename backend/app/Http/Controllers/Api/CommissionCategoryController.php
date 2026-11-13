<?php

namespace App\Http\Controllers\Api;

use App\Services\Accounting\CommissionPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class CommissionCategoryController
{
    public function index(Request $request)
    {
        $category = $request->validate(['category' => 'required|in:direct,head_office'])['category'];
        CommissionPolicy::guard($request, $category);
        $manual = DB::table('manual_commissions as m')->join('sales_representatives as rep', 'rep.id', '=', 'm.sales_rep_id')
            ->where('m.commission_category', $category)->select('m.*', 'rep.name as rep_name')->latest('m.id')->get();
        $automatic = DB::table('receipt_allocations as a')->join('customer_receipts as r', 'r.id', '=', 'a.receipt_id')
            ->join('sales_invoices as i', 'i.id', '=', 'a.invoice_id')->leftJoin('sales_representatives as rep', 'rep.id', '=', 'a.commission_payee_sales_rep_id')
            ->where('a.commission_category', $category)->select('a.*', 'r.receipt_date', 'r.number as receipt_number', 'i.number as invoice_number', 'rep.name as rep_name')->latest('a.id')->get();
        $reps = DB::table('sales_representatives')->where('status', 'active');
        $category === 'head_office' ? $reps->where('channel', 'head_office') : $reps->where(fn ($q) => $q->where('channel', '!=', 'head_office')->orWhereNull('channel'));
        $settings = $category === 'head_office' ? DB::table('head_office_commission_settings')->first() : DB::table('commission_settings')->first();
        return response()->json(['manual' => $manual, 'automatic' => $automatic, 'reps' => $reps->orderBy('name')->get(),
            'rate_per_piece' => $category === 'head_office' ? $settings->rate_per_piece : null, 'max_collection_days' => $settings->max_collection_days ?? 100]);
    }

    public function status(Request $request)
    {
        return response()->json(['configured' => (bool) DB::table('head_office_commission_settings')->value('password_hash'), 'unlocked' => CommissionPolicy::unlocked($request)]);
    }

    public function unlock(Request $request)
    {
        $data = $request->validate(['password' => 'required|string|max:255']);
        $hash = DB::table('head_office_commission_settings')->value('password_hash');
        abort_unless($hash && Hash::check($data['password'], $hash), 422, 'Incorrect Head Office password.');
        Cache::put(CommissionPolicy::key($request), true, now()->addMinutes(15));
        return response()->json(['unlocked' => true]);
    }

    public function lock(Request $request)
    {
        Cache::forget(CommissionPolicy::key($request));
        return response()->json(['unlocked' => false]);
    }

    public function settings(Request $request)
    {
        $data = $request->validate(['password' => 'nullable|string|min:12|max:255|confirmed', 'current_password' => 'nullable|string|max:255',
            'rate_per_piece' => 'required|numeric|min:0|max:999999', 'max_collection_days' => 'required|integer|min:1|max:365']);
        $hash = DB::table('head_office_commission_settings')->value('password_hash');
        abort_if($hash && !Hash::check($data['current_password'] ?? '', $hash), 422, 'Enter the current Head Office password to change its settings.');
        abort_if(!$hash && empty($data['password']), 422, 'Set a Head Office password first (at least 12 characters).');
        $values = ['rate_per_piece' => $data['rate_per_piece'], 'max_collection_days' => $data['max_collection_days'], 'updated_at' => now()];
        if (!empty($data['password'])) $values['password_hash'] = Hash::make($data['password']);
        DB::table('head_office_commission_settings')->where('id', 1)->update($values);
        Cache::put(CommissionPolicy::key($request), true, now()->addMinutes(15));
        DB::table('audit_logs')->insert(['event' => 'commission.head_office_settings_updated', 'entity_type' => 'commission_settings', 'entity_id' => 1,
            'payload' => json_encode(['rate_per_piece' => $data['rate_per_piece'], 'max_collection_days' => $data['max_collection_days'], 'user_id' => $request->attributes->get('auth_user')?->id]), 'created_at' => now()]);
        return response()->json(['message' => 'Head Office settings saved. Existing commissions keep their posted rates.']);
    }
}
