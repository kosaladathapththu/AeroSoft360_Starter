<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Accounting\PostingService;
use App\Services\Inventory\FinishedGoodsInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class AccountingSalesController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $recentInvoices = DB::table('sales_invoices as invoice')->join('customers as customer', 'customer.id', '=', 'invoice.customer_id')->join('sales_representatives as rep', 'rep.id', '=', 'invoice.sales_rep_id')->select('invoice.id', 'invoice.number', 'invoice.outstanding', 'invoice.status', 'customer.name as customer_name', 'rep.name as rep_name')->latest('invoice.id')->limit(5)->get();
        $recentReceipts = DB::table('customer_receipts as receipt')->join('customers as customer', 'customer.id', '=', 'receipt.customer_id')->select('receipt.id', 'receipt.number', 'receipt.receipt_date', 'receipt.amount', 'customer.name as customer_name')->latest('receipt.id')->limit(5)->get();
        $automaticCommission = (float) DB::table('receipt_allocations')->where('commission_status', 'eligible')->sum('commission_amount');
        $manualCommission = (float) DB::table('manual_commissions')->where('status', 'eligible')->sum('commission_amount');
        return response()->json([
            'customers_count'=>DB::table('customers')->where('status', 'active')->count(),
            'open_invoices_count'=>DB::table('sales_invoices')->where('outstanding', '>', 0)->count(),
            'outstanding_total'=>(float) DB::table('sales_invoices')->sum('outstanding'),
            'collections_total'=>(float) DB::table('customer_receipts')->sum('amount'),
            'commission_total'=>$automaticCommission + $manualCommission,
            'recent_invoices'=>$recentInvoices, 'recent_receipts'=>$recentReceipts,
        ]);
    }

    public function workspace(SalesController $sales): JsonResponse
    {
        $data = $sales->workspace()->getData(true);
        $manual = DB::table('manual_commissions as m')
            ->join('sales_representatives as rep', 'rep.id', '=', 'm.sales_rep_id')
            ->leftJoin('customers as c', 'c.id', '=', 'm.customer_id')
            ->leftJoin('sales_invoices as i', 'i.id', '=', 'm.invoice_id')
            ->leftJoin('customer_receipts as r', 'r.id', '=', 'm.receipt_id')
            ->select(DB::raw('(-m.id) as id'), 'm.id as manual_id', 'm.sales_rep_id', 'm.customer_id', 'm.invoice_id', 'm.receipt_id', 'rep.name as rep_name', 'c.name as customer_name', 'i.number as invoice_number',
                'r.number as receipt_number', 'm.commission_date as receipt_date', 'm.basis_amount as amount',
                DB::raw('0 as days_taken'), 'm.commission_rate', 'm.status as commission_status', 'm.commission_amount',
                'm.notes', DB::raw("'manual' as source_type"))
            ->latest('m.id')->get()->map(fn ($row) => (array) $row)->all();
        $data['commissions'] = array_values(array_merge($manual, $data['commissions'] ?? []));
        $data['finished_stock'] = Schema::hasTable('finished_goods_stock')
            ? DB::table('finished_goods_stock as stock')->join('articles as article', 'article.id', '=', 'stock.article_id')
                ->select('stock.*', 'article.code as article_code', 'article.name as article_name', 'article.category')
                ->orderBy('article.code')->orderBy('stock.size_label')->get()
            : [];
        $data['commission_settings'] = Schema::hasTable('commission_settings') ? DB::table('commission_settings')->first() : (object) ['max_collection_days'=>100];
        return response()->json($data);
    }

    public function updateCommissionSettings(Request $request): JsonResponse
    {
        $data = $request->validate(['max_collection_days'=>['required','integer','min:1','max:365']]);
        $id = DB::table('commission_settings')->value('id');
        if ($id) DB::table('commission_settings')->where('id', $id)->update($data + ['updated_at'=>now()]);
        else $id = DB::table('commission_settings')->insertGetId($data + ['created_at'=>now(), 'updated_at'=>now()]);
        return response()->json(DB::table('commission_settings')->find($id));
    }

    public function manualCommission(Request $request, PostingService $posting): JsonResponse
    {
        $data = $request->validate([
            'sales_rep_id'=>['required','integer','exists:sales_representatives,id'],
            'customer_id'=>['nullable','integer','exists:customers,id'], 'invoice_id'=>['nullable','integer','exists:sales_invoices,id'],
            'receipt_id'=>['nullable','integer','exists:customer_receipts,id'], 'commission_date'=>['required','date'],
            'basis_amount'=>['required','numeric','gte:0'], 'commission_rate'=>['required','numeric','gte:0'],
            'commission_amount'=>['nullable','numeric','gte:0'], 'notes'=>['nullable','string','max:255'],
        ]);
        return DB::transaction(function () use ($data, $posting) {
            $data['commission_amount'] = round((float) $data['basis_amount'] * (float) $data['commission_rate'], 2);
            abort_if($data['commission_amount'] <= 0, 422, 'Commission amount must be greater than zero.');
            $id = DB::table('manual_commissions')->insertGetId($data + ['status'=>'eligible', 'created_at'=>now(), 'updated_at'=>now()]);
            $amount = round((float) $data['commission_amount'], 2);
            $journalId = $posting->post('manual_commission', $id, $data['commission_date'], "Manual sales commission #{$id}", [
                ['account_code'=>'5300', 'debit'=>$amount, 'credit'=>0, 'description'=>'Sales commission expense'],
                ['account_code'=>'2260', 'debit'=>0, 'credit'=>$amount, 'description'=>'Commission payable'],
            ]);
            $result = (array) DB::table('manual_commissions')->find($id);
            $result['journal_id'] = $journalId;
            $this->audit('commission.manual_posted', 'manual_commission', $id, ['journal_id'=>$journalId, 'amount'=>$amount]);
            return response()->json($result, 201);
        });
    }

    public function updateManualCommission(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'sales_rep_id'=>['required','integer','exists:sales_representatives,id'],
            'customer_id'=>['nullable','integer','exists:customers,id'], 'invoice_id'=>['nullable','integer','exists:sales_invoices,id'],
            'receipt_id'=>['nullable','integer','exists:customer_receipts,id'], 'commission_date'=>['required','date'],
            'basis_amount'=>['required','numeric','gte:0'], 'commission_rate'=>['required','numeric','gte:0'],
            'commission_amount'=>['nullable','numeric','gte:0'], 'notes'=>['nullable','string','max:255'],
        ]);
        return DB::transaction(function () use ($data, $id) {
            abort_unless(DB::table('manual_commissions')->where('id', $id)->exists(), 404, 'Manual commission not found.');
            $data['commission_amount'] = round((float) $data['basis_amount'] * (float) $data['commission_rate'], 2);
            abort_if($data['commission_amount'] <= 0, 422, 'Commission amount must be greater than zero.');
            DB::table('manual_commissions')->where('id', $id)->update($data + ['updated_at'=>now()]);
            $journalId = DB::table('journal_entries')->where(['source_type'=>'manual_commission', 'source_id'=>$id])->value('id');
            if ($journalId) {
                DB::table('journal_entries')->where('id', $journalId)->update(['posting_date'=>$data['commission_date'], 'updated_at'=>now()]);
                $expense = DB::table('accounts')->where('code', '5300')->value('id');
                $payable = DB::table('accounts')->where('code', '2260')->value('id');
                DB::table('journal_lines')->where('journal_entry_id', $journalId)->where('account_id', $expense)->update(['debit'=>$data['commission_amount'], 'updated_at'=>now()]);
                DB::table('journal_lines')->where('journal_entry_id', $journalId)->where('account_id', $payable)->update(['credit'=>$data['commission_amount'], 'updated_at'=>now()]);
            }
            return response()->json(DB::table('manual_commissions')->find($id));
        });
    }

    public function deleteManualCommission(int $id): JsonResponse
    {
        return DB::transaction(function () use ($id) {
            $journalId = DB::table('journal_entries')->where(['source_type'=>'manual_commission', 'source_id'=>$id])->value('id');
            if ($journalId) DB::table('journal_entries')->where('id', $journalId)->delete();
            abort_unless(DB::table('manual_commissions')->where('id', $id)->delete() === 1, 404, 'Manual commission not found.');
            return response()->json(['message'=>'Manual commission deleted.']);
        });
    }

    public function updateAutomaticCommission(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'commission_rate'=>['required','numeric','gte:0'],
            'commission_amount'=>['required','numeric','gte:0'],
            'commission_status'=>['required','in:eligible,blocked_late,void'],
        ]);
        return DB::transaction(function () use ($data, $id) {
            $allocation = DB::table('receipt_allocations')->find($id);
            abort_unless($allocation, 404, 'Commission not found.');
            DB::table('receipt_allocations')->where('id', $id)->update($data + ['updated_at'=>now()]);
            $this->syncReceiptCommissionJournal((int) $allocation->receipt_id, (float) $data['commission_amount']);
            $this->audit('commission.updated', 'receipt_allocation', $id, $data);
            return response()->json(DB::table('receipt_allocations')->find($id));
        });
    }

    public function deleteAutomaticCommission(int $id): JsonResponse
    {
        return DB::transaction(function () use ($id) {
            $allocation = DB::table('receipt_allocations')->find($id);
            abort_unless($allocation, 404, 'Commission not found.');
            DB::table('receipt_allocations')->where('id', $id)->update([
                'commission_rate'=>0, 'commission_amount'=>0, 'commission_status'=>'void', 'updated_at'=>now(),
            ]);
            $this->syncReceiptCommissionJournal((int) $allocation->receipt_id, 0);
            $this->audit('commission.voided', 'receipt_allocation', $id, []);
            return response()->json(['message'=>'Commission deleted. The customer payment allocation was preserved.']);
        });
    }

    private function syncReceiptCommissionJournal(int $receiptId, float $amount): void
    {
        $journalId = DB::table('journal_entries')->where(['source_type'=>'customer_receipt', 'source_id'=>$receiptId])->value('id');
        if (!$journalId) return;
        $expense = DB::table('accounts')->where('code', '5300')->value('id');
        $payable = DB::table('accounts')->where('code', '2260')->value('id');
        if (!$expense || !$payable) return;
        $existingExpense = DB::table('journal_lines')->where(['journal_entry_id'=>$journalId, 'account_id'=>$expense])->first();
        $existingPayable = DB::table('journal_lines')->where(['journal_entry_id'=>$journalId, 'account_id'=>$payable])->first();
        if ($amount <= 0) {
            DB::table('journal_lines')->where('journal_entry_id', $journalId)->whereIn('account_id', [$expense, $payable])->delete();
            return;
        }
        $values = ['updated_at'=>now()];
        if ($existingExpense) DB::table('journal_lines')->where('id', $existingExpense->id)->update($values + ['debit'=>$amount, 'credit'=>0]);
        else DB::table('journal_lines')->insert(['journal_entry_id'=>$journalId, 'account_id'=>$expense, 'debit'=>$amount, 'credit'=>0, 'description'=>'Sales commission expense', 'created_at'=>now(), 'updated_at'=>now()]);
        if ($existingPayable) DB::table('journal_lines')->where('id', $existingPayable->id)->update($values + ['debit'=>0, 'credit'=>$amount]);
        else DB::table('journal_lines')->insert(['journal_entry_id'=>$journalId, 'account_id'=>$payable, 'debit'=>0, 'credit'=>$amount, 'description'=>'Commission payable', 'created_at'=>now(), 'updated_at'=>now()]);
    }

    public function deleteCustomer(int $id): JsonResponse
    {
        abort_if(DB::table('customer_pos')->where('customer_id', $id)->exists() || DB::table('sales_invoices')->where('customer_id', $id)->exists(), 422, 'Customer has transactions and cannot be deleted. Set it inactive instead.');
        abort_unless(DB::table('customers')->where('id', $id)->delete() === 1, 404, 'Customer not found.');
        return response()->json(['message'=>'Customer deleted.']);
    }

    public function deleteSalesRep(int $id): JsonResponse
    {
        abort_if(DB::table('customer_pos')->where('sales_rep_id', $id)->exists() || DB::table('customer_receipts')->where('sales_rep_id', $id)->exists(), 422, 'Salesperson has transactions and cannot be deleted. Set them inactive instead.');
        abort_unless(DB::table('sales_representatives')->where('id', $id)->delete() === 1, 404, 'Salesperson not found.');
        return response()->json(['message'=>'Salesperson deleted.']);
    }

    public function deleteArticle(int $id): JsonResponse
    {
        abort_if(DB::table('customer_po_lines')->where('article_id', $id)->exists() || DB::table('sales_order_size_lines')->where('article_id', $id)->exists(), 422, 'Article has transactions and cannot be deleted. Set it inactive instead.');
        abort_unless(DB::table('articles')->where('id', $id)->delete() === 1, 404, 'Article not found.');
        return response()->json(['message'=>'Article deleted.']);
    }

    public function updateCustomerPo(Request $request, int $id, SalesController $sales): JsonResponse
    {
        $po = DB::table('customer_pos')->find($id);
        abort_unless($po, 404, 'Customer PO not found.');
        if ($po->status === 'draft') return $sales->updatePo($request, $id);
        $data = $request->validate([
            'customer_id'=>'required|exists:customers,id', 'sales_rep_id'=>'required|exists:sales_representatives,id',
            'customer_po_reference'=>'nullable|max:80', 'po_date'=>'required|date', 'sale_type'=>'required|in:cash,credit,mixed',
            'lines'=>'required|array|min:1',
        ]);
        return DB::transaction(function () use ($data, $id) {
            DB::table('customer_pos')->where('id', $id)->update([
                'customer_id'=>$data['customer_id'], 'sales_rep_id'=>$data['sales_rep_id'],
                'customer_po_reference'=>$data['customer_po_reference'] ?? null, 'po_date'=>$data['po_date'],
                'sale_type'=>$data['sale_type'], 'updated_at'=>now(),
            ]);
            $orderIds = DB::table('sales_orders')->where('customer_po_id', $id)->pluck('id');
            DB::table('sales_orders')->whereIn('id', $orderIds)->update(['customer_id'=>$data['customer_id'], 'sales_rep_id'=>$data['sales_rep_id'], 'order_date'=>$data['po_date'], 'updated_at'=>now()]);
            DB::table('sales_invoices')->whereIn('sales_order_id', $orderIds)->update(['customer_id'=>$data['customer_id'], 'sales_rep_id'=>$data['sales_rep_id'], 'sale_type'=>$data['sale_type'], 'updated_at'=>now()]);
            return response()->json(DB::table('customer_pos')->find($id));
        });
    }

    public function deleteCustomerPo(int $id): JsonResponse
    {
        return DB::transaction(function () use ($id) {
            $po = DB::table('customer_pos')->find($id);
            abort_unless($po, 404, 'Customer PO not found.');
            $orderIds = DB::table('sales_orders')->where('customer_po_id', $id)->pluck('id');
            $invoiceIds = DB::table('sales_invoices')->whereIn('sales_order_id', $orderIds)->pluck('id');
            $receiptIds = DB::table('receipt_allocations')->whereIn('invoice_id', $invoiceIds)->distinct()->pluck('receipt_id');
            $manualCommissionIds = DB::table('manual_commissions')->where(function ($query) use ($invoiceIds, $receiptIds) {
                $query->whereIn('invoice_id', $invoiceIds)->orWhereIn('receipt_id', $receiptIds);
            })->pluck('id');
            foreach ($manualCommissionIds as $commissionId) $this->deleteManualCommission((int) $commissionId);
            foreach ($receiptIds as $receiptId) $this->deleteReceipt((int) $receiptId);
            foreach ($invoiceIds as $invoiceId) $this->deleteInvoice((int) $invoiceId);
            DB::table('sales_order_size_lines')->whereIn('sales_order_id', $orderIds)->delete();
            DB::table('sales_orders')->whereIn('id', $orderIds)->delete();
            DB::table('customer_po_lines')->where('customer_po_id', $id)->delete();
            DB::table('customer_pos')->where('id', $id)->delete();
            return response()->json(['message'=>'Customer PO and all linked sales records were deleted.']);
        });
    }

    public function updateSalesOrder(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['order_date'=>['required','date'], 'status'=>['required','in:confirmed,part_invoiced,invoiced,cancelled']]);
        abort_unless(DB::table('sales_orders')->where('id', $id)->update($data + ['updated_at'=>now()]) === 1, 404, 'Sales order not found.');
        return response()->json(DB::table('sales_orders')->find($id));
    }

    public function deleteSalesOrder(int $id): JsonResponse
    {
        return DB::transaction(function () use ($id) {
            $order = DB::table('sales_orders')->find($id);
            abort_unless($order, 404, 'Sales order not found.');
            abort_if(DB::table('sales_invoices')->where('sales_order_id', $id)->exists(), 422, 'Sales order has invoices and cannot be deleted.');
            DB::table('sales_order_size_lines')->where('sales_order_id', $id)->delete();
            DB::table('sales_orders')->where('id', $id)->delete();
            DB::table('customer_pos')->where('id', $order->customer_po_id)->update(['status'=>'draft', 'updated_at'=>now()]);
            return response()->json(['message'=>'Sales order deleted.']);
        });
    }

    public function updateInvoice(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'customer_id'=>['required','integer','exists:customers,id'], 'sales_rep_id'=>['required','integer','exists:sales_representatives,id'],
            'invoice_date'=>['required','date'], 'due_date'=>['required','date','after_or_equal:invoice_date'], 'sale_type'=>['required','in:cash,credit,mixed'],
            'reference'=>['nullable','string','max:80'], 'discount'=>['nullable','numeric','gte:0'], 'tax'=>['nullable','numeric','gte:0'],
            'lines'=>['required','array','min:1'], 'lines.*.article_id'=>['required','integer','exists:articles,id'],
            'lines.*.size_label'=>['required','string','max:30'], 'lines.*.quantity'=>['required','numeric','gt:0'], 'lines.*.rate'=>['required','numeric','gte:0'],
        ]);
        return DB::transaction(function () use ($data, $id) {
            $invoice = DB::table('sales_invoices')->lockForUpdate()->find($id);
            abort_unless($invoice, 404, 'Invoice not found.');
            abort_if(DB::table('receipt_allocations')->where('invoice_id', $id)->exists(), 422, 'This invoice has collections. Delete the collections before changing customer, salesperson, amounts or item lines.');
            $subtotal = round(collect($data['lines'])->sum(fn ($line) => $line['quantity'] * $line['rate']), 2);
            $discount = round((float) ($data['discount'] ?? 0), 2); $tax = round((float) ($data['tax'] ?? 0), 2);
            abort_if($discount > $subtotal, 422, 'Discount cannot exceed the invoice subtotal.');
            $total = round($subtotal - $discount + $tax, 2); abort_if($total <= 0, 422, 'Invoice total must be greater than zero.');
            if (Schema::hasTable('finished_goods_movements')) app(FinishedGoodsInventoryService::class)->restoreInvoice($id, $data['invoice_date']);
            $oldLines = DB::table('sales_invoice_lines')->where('sales_invoice_id', $id)->get();
            foreach ($oldLines as $line) if ($line->sales_order_size_line_id) DB::table('sales_order_size_lines')->where('id', $line->sales_order_size_line_id)->decrement('invoiced_quantity', $line->quantity, ['updated_at'=>now()]);
            DB::table('sales_invoice_lines')->where('sales_invoice_id', $id)->delete();
            $manualOrder = str_starts_with((string) DB::table('sales_orders')->where('id', $invoice->sales_order_id)->value('number'), 'SO-MAN-');
            foreach ($data['lines'] as $line) {
                $orderLine = DB::table('sales_order_size_lines')->where('sales_order_id', $invoice->sales_order_id)->where('article_id', $line['article_id'])->where('size_label', $line['size_label'])->first();
                if (! $orderLine) {
                    abort_unless($manualOrder, 422, 'The selected article and size are not part of the linked sales order.');
                    $orderLineId = DB::table('sales_order_size_lines')->insertGetId(['sales_order_id'=>$invoice->sales_order_id,'article_id'=>$line['article_id'],'size_label'=>$line['size_label'],'quantity'=>$line['quantity'],'invoiced_quantity'=>$line['quantity'],'rate'=>$line['rate'],'created_at'=>now(),'updated_at'=>now()]);
                } else {
                    $available = (float) $orderLine->quantity - (float) $orderLine->invoiced_quantity;
                    abort_if(! $manualOrder && (float) $line['quantity'] > $available + .0001, 422, "Quantity for size {$line['size_label']} exceeds the remaining sales-order quantity.");
                    $orderLineId = $orderLine->id;
                    DB::table('sales_order_size_lines')->where('id', $orderLineId)->update(['quantity'=>$manualOrder?$line['quantity']:$orderLine->quantity,'invoiced_quantity'=>DB::raw('invoiced_quantity + '.(float)$line['quantity']),'rate'=>$line['rate'],'updated_at'=>now()]);
                }
                DB::table('sales_invoice_lines')->insert(['sales_invoice_id'=>$id,'sales_order_size_line_id'=>$orderLineId,'article_id'=>$line['article_id'],'size_label'=>$line['size_label'],'quantity'=>$line['quantity'],'rate'=>$line['rate'],'line_total'=>round($line['quantity']*$line['rate'],2),'created_at'=>now(),'updated_at'=>now()]);
            }
            DB::table('sales_invoices')->where('id', $id)->update(['customer_id'=>$data['customer_id'],'sales_rep_id'=>$data['sales_rep_id'],'invoice_date'=>$data['invoice_date'],'due_date'=>$data['due_date'],'sale_type'=>$data['sale_type'],'subtotal'=>$subtotal,'discount'=>$discount,'tax'=>$tax,'total'=>$total,'outstanding'=>$total,'status'=>'unpaid','updated_at'=>now()]);
            DB::table('customer_pos')->where('id', DB::table('sales_orders')->where('id',$invoice->sales_order_id)->value('customer_po_id'))->update(['customer_po_reference'=>$data['reference']??null,'updated_at'=>now()]);
            if (Schema::hasTable('finished_goods_movements')) app(FinishedGoodsInventoryService::class)->issueInvoice($id, $data['invoice_date']);
            $journalId=DB::table('journal_entries')->where(['source_type'=>'sales_invoice','source_id'=>$id])->value('id');
            if($journalId){DB::table('journal_lines')->where('journal_entry_id',$journalId)->delete();$lines=[['1100',$total,0,'Accounts receivable'],['4000',0,$subtotal-$discount,'Domestic sales revenue']];if($tax>0)$lines[]=['2300',0,$tax,'Sales tax payable'];foreach($lines as[$code,$debit,$credit,$description]){$account=DB::table('accounts')->where('code',$code)->value('id');if($account)DB::table('journal_lines')->insert(['journal_entry_id'=>$journalId,'account_id'=>$account,'debit'=>$debit,'credit'=>$credit,'description'=>$description,'created_at'=>now(),'updated_at'=>now()]);}DB::table('journal_entries')->where('id',$journalId)->update(['posting_date'=>$data['invoice_date'],'description'=>"Customer invoice {$invoice->number}",'updated_at'=>now()]);}
            return response()->json(DB::table('sales_invoices')->find($id));
        });
    }

    public function deleteInvoice(int $id): JsonResponse
    {
        return DB::transaction(function () use ($id) {
            $invoice = DB::table('sales_invoices')->find($id);
            abort_unless($invoice, 404, 'Invoice not found.');
            abort_if(DB::table('receipt_allocations')->where('invoice_id', $id)->exists(), 422, 'Invoice has collections and cannot be deleted. Delete the collections first.');
            $lines = DB::table('sales_invoice_lines')->where('sales_invoice_id', $id)->get();
            app(FinishedGoodsInventoryService::class)->restoreInvoice($id, now()->toDateString());
            DB::table('journal_entries')->where(['source_type'=>'sales_invoice', 'source_id'=>$id])->delete();
            DB::table('sales_invoices')->where('id', $id)->delete();
            foreach ($lines as $line) DB::table('sales_order_size_lines')->where('id', $line->sales_order_size_line_id)->decrement('invoiced_quantity', $line->quantity, ['updated_at'=>now()]);
            $hasInvoiced = DB::table('sales_order_size_lines')->where('sales_order_id', $invoice->sales_order_id)->where('invoiced_quantity', '>', 0)->exists();
            DB::table('sales_orders')->where('id', $invoice->sales_order_id)->update(['status'=>$hasInvoiced ? 'part_invoiced' : 'confirmed', 'updated_at'=>now()]);
            return response()->json(['message'=>'Invoice and its journal deleted.']);
        });
    }

    public function updateReceipt(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['receipt_date'=>['required','date'], 'collector_sales_rep_id'=>['required','integer','exists:sales_representatives,id'], 'collection_type'=>['required','in:regular,partial,final,recovery'], 'payment_method'=>['required','in:cash,bank_transfer,cheque,card'], 'commission_decision'=>['required','in:invoice_salesperson,collector,cancel'], 'reference'=>['nullable','string','max:80']]);
        return DB::transaction(function () use ($data, $id) {
            $receipt=DB::table('customer_receipts')->find($id);abort_unless($receipt,404,'Collection not found.');
            $allocation=DB::table('receipt_allocations')->where('receipt_id',$id)->first();abort_unless($allocation,422,'Collection allocation is missing.');
            $invoice=DB::table('sales_invoices')->find($allocation->invoice_id);abort_unless($invoice,422,'Linked invoice is missing.');
            $payeeId=$data['commission_decision']==='collector'?(int)$data['collector_sales_rep_id']:(int)$invoice->sales_rep_id;$payee=DB::table('sales_representatives')->find($payeeId);abort_unless($payee,422,'Commission recipient is missing.');
            $days=max(0,(int)floor((strtotime($data['receipt_date'])-strtotime($invoice->invoice_date))/86400));$limit=(int)(DB::table('commission_settings')->value('max_collection_days')??100);$eligible=$days<=$limit;$cancelled=$data['commission_decision']==='cancel';$rate=(float)$payee->default_commission_rate;$commission=(!$cancelled&&$eligible)?round((float)$allocation->commission_pieces*$rate,2):0;
            DB::table('customer_receipts')->where('id',$id)->update(['collector_sales_rep_id'=>$data['collector_sales_rep_id'],'receipt_date'=>$data['receipt_date'],'collection_type'=>$data['collection_type'],'payment_method'=>$data['payment_method'],'reference'=>$data['reference']??null,'updated_at'=>now()]);
            DB::table('receipt_allocations')->where('id',$allocation->id)->update(['commission_payee_sales_rep_id'=>$cancelled?null:$payeeId,'days_taken'=>$days,'commission_rate'=>$rate,'commission_amount'=>$commission,'commission_status'=>$cancelled?'cancelled_by_management':($eligible?'eligible':'blocked_late'),'commission_decision'=>$data['commission_decision'],'updated_at'=>now()]);
            $journalId=DB::table('journal_entries')->where(['source_type'=>'customer_receipt','source_id'=>$id])->value('id');if($journalId){DB::table('journal_lines')->where('journal_entry_id',$journalId)->delete();$lines=[['1000',$receipt->amount,0,'Customer collection received'],['1100',0,$receipt->amount,'Accounts receivable settled']];if($commission>0){$lines[]=['5300',$commission,0,'Sales commission expense'];$lines[]=['2260',0,$commission,'Commission payable'];}foreach($lines as[$code,$debit,$credit,$description]){$account=DB::table('accounts')->where('code',$code)->value('id');if($account)DB::table('journal_lines')->insert(['journal_entry_id'=>$journalId,'account_id'=>$account,'debit'=>$debit,'credit'=>$credit,'description'=>$description,'created_at'=>now(),'updated_at'=>now()]);}DB::table('journal_entries')->where('id',$journalId)->update(['posting_date'=>$data['receipt_date'],'updated_at'=>now()]);}
            return response()->json(DB::table('customer_receipts')->find($id));
        });
    }

    public function deleteReceipt(int $id): JsonResponse
    {
        return DB::transaction(function () use ($id) {
            $receipt = DB::table('customer_receipts')->find($id);
            abort_unless($receipt, 404, 'Collection not found.');
            foreach (DB::table('receipt_allocations')->where('receipt_id', $id)->get() as $allocation) {
                $invoice = DB::table('sales_invoices')->lockForUpdate()->find($allocation->invoice_id);
                if ($invoice) {
                    $received = max(0, (float) $invoice->received_amount - (float) $allocation->amount);
                    $outstanding = max(0, (float) $invoice->total - $received);
                    DB::table('sales_invoices')->where('id', $invoice->id)->update(['received_amount'=>$received, 'outstanding'=>$outstanding, 'status'=>$received > 0 ? 'part_paid' : 'unpaid', 'updated_at'=>now()]);
                }
            }
            DB::table('journal_entries')->where(['source_type'=>'customer_receipt', 'source_id'=>$id])->delete();
            DB::table('customer_receipts')->where('id', $id)->delete();
            return response()->json(['message'=>'Collection, allocation, commission and journal deleted.']);
        });
    }

    public function manualSalesOrder(Request $request, SalesController $sales): JsonResponse
    {
        return DB::transaction(function () use ($request, $sales) {
            $poResponse = $sales->storePo($request);
            $po = $poResponse->getData(true);
            $orderResponse = $sales->convert((int) $po['id']);
            return response()->json($orderResponse->getData(true), 201);
        });
    }

    public function manualInvoice(Request $request, PostingService $posting): JsonResponse
    {
        $data = $request->validate([
            'customer_id'=>['required','integer','exists:customers,id'],
            'sales_rep_id'=>['required','integer','exists:sales_representatives,id'],
            'invoice_date'=>['required','date'], 'due_date'=>['nullable','date','after_or_equal:invoice_date'],
            'sale_type'=>['required','in:cash,credit,mixed'], 'discount'=>['nullable','numeric','gte:0'],
            'tax'=>['nullable','numeric','gte:0'], 'reference'=>['nullable','string','max:80'],
            'lines'=>['required','array','min:1'], 'lines.*.article_id'=>['required','integer','exists:articles,id'],
            'lines.*.size_label'=>['required','string','max:30'], 'lines.*.quantity'=>['required','numeric','gt:0'],
            'lines.*.rate'=>['required','numeric','gte:0'],
        ]);
        return DB::transaction(function () use ($data, $posting) {
            $customer = DB::table('customers')->find($data['customer_id']);
            $subtotal = round(collect($data['lines'])->sum(fn ($line) => $line['quantity'] * $line['rate']), 2);
            $discount = round((float) ($data['discount'] ?? 0), 2);
            $tax = round((float) ($data['tax'] ?? 0), 2);
            abort_if($discount > $subtotal, 422, 'Discount cannot exceed the invoice subtotal.');
            $total = round($subtotal - $discount + $tax, 2);
            abort_if($total <= 0, 422, 'Invoice total must be greater than zero.');
            $sequence = str_pad((string) (DB::table('sales_invoices')->count() + 1), 4, '0', STR_PAD_LEFT);
            $poId = DB::table('customer_pos')->insertGetId([
                'number'=>"CPO-MAN-{$sequence}", 'customer_id'=>$data['customer_id'], 'sales_rep_id'=>$data['sales_rep_id'],
                'customer_po_reference'=>$data['reference'] ?? 'Manual invoice', 'po_date'=>$data['invoice_date'],
                'sale_type'=>$data['sale_type'], 'status'=>'invoiced', 'total'=>$total, 'created_at'=>now(), 'updated_at'=>now(),
            ]);
            $orderId = DB::table('sales_orders')->insertGetId([
                'number'=>"SO-MAN-{$sequence}", 'customer_po_id'=>$poId, 'customer_id'=>$data['customer_id'],
                'sales_rep_id'=>$data['sales_rep_id'], 'order_date'=>$data['invoice_date'], 'status'=>'invoiced',
                'total'=>$total, 'created_at'=>now(), 'updated_at'=>now(),
            ]);
            $number = 'INV-'.now()->format('ym').'-'.$sequence;
            $dueDate = $data['due_date'] ?? date('Y-m-d', strtotime($data['invoice_date'].' +'.($data['sale_type'] === 'cash' ? 0 : $customer->credit_days).' days'));
            $invoiceId = DB::table('sales_invoices')->insertGetId([
                'number'=>$number, 'sales_order_id'=>$orderId, 'customer_id'=>$data['customer_id'], 'sales_rep_id'=>$data['sales_rep_id'],
                'invoice_date'=>$data['invoice_date'], 'due_date'=>$dueDate, 'sale_type'=>$data['sale_type'], 'status'=>'unpaid',
                'subtotal'=>$subtotal, 'discount'=>$discount, 'tax'=>$tax, 'total'=>$total, 'received_amount'=>0,
                'outstanding'=>$total, 'created_at'=>now(), 'updated_at'=>now(),
            ]);
            foreach ($data['lines'] as $line) {
                $orderLineId = DB::table('sales_order_size_lines')->insertGetId([
                    'sales_order_id'=>$orderId, 'article_id'=>$line['article_id'], 'size_label'=>$line['size_label'],
                    'quantity'=>$line['quantity'], 'invoiced_quantity'=>$line['quantity'], 'rate'=>$line['rate'],
                    'created_at'=>now(), 'updated_at'=>now(),
                ]);
                DB::table('sales_invoice_lines')->insert([
                    'sales_invoice_id'=>$invoiceId, 'sales_order_size_line_id'=>$orderLineId, 'article_id'=>$line['article_id'],
                    'size_label'=>$line['size_label'], 'quantity'=>$line['quantity'], 'rate'=>$line['rate'],
                    'line_total'=>round($line['quantity'] * $line['rate'], 2), 'created_at'=>now(), 'updated_at'=>now(),
                ]);
            }
            app(FinishedGoodsInventoryService::class)->issueInvoice($invoiceId, $data['invoice_date']);
            $journalLines = [
                ['account_code'=>'1100', 'debit'=>$total, 'credit'=>0, 'description'=>'Accounts receivable'],
                ['account_code'=>'4000', 'debit'=>0, 'credit'=>$subtotal - $discount, 'description'=>'Domestic sales revenue'],
            ];
            if ($tax > 0) $journalLines[] = ['account_code'=>'2300', 'debit'=>0, 'credit'=>$tax, 'description'=>'Sales tax payable'];
            $journalId = $posting->post('sales_invoice', $invoiceId, $data['invoice_date'], "Manual customer invoice {$number}", $journalLines);
            $this->audit('sales_invoice.manual_posted', 'sales_invoice', $invoiceId, ['journal_id'=>$journalId, 'total'=>$total]);
            $invoice = (array) DB::table('sales_invoices')->find($invoiceId);
            $invoice['journal_id'] = $journalId;
            return response()->json($invoice, 201);
        });
    }

    public function invoiceDispatch(Request $request, int $id, SalesController $sales, PostingService $posting): JsonResponse
    {
        return DB::transaction(function () use ($request, $id, $sales, $posting) {
            $response = $sales->invoiceDispatch($request, $id);
            $invoice = $response->getData(true);
            app(FinishedGoodsInventoryService::class)->issueInvoice((int) $invoice['id'], $invoice['invoice_date']);
            $journalId = $posting->post('sales_invoice', (int) $invoice['id'], $invoice['invoice_date'], "Customer invoice {$invoice['number']}", [
                ['account_code'=>'1100', 'debit'=>$invoice['total'], 'credit'=>0, 'description'=>'Accounts receivable'],
                ['account_code'=>'4000', 'debit'=>0, 'credit'=>$invoice['total'], 'description'=>'Domestic sales revenue'],
            ]);
            $invoice['journal_id'] = $journalId;
            $this->audit('sales_invoice.posted', 'sales_invoice', (int) $invoice['id'], ['journal_id'=>$journalId, 'total'=>$invoice['total']]);
            return response()->json($invoice, 201);
        });
    }

    public function receipt(Request $request, SalesController $sales, PostingService $posting): JsonResponse
    {
        return DB::transaction(function () use ($request, $sales, $posting) {
            $response = $sales->receipt($request);
            $result = $response->getData(true);
            $receipt = $result['receipt'];
            $amount = (float) $receipt['amount'];
            $commission = (float) ($result['commission'] ?? 0);
            $lines = [
                ['account_code'=>'1000', 'debit'=>$amount, 'credit'=>0, 'description'=>'Customer collection received'],
                ['account_code'=>'1100', 'debit'=>0, 'credit'=>$amount, 'description'=>'Accounts receivable settled'],
            ];
            if ($commission > 0) {
                $lines[] = ['account_code'=>'5300', 'debit'=>$commission, 'credit'=>0, 'description'=>'Sales commission expense'];
                $lines[] = ['account_code'=>'2260', 'debit'=>0, 'credit'=>$commission, 'description'=>'Commission payable'];
            }
            $journalId = $posting->post('customer_receipt', (int) $receipt['id'], $receipt['receipt_date'], "Customer receipt {$receipt['number']}", $lines);
            $result['journal_id'] = $journalId;
            $this->audit('customer_receipt.posted', 'customer_receipt', (int) $receipt['id'], ['journal_id'=>$journalId, 'amount'=>$amount, 'commission'=>$commission]);
            return response()->json($result, 201);
        });
    }

    public function adjustFinishedStock(Request $request): JsonResponse
    {
        $data = $request->validate([
            'article_id'=>['required','integer','exists:articles,id'], 'size_label'=>['required','string','max:30'],
            'quantity'=>['required','numeric','gt:0'], 'adjustment_type'=>['required','in:increase,decrease'], 'occurred_at'=>['required','date'],
        ]);
        DB::transaction(fn () => app(FinishedGoodsInventoryService::class)->adjust((int) $data['article_id'], $data['size_label'], (float) $data['quantity'], $data['adjustment_type'], $data['occurred_at']));
        return response()->json(['message'=>'Finished-goods stock adjusted.'], 201);
    }

    private function audit(string $event, string $type, int $id, array $payload): void
    {
        DB::table('audit_logs')->insert(['event'=>$event, 'entity_type'=>$type, 'entity_id'=>$id, 'payload'=>json_encode($payload), 'created_at'=>now()]);
    }
}
