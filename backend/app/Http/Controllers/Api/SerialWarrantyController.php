<?php

namespace App\Http\Controllers\Api;

use App\Services\Inventory\SerialWarrantyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class SerialWarrantyController
{
    public function index()
    {
        return response()->json([
            'serials'=>DB::table('product_serials as p')->join('articles as a','a.id','=','p.article_id')->leftJoin('sales_invoices as i','i.id','=','p.sales_invoice_id')->leftJoin('customers as c','c.id','=','i.customer_id')->select('p.*','a.code','a.name','i.number as invoice','c.name as customer')->orderByDesc('p.id')->get(),
            'claims'=>DB::table('warranty_claims as w')->join('product_serials as p','p.id','=','w.product_serial_id')->join('sales_invoices as i','i.id','=','p.sales_invoice_id')->join('customers as c','c.id','=','i.customer_id')->select('w.*','p.serial_number','i.number as invoice','c.name as customer')->orderByDesc('w.id')->get(),
            'articles'=>DB::table('articles')->where('status','active')->get(),
            'sizes'=>DB::table('article_set_items as i')->join('article_set_templates as t','t.id','=','i.set_template_id')->select('t.article_id','i.size_label')->distinct()->get(),
            'invoices'=>DB::table('sales_invoices as i')->join('customers as c','c.id','=','i.customer_id')->select('i.id','i.number','i.invoice_date','c.name as customer')->orderByDesc('i.id')->get(),
        ]);
    }
    public function register(Request $r,SerialWarrantyService $service)
    {
        $d=$r->validate(['article_id'=>'required|exists:articles,id','size_label'=>'required|string|max:30','received_on'=>'required|date','warranty_months'=>'required|integer|between:0,120','serial_numbers'=>'required|array|min:1|max:500','serial_numbers.*'=>'required|string|max:100','sales_invoice_id'=>'nullable|exists:sales_invoices,id']);
        return response()->json(['ids'=>$service->register($d,$r->attributes->get('auth_user')?->id)],201);
    }
    public function attach(Request $r,SerialWarrantyService $service)
    {
        $d=$r->validate(['serial_ids'=>'required|array|min:1|max:500','serial_ids.*'=>'required|integer|distinct|exists:product_serials,id','sales_invoice_id'=>'required|exists:sales_invoices,id']);$service->attach($d['serial_ids'],$d['sales_invoice_id'],$r->attributes->get('auth_user')?->id);return response()->json(['ok'=>true]);
    }
    public function claim(Request $r,SerialWarrantyService $service)
    {
        $d=$r->validate(['product_serial_id'=>'required|exists:product_serials,id','claim_date'=>'required|date|before_or_equal:today','issue'=>'required|string|max:1000']);return response()->json(['id'=>$service->claim($d,$r->attributes->get('auth_user')?->id)],201);
    }
    public function resolve(Request $r,int $id,SerialWarrantyService $service)
    {
        $d=$r->validate(['status'=>'required|in:in_progress,resolved,rejected','resolution'=>'required|string|max:1000','resolved_on'=>'required|date|before_or_equal:today']);$service->resolve($id,$d,$r->attributes->get('auth_user')?->id);return response()->json(['ok'=>true]);
    }
}
