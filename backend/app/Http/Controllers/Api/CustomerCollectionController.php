<?php

namespace App\Http\Controllers\Api;

use App\Services\Accounting\AccountPolicy;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class CustomerCollectionController
{
    public function store(Request $request, SalesController $sales, PostingService $posting): JsonResponse
    {
        $data = $request->validate([
            'request_key' => 'required|uuid',
            'customer_id' => 'required|integer|exists:customers,id',
            'collector_sales_rep_id' => 'nullable|integer|exists:sales_representatives,id',
            'receipt_date' => 'required|date_format:Y-m-d|before_or_equal:today',
            'payment_method' => 'required|in:cash,bank_transfer,card,cheque',
            'payment_account_id' => 'nullable|integer|exists:accounts,id',
            'amount' => 'required|numeric|min:0.01|decimal:0,2',
            'deduct_card_charge' => 'sometimes|boolean',
            'reference' => 'nullable|string|max:80',
            'cheque_number' => 'required_if:payment_method,cheque|nullable|string|max:80',
            'cheque_bank' => 'required_if:payment_method,cheque|nullable|string|max:160',
            'cheque_date' => 'required_if:payment_method,cheque|nullable|date_format:Y-m-d',
            'allocations' => 'required|array|min:1|max:500',
            'allocations.*.invoice_id' => 'required|integer|distinct|exists:sales_invoices,id',
            'allocations.*.amount' => 'required|numeric|min:0.01|decimal:0,2',
            'allocations.*.commission_decision' => 'required|in:invoice_salesperson,collector,cancel',
        ]);
        abort_unless(Schema::hasTable('customer_collections'), 422, 'Install the customer collections migration before posting.');
        abort_if(!empty($data['deduct_card_charge']) && $data['payment_method'] !== 'card', 422, 'Bank charge deduction is only available for card payments.');
        $data['collector_sales_rep_id'] = $data['collector_sales_rep_id'] ?? null;
        abort_if(!$data['collector_sales_rep_id'] && collect($data['allocations'])->contains('commission_decision', 'collector'), 422, 'Choose a collector when assigning commission to the payment collector.');
        return DB::transaction(function () use ($data, $sales, $posting, $request) {
            // Serialize submissions for this customer and recheck every invoice under lock.
            DB::table('customers')->where('id', $data['customer_id'])->lockForUpdate()->first();
            $fingerprint = hash('sha256', json_encode($data));
            $existing = DB::table('customer_collections')->where('request_key', $data['request_key'])->first();
            if ($existing) {
                abort_unless((int) $existing->customer_id === (int) $data['customer_id'] && hash_equals($existing->request_fingerprint, $fingerprint), 422, 'This submission key already belongs to a different payment. Refresh before recording another collection.');
                return response()->json($existing);
            }
            $sum = round(collect($data['allocations'])->sum('amount'), 2);
            abort_if(abs($sum - (float) $data['amount']) > 0.001, 422, 'Allocate the exact collected amount across the selected invoices.');
            $cheque = $data['payment_method'] === 'cheque';
            $account = $cheque
                ? DB::table('accounts')->where('code', '1120')->first()
                : DB::table('accounts')->find($data['payment_account_id'] ?? 0);
            abort_unless($account && AccountPolicy::active($account) && $account->is_postable &&
                ($cheque ? ($account->type === 'asset' && !$account->is_cash_account) : AccountPolicy::cash($account)),
                422, 'Choose an active posting account. Cheques require the Cheques in Hand holding account.');
            if ($data['collector_sales_rep_id']) {
                abort_unless(DB::table('sales_representatives')->where('id', $data['collector_sales_rep_id'])->where('status', 'active')->exists(), 422, 'Choose an active collector.');
            }
            $charge = !empty($data['deduct_card_charge']) ? round((float) $data['amount'] * 0.03, 2) : 0;
            if ($charge > 0) {
                $expense = DB::table('accounts')->where('code', '5500')->first();
                abort_unless($expense && $expense->type === 'expense' && $expense->is_postable && AccountPolicy::active($expense), 422, 'An active Bank Charges expense account (5500) is required.');
            }
            $fields = array_diff_key($data, array_flip(['allocations', 'deduct_card_charge']));
            $fields['bank_charge_rate'] = !empty($data['deduct_card_charge']) ? 3 : 0;
            $fields['bank_charge_amount'] = $charge;
            $fields['request_fingerprint'] = $fingerprint;
            $fields['payment_account_id'] = $account->id;
            $fields['status'] = $cheque ? 'held' : 'received';
            if (!$cheque) {
                $fields['cheque_number'] = $fields['cheque_bank'] = $fields['cheque_date'] = null;
            }
            if ($cheque) {
                abort_if(DB::table('customer_collections')->where('customer_id', $data['customer_id'])
                    ->where('cheque_number', $data['cheque_number'])->where('cheque_bank', $data['cheque_bank'])
                    ->whereIn('status', ['held', 'cleared'])->exists(), 422, 'This customer cheque is already recorded. Check the cheque register.');
            }
            $fields['number'] = $data['request_key'];
            $id = DB::table('customer_collections')->insertGetId($fields + ['created_at' => now(), 'updated_at' => now()]);
            $number = 'COL-' . str_pad((string) $id, 6, '0', STR_PAD_LEFT);
            DB::table('customer_collections')->where('id', $id)->update(['number' => $number]);
            $allocations = collect($data['allocations'])->sortBy('invoice_id')->values();
            foreach ($allocations as $index => $allocation) {
                $invoice = DB::table('sales_invoices')->lockForUpdate()->find($allocation['invoice_id']);
                abort_unless((int) $invoice->customer_id === (int) $data['customer_id'] && !in_array($invoice->status, ['void', 'cancelled']), 422, 'All invoices must belong to the selected customer and be active.');
                abort_if($data['receipt_date'] < $invoice->invoice_date, 422, 'Collection date cannot precede an allocated invoice.');
                $result = $sales->postReceipt([
                    'invoice_id' => $invoice->id, 'customer_id' => $data['customer_id'],
                    'collector_sales_rep_id' => $data['collector_sales_rep_id'],
                    'payment_account_id' => $account->id, 'receipt_date' => $data['receipt_date'],
                    'payment_method' => $data['payment_method'], 'reference' => $data['reference'] ?? $data['cheque_number'] ?? null,
                    'collection_type' => abs((float) $allocation['amount'] - (float) $invoice->outstanding) < 0.001 ? 'final' : 'partial',
                    'commission_decision' => $allocation['commission_decision'], 'amount' => $allocation['amount'],
                    'receipt_number' => $number . '-' . str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT),
                ], $cheque);
                $receipt = $result['receipt'];
                $receiptAllocation = DB::table('receipt_allocations')->where('receipt_id', $receipt->id)->first();
                DB::table('customer_collection_lines')->insert([
                    'collection_id' => $id, 'invoice_id' => $invoice->id, 'receipt_id' => $receipt->id,
                    'amount' => $allocation['amount'], 'planned_commission' => $result['commission'],
                    'planned_commission_status' => $receiptAllocation->commission_status,
                    'balance_before' => $invoice->outstanding,
                    'balance_after' => round((float) $invoice->outstanding - (float) $allocation['amount'], 2),
                    'invoice_snapshot' => json_encode((array) $invoice + ['lines' => $this->invoiceItems($invoice->id)]),
                ]);
                if ($cheque) {
                    DB::table('receipt_allocations')->where('receipt_id', $receipt->id)->update([
                        'commission_amount' => 0, 'commission_status' => 'pending_cheque', 'updated_at' => now(),
                    ]);
                }
                $lines = [$this->line($account->code, $allocation['amount'], 0), $this->line('1100', 0, $allocation['amount'])];
                $this->commissionLines($lines, $cheque ? 0 : (float) $result['commission']);
                $posting->post('customer_receipt', $receipt->id, $data['receipt_date'], "$number / customer collection" . ($cheque ? ' (cheque pending clearance)' : ''), $lines);
            }
            if ($charge > 0) {
                $posting->post('card_collection_charge', $id, $data['receipt_date'], "$number / 3% card bank charge", [
                    $this->line('5500', $charge, 0), $this->line($account->code, 0, $charge),
                ]);
            }
            $this->audit('customer_collection.posted', $id, $data + ['bank_charge_amount' => $charge], $request);
            return response()->json(DB::table('customer_collections')->find($id), 201);
        });
    }

    public function transition(Request $request, int $id, PostingService $posting): JsonResponse
    {
        $data = $request->validate([
            'action' => 'required|in:clear,return',
            'date' => 'required|date_format:Y-m-d|before_or_equal:today',
            'bank_account_id' => 'required_if:action,clear|nullable|integer|exists:accounts,id',
            'reason' => 'required_if:action,return|nullable|string|min:3|max:500',
        ]);
        return DB::transaction(function () use ($data, $id, $posting, $request) {
            // Match the receipt posting lock order to avoid cross-customer allocation races.
            $customer = DB::table('customer_collections')->where('id', $id)->value('customer_id');
            abort_unless($customer, 404, 'Collection not found.');
            DB::table('customers')->where('id', $customer)->lockForUpdate()->first();
            $collection = DB::table('customer_collections')->lockForUpdate()->find($id);
            abort_unless($collection->payment_method === 'cheque', 422, 'Only cheque collections have clearance and return actions.');
            $clear = $data['action'] === 'clear';
            abort_if(!$clear && mb_strlen(trim($data['reason'] ?? '')) < 3, 422, 'Enter a clear reason for the cheque return.');
            abort_unless($clear ? $collection->status === 'held' : in_array($collection->status, ['held', 'cleared']), 422, 'This cheque has already been processed. Refresh the register.');
            abort_if($data['date'] < ($collection->cleared_date ?? $collection->receipt_date), 422, 'Action date cannot precede receipt or clearance.');
            abort_if($clear && $data['date'] < $collection->cheque_date, 422, 'A post-dated cheque cannot clear before its cheque date.');
            $holding = DB::table('accounts')->find($collection->payment_account_id);
            $lines = DB::table('customer_collection_lines')->where('collection_id', $id)->orderBy('invoice_id')->get();
            $commission = (float) $lines->sum('planned_commission');
            if ($clear) {
                $bank = DB::table('accounts')->find($data['bank_account_id']);
                abort_unless($bank && AccountPolicy::active($bank) && AccountPolicy::cash($bank) && $bank->is_postable, 422, 'Choose an active cash/bank posting account.');
                $journal = [$this->line($bank->code, $collection->amount, 0), $this->line($holding->code, 0, $collection->amount)];
                $this->commissionLines($journal, $commission);
                $posting->post('cheque_clearance', $id, $data['date'], "$collection->number / cheque cleared", $journal);
                foreach ($lines as $line) {
                    DB::table('receipt_allocations')->where('receipt_id', $line->receipt_id)->update([
                        'commission_amount' => $line->planned_commission, 'commission_status' => $line->planned_commission_status, 'updated_at' => now(),
                    ]);
                }
                DB::table('customer_collections')->where('id', $id)->update([
                    'status' => 'cleared', 'cleared_date' => $data['date'], 'cleared_account_id' => $bank->id, 'updated_at' => now(),
                ]);
            } else {
                if ($collection->status === 'cleared') {
                    $bank = DB::table('accounts')->find($collection->cleared_account_id);
                    $journal = [$this->line($holding->code, $collection->amount, 0), $this->line($bank->code, 0, $collection->amount)];
                    if ($commission > 0) {
                        $journal[] = $this->line('2260', $commission, 0);
                        $journal[] = $this->line('5300', 0, $commission);
                    }
                    $posting->post('cheque_bank_return', $id, $data['date'], "$collection->number / bank returned cheque", $journal);
                }
                // Pass returned funds through the cheque account, then restore the customer's debt.
                $posting->post('cheque_return_receivable', $id, $data['date'], "$collection->number / unpaid invoices restored", [
                    $this->line('1100', $collection->amount, 0), $this->line($holding->code, 0, $collection->amount),
                ]);
                foreach ($lines as $line) {
                    $invoice = DB::table('sales_invoices')->lockForUpdate()->find($line->invoice_id);
                    $received = max(0, round((float) $invoice->received_amount - (float) $line->amount, 2));
                    $outstanding = max(0, round((float) $invoice->total - $received - (float) ($invoice->returned_amount ?? 0), 2));
                    DB::table('sales_invoices')->where('id', $invoice->id)->update([
                        'received_amount' => $received, 'outstanding' => $outstanding,
                        'status' => $outstanding < 0.01 ? 'paid' : ($received > 0 ? 'part_paid' : 'unpaid'), 'updated_at' => now(),
                    ]);
                    // Keep dated receipt allocations intact: reports exclude these returned receipts.
                    DB::table('customer_receipts')->where('id', $line->receipt_id)->update(['status' => 'returned', 'updated_at' => now()]);
                    DB::table('receipt_allocations')->where('receipt_id', $line->receipt_id)->update([
                        'commission_amount' => 0, 'commission_status' => 'cheque_returned', 'updated_at' => now(),
                    ]);
                }
                DB::table('customer_collections')->where('id', $id)->update([
                    'status' => 'returned', 'returned_date' => $data['date'], 'return_reason' => trim($data['reason']), 'updated_at' => now(),
                ]);
            }
            $this->audit('customer_cheque.' . $data['action'], $id, $data, $request);
            return response()->json(DB::table('customer_collections')->find($id));
        });
    }

    /** A correction is an atomic reversal plus a new, independently numbered payment. */
    public function correct(Request $request, int $id, SalesController $sales, PostingService $posting): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:3|max:500']);
        return DB::transaction(function () use ($request, $id, $sales, $posting) {
            $old = DB::table('customer_collections')->find($id);
            abort_unless($old, 404, 'Collection not found.');
            DB::table('customers')->where('id', $old->customer_id)->lockForUpdate()->first();
            $replacement = DB::table('customer_collections')->where('replaces_collection_id', $id)->first();
            if ($replacement) {
                abort_unless($replacement->request_key === $request->input('request_key'), 422, 'This collection has already been corrected.');
                return $this->store($request, $sales, $posting);
            }
            abort_unless((int) $request->input('customer_id') === (int) $old->customer_id, 422, 'A correction must keep the same customer.');
            abort_if($request->input('receipt_date') !== now()->toDateString(), 422, 'Post a correction on today’s date to preserve historical balances.');
            $this->voidPayment($request, $id, $posting);
            $response = $this->store($request, $sales, $posting);
            $new = $response->getData(true);
            DB::table('customer_collections')->where('id', $new['id'])->update(['replaces_collection_id' => $id]);
            $this->audit('customer_collection.corrected', $id, ['replacement_id' => $new['id'], 'reason' => trim($request->input('reason'))], $request);
            return response()->json(DB::table('customer_collections')->find($new['id']));
        });
    }

    public function voidPayment(Request $request, int $id, PostingService $posting): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:3|max:500']);
        abort_if(mb_strlen(trim($request->input('reason'))) < 3, 422, 'Enter a clear reason.');
        return DB::transaction(function () use ($request, $id, $posting) {
            $customer = DB::table('customer_collections')->where('id', $id)->value('customer_id');
            abort_unless($customer, 404, 'Collection not found.');
            DB::table('customers')->where('id', $customer)->lockForUpdate()->first();
            $collection = DB::table('customer_collections')->lockForUpdate()->find($id);
            if ($collection->status === 'void') return response()->json($collection);
            abort_unless(in_array($collection->status, ['received', 'held', 'cleared']), 422, 'Returned collections cannot be deleted or edited.');
            $date = now()->toDateString();
            abort_if($date < ($collection->cleared_date ?? $collection->receipt_date), 422, 'Cannot reverse a future payment.');
            $allocations = DB::table('customer_collection_lines')->where('collection_id', $id)->orderBy('invoice_id')->get();
            $journals = DB::table('journal_entries')->where('status', 'posted')->where(function ($query) use ($allocations, $id) {
                $query->where(function ($q) use ($allocations) {
                    $q->where('source_type', 'customer_receipt')->whereIn('source_id', $allocations->pluck('receipt_id'));
                })->orWhere(function ($q) use ($id) {
                    $q->whereIn('source_type', ['card_collection_charge', 'cheque_clearance'])->where('source_id', $id);
                });
            })->pluck('id');
            $original = DB::table('journal_lines as l')->join('accounts as a', 'a.id', '=', 'l.account_id')
                ->whereIn('l.journal_entry_id', $journals)->get(['a.code', 'l.debit', 'l.credit']);
            abort_if($original->isEmpty(), 422, 'Original accounting entries are missing; the payment cannot be reversed.');
            $posting->post('collection_void', $id, $date, "$collection->number / reversal: " . trim($request->input('reason')),
                $original->map(fn ($line) => $this->line($line->code, (float) $line->credit, (float) $line->debit))->all());
            foreach ($allocations as $line) {
                $invoice = DB::table('sales_invoices')->lockForUpdate()->find($line->invoice_id);
                $received = round((float) $invoice->received_amount - (float) $line->amount, 2);
                abort_if($received < -0.001, 422, 'Invoice balances have changed inconsistently. Review before reversing.');
                $outstanding = max(0, round((float) $invoice->total - $received - (float) ($invoice->returned_amount ?? 0), 2));
                DB::table('sales_invoices')->where('id', $invoice->id)->update([
                    'received_amount' => max(0, $received), 'outstanding' => $outstanding,
                    'status' => $outstanding < 0.01 ? 'paid' : ($received > 0 ? 'part_paid' : 'unpaid'), 'updated_at' => now(),
                ]);
                DB::table('customer_receipts')->where('id', $line->receipt_id)->update(['status' => 'returned', 'updated_at' => now()]);
                DB::table('receipt_allocations')->where('receipt_id', $line->receipt_id)->update([
                    'commission_amount' => 0, 'commission_status' => 'collection_void', 'updated_at' => now(),
                ]);
            }
            DB::table('customer_collections')->where('id', $id)->update([
                'status' => 'void', 'returned_date' => $date, 'void_reason' => trim($request->input('reason')), 'updated_at' => now(),
            ]);
            $this->audit('customer_collection.voided', $id, ['reason' => trim($request->input('reason')), 'date' => $date], $request);
            return response()->json(DB::table('customer_collections')->find($id));
        });
    }

    private function invoiceItems(int $invoiceId)
    {
        $query = DB::table('sales_invoice_lines as l')->where('l.sales_invoice_id', $invoiceId);
        if (Schema::hasTable('articles')) {
            $query->leftJoin('articles as a', 'a.id', '=', 'l.article_id')
                ->select('l.*', 'a.code as article_code', 'a.name as article_name');
        }
        return $query->get();
    }

    private function line(string $account, float $debit, float $credit): array
    {
        return ['account_code' => $account, 'debit' => $debit, 'credit' => $credit];
    }

    private function commissionLines(array &$lines, float $commission): void
    {
        if ($commission > 0) {
            $lines[] = $this->line('5300', $commission, 0);
            $lines[] = $this->line('2260', 0, $commission);
        }
    }

    private function audit(string $event, int $id, array $data, Request $request): void
    {
        DB::table('audit_logs')->insert([
            'event' => $event, 'entity_type' => 'customer_collection',
            'entity_id' => $id, 'payload' => json_encode($data + ['actor_id' => $request->attributes->get('auth_user')?->id ?? $request->user()?->id]), 'created_at' => now(),
        ]);
    }
}
