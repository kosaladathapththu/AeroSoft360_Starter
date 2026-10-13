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
}
