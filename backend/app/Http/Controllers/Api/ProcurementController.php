<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Procurement\GoodsReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class ProcurementController extends Controller
{
    public function workspace(): JsonResponse
    {
        return response()->json([
            'suppliers' => DB::table('suppliers')->orderBy('name')->get(),
            'materials' => DB::table('materials')->orderBy('name')->get(),
            'accounts' => DB::table('accounts')->where('is_postable', true)->orderBy('code')->get()->filter(fn($a)=>\App\Services\Accounting\AccountPolicy::active($a))->values(),
            'purchase_orders' => DB::table('purchase_orders as po')
                ->join('suppliers as s', 's.id', '=', 'po.supplier_id')
                ->select('po.*', 's.name as supplier_name')->latest('po.id')->get()
                ->map(function ($order) {
                    $order->lines = DB::table('purchase_order_lines as line')
                        ->join('materials as material', 'material.id', '=', 'line.material_id')
                        ->where('line.purchase_order_id', $order->id)
                        ->select('line.*', 'material.code as material_code', 'material.name as material_name')->get();
                    return $order;
                }),
            'stock' => DB::table('stock_balances as stock')->join('materials as material', 'material.id', '=', 'stock.material_id')
                ->select('stock.*', 'material.code', 'material.name', 'material.category')->orderBy('material.name')->get(),
            'journals' => DB::table('journal_entries')->latest('id')->get()->map(function ($journal) {
                $journal->lines = DB::table('journal_lines as line')->join('accounts as account', 'account.id', '=', 'line.account_id')
                    ->where('line.journal_entry_id', $journal->id)->select('line.*', 'account.code as account_code', 'account.name as account_name')->get();
                return $journal;
            }),
        ]);
    }

    public function storeSupplier(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required','string','max:30','unique:suppliers,code'], 'name' => ['required','string','max:160'], 'phone' => ['nullable','string','max:30'], 'payment_days' => ['required','integer','min:0','max:365']]);
        $id = DB::table('suppliers')->insertGetId($data + ['status' => 'active', 'created_at' => now(), 'updated_at' => now()]);
        return response()->json(DB::table('suppliers')->find($id), 201);
    }

    public function updateSupplier(Request $request, int $supplier): JsonResponse
    {
        abort_unless(DB::table('suppliers')->where('id', $supplier)->exists(), 404, 'Supplier not found.');
        $data = $request->validate([
            'code' => ['required','string','max:30',Rule::unique('suppliers', 'code')->ignore($supplier)],
            'name' => ['required','string','max:160'], 'phone' => ['nullable','string','max:30'],
            'payment_days' => ['required','integer','min:0','max:365'], 'status' => ['required',Rule::in(['active','inactive'])],
        ]);
        DB::table('suppliers')->where('id', $supplier)->update($data + ['updated_at' => now()]);
        $this->audit('supplier.updated', 'supplier', $supplier, $data);
        return response()->json(DB::table('suppliers')->find($supplier));
    }

    public function deleteSupplier(int $supplier): JsonResponse
    {
        abort_if(DB::table('purchase_orders')->where('supplier_id', $supplier)->exists(), 422, 'This supplier has purchase orders and cannot be deleted.');
        abort_unless(DB::table('suppliers')->where('id', $supplier)->delete() === 1, 404, 'Supplier not found.');
        $this->audit('supplier.deleted', 'supplier', $supplier, []);
        return response()->json(['message' => 'Supplier deleted.']);
    }

    public function storePurchaseOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'supplier_id' => ['required','integer','exists:suppliers,id'], 'order_date' => ['required','date'], 'expected_date' => ['nullable','date','after_or_equal:order_date'],
            'lines' => ['required','array','min:1'], 'lines.*.material_id' => ['required','integer','distinct','exists:materials,id'],
            'lines.*.quantity' => ['required','numeric','gt:0'], 'lines.*.unit_cost' => ['required','numeric','gte:0'],
        ]);
        $order = DB::transaction(function () use ($data) {
            $number = 'PO-'.now()->format('ym').'-'.str_pad((string)(DB::table('purchase_orders')->count() + 1), 4, '0', STR_PAD_LEFT);
            $total = collect($data['lines'])->sum(fn ($line) => round($line['quantity'] * $line['unit_cost'], 2));
            $id = DB::table('purchase_orders')->insertGetId(['number'=>$number,'supplier_id'=>$data['supplier_id'],'order_date'=>$data['order_date'],'expected_date'=>$data['expected_date'] ?? null,'status'=>'draft','total'=>$total,'created_at'=>now(),'updated_at'=>now()]);
            foreach ($data['lines'] as $line) DB::table('purchase_order_lines')->insert(['purchase_order_id'=>$id,'material_id'=>$line['material_id'],'quantity'=>$line['quantity'],'received_quantity'=>0,'unit_cost'=>$line['unit_cost'],'line_total'=>round($line['quantity']*$line['unit_cost'],2),'created_at'=>now(),'updated_at'=>now()]);
            DB::table('audit_logs')->insert(['event'=>'purchase_order.created','entity_type'=>'purchase_order','entity_id'=>$id,'payload'=>json_encode(['number'=>$number,'total'=>$total]),'created_at'=>now()]);
            return DB::table('purchase_orders')->find($id);
        });
        return response()->json($order, 201);
    }

    public function updatePurchaseOrder(Request $request, int $purchaseOrder): JsonResponse
    {
        $order = DB::table('purchase_orders')->find($purchaseOrder);
        abort_unless($order, 404, 'Purchase order not found.');
        $data = $request->validate([
            'supplier_id' => ['required','integer','exists:suppliers,id'], 'order_date' => ['required','date'],
            'expected_date' => ['nullable','date','after_or_equal:order_date'],
            'status' => ['required',Rule::in(['draft','approved','part_received','received','cancelled'])],
        ]);
        $data['approved_at'] = $data['status'] === 'draft' ? null : ($order->approved_at ?: now());
        DB::table('purchase_orders')->where('id', $purchaseOrder)->update($data + ['updated_at' => now()]);
        $this->audit('purchase_order.updated', 'purchase_order', $purchaseOrder, $data);
        return response()->json(DB::table('purchase_orders')->find($purchaseOrder));
    }

    public function deletePurchaseOrder(int $purchaseOrder): JsonResponse
    {
        abort_if(DB::table('goods_receipts')->where('purchase_order_id', $purchaseOrder)->exists(), 422, 'This purchase order has received goods. Delete is blocked to protect stock and accounting history.');
        DB::transaction(function () use ($purchaseOrder): void {
            DB::table('purchase_order_lines')->where('purchase_order_id', $purchaseOrder)->delete();
            abort_unless(DB::table('purchase_orders')->where('id', $purchaseOrder)->delete() === 1, 404, 'Purchase order not found.');
            $this->audit('purchase_order.deleted', 'purchase_order', $purchaseOrder, []);
        });
        return response()->json(['message' => 'Purchase order deleted.']);
    }

    public function updateStock(Request $request, int $stock): JsonResponse
    {
        abort_unless(DB::table('stock_balances')->where('id', $stock)->exists(), 404, 'Stock batch not found.');
        $data = $request->validate([
            'batch_number' => ['required','string','max:80'], 'quantity' => ['required','numeric','gte:0'],
            'unit_cost' => ['required','numeric','gte:0'],
        ]);
        $duplicate = DB::table('stock_balances')->where('batch_number', $data['batch_number'])->where('id', '<>', $stock)
            ->where('material_id', DB::table('stock_balances')->where('id', $stock)->value('material_id'))->exists();
        abort_if($duplicate, 422, 'That batch number already exists for this material.');
        DB::table('stock_balances')->where('id', $stock)->update($data + ['updated_at' => now()]);
        $this->audit('stock_balance.updated', 'stock_balance', $stock, $data);
        return response()->json(DB::table('stock_balances')->find($stock));
    }

    public function deleteStock(int $stock): JsonResponse
    {
        abort_unless(DB::table('stock_balances')->where('id', $stock)->delete() === 1, 404, 'Stock batch not found.');
        $this->audit('stock_balance.deleted', 'stock_balance', $stock, []);
        return response()->json(['message' => 'Stock batch deleted.']);
    }

    public function updateJournal(Request $request, int $journal): JsonResponse
    {
        abort_unless(DB::table('journal_entries')->where('id', $journal)->exists(), 404, 'Journal not found.');
        $data = $request->validate([
            'posting_date' => ['required','date'], 'description' => ['required','string','max:255'],
            'status' => ['required',Rule::in(['draft','posted','void'])],
        ]);
        DB::table('journal_entries')->where('id', $journal)->update($data + ['posted_at' => $data['status'] === 'posted' ? now() : null, 'updated_at' => now()]);
        $this->audit('journal.updated', 'journal', $journal, $data);
        return response()->json(DB::table('journal_entries')->find($journal));
    }

    public function deleteJournal(int $journal): JsonResponse
    {
        DB::transaction(function () use ($journal): void {
            DB::table('journal_lines')->where('journal_entry_id', $journal)->delete();
            abort_unless(DB::table('journal_entries')->where('id', $journal)->delete() === 1, 404, 'Journal not found.');
            $this->audit('journal.deleted', 'journal', $journal, []);
        });
        return response()->json(['message' => 'Journal deleted.']);
    }

    public function approvePurchaseOrder(int $purchaseOrder): JsonResponse
    {
        $updated = DB::table('purchase_orders')->where('id', $purchaseOrder)->where('status', 'draft')->update(['status'=>'approved','approved_at'=>now(),'updated_at'=>now()]);
        abort_unless($updated === 1, 422, 'Only a draft purchase order can be approved.');
        DB::table('audit_logs')->insert(['event'=>'purchase_order.approved','entity_type'=>'purchase_order','entity_id'=>$purchaseOrder,'payload'=>'{}','created_at'=>now()]);
        return response()->json(DB::table('purchase_orders')->find($purchaseOrder));
    }

    public function receivePurchaseOrder(Request $request, int $purchaseOrder, GoodsReceiptService $service): JsonResponse
    {
        $data = $request->validate(['received_on'=>['required','date'], 'supplier_invoice'=>['nullable','string','max:80'], 'lines'=>['required','array','min:1'], 'lines.*.purchase_order_line_id'=>['required','integer','distinct'], 'lines.*.quantity'=>['required','numeric','gt:0'], 'lines.*.batch_number'=>['required','string','max:80']]);
        return response()->json($service->receive($purchaseOrder, $data), 201);
    }

    private function audit(string $event, string $type, int $id, array $payload): void
    {
        DB::table('audit_logs')->insert(['event' => $event, 'entity_type' => $type, 'entity_id' => $id, 'payload' => json_encode($payload), 'created_at' => now()]);
    }
}
