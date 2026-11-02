<?php
namespace App\Http\Controllers\Api;
use App\Services\Sales\SalesReturnService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
final class SalesReturnController
{
    public function index(Request $request) {
        $invoices=DB::table('sales_invoices as i')->join('customers as c','c.id','=','i.customer_id')
            ->where('i.is_opening_balance',false)->whereNotIn('i.status',['void','cancelled'])
            ->select('i.*','c.name as customer_name')->orderByDesc('i.invoice_date')->get();
        $lines=DB::table('sales_invoice_lines as l')->join('articles as a','a.id','=','l.article_id')
            ->whereIn('l.sales_invoice_id',$invoices->pluck('id'))->select('l.*','a.code as article_code','a.name as article_name','a.track_serials')->get();
        $returned=DB::table('sales_return_lines')->select('sales_invoice_line_id',DB::raw('SUM(quantity) quantity'))->groupBy('sales_invoice_line_id')->pluck('quantity','sales_invoice_line_id');
        $serials=Schema::hasTable('product_serials')?DB::table('product_serials')->whereIn('sales_invoice_id',$invoices->pluck('id'))->where('status','sold')->get():collect();
        foreach($lines as $line){$line->returned_quantity=(int)($returned[$line->id]??0);$line->remaining_quantity=max(0,(float)$line->quantity-$line->returned_quantity);$line->serials=$serials->filter(fn($s)=>(int)$s->sales_invoice_id===(int)$line->sales_invoice_id && (int)$s->article_id===(int)$line->article_id && $s->size_label===$line->size_label)->values();}
        foreach($invoices as $invoice){$invoice->lines=$lines->where('sales_invoice_id',$invoice->id)->values(); if($invoice->lines->count()){ $shares=app(SalesReturnService::class)->shares((int)round($invoice->total*100),$invoice->lines); foreach($invoice->lines as $line) $line->credit_share_cents=$shares[$line->id]; }$invoice->customer_credit=max(0,round((float)$invoice->received_amount+(float)$invoice->returned_amount-(float)$invoice->total,2));}
        $returns=DB::table('sales_returns as r')->join('sales_invoices as i','i.id','=','r.sales_invoice_id')->join('customers as c','c.id','=','r.customer_id')->select('r.*','i.number as invoice_number','c.name as customer_name')->orderByDesc('r.id')->get();
        $returnLines=DB::table('sales_return_lines')->whereIn('sales_return_id',$returns->pluck('id'))->get();
        foreach($returns as $return){$return->lines=$returnLines->where('sales_return_id',$return->id)->values();foreach($return->lines as $line){$ids=json_decode($line->serial_ids??'[]',true);$line->serial_numbers=$ids?DB::table('product_serials')->whereIn('id',$ids)->pluck('serial_number'):[];}}
        return response()->json(['invoices'=>$invoices,'returns'=>$returns]);
    }
    public function store(Request $request, SalesReturnService $service) {
        $data=$request->validate(['sales_invoice_id'=>'required|integer|exists:sales_invoices,id','return_date'=>'required|date_format:Y-m-d','reason'=>'required|string|max:2000','request_key'=>'required|string|max:80','lines'=>'required|array|min:1','lines.*.sales_invoice_line_id'=>'required|integer','lines.*.quantity'=>'required|integer|min:1','lines.*.condition'=>'required|in:sellable,damaged','lines.*.serial_ids'=>'nullable|array','lines.*.serial_ids.*'=>'integer|distinct']);
        $id=$service->post($data,$request->attributes->get('auth_user')?->id);
        return response()->json(DB::table('sales_returns')->find($id),201);
    }
}
