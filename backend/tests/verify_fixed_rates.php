<?php
require __DIR__.'/verify_manual_sales_order.php';
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\SalesController;
$base['lines'][0]['rate']=90;
$response=(new SalesController)->storePo(Request::create('/','POST',$base));
$po=$response->getData(true);
$line=DB::table('customer_po_lines')->where('customer_po_id',$po['id'])->first();
check((float)$line->line_total===810.0 && (float)$line->rate===90.0,'Given PO rate determines its total');
check(round((float)$line->fixed_rate,2)===116.67,'Weighted fixed rate is retained separately for a full set');
DB::table('article_set_items')->update(['unit_price'=>999]);
$order=(new SalesController)->convertFullPo(Request::create('/','POST'),$po['id'],'2026-10-29')->getData(true)['sales_order'];
$lines=DB::table('sales_order_size_lines')->where('sales_order_id',$order['id'])->orderBy('size_label')->get();
check((float)$order['total']===810.0 && $lines->every(fn($l)=>(float)$l->rate===90.0),'PO given rates carry into sales orders after catalog changes');
check((float)$lines[0]->fixed_rate===100.0 && (float)$lines[1]->fixed_rate===150.0,'Each size keeps its original fixed catalog rate');
$base['lines'][0]['rate']=0;
$zero=(new SalesController)->storePo(Request::create('/','POST',$base))->getData(true);
check((float)$zero['total']===0.0,'Zero given price is explicit rather than replaced by fixed price');
$base['lines'][0]['rate']=-1;
try{(new SalesController)->storePo(Request::create('/','POST',$base));check(false,'Negative price must fail');}catch(Illuminate\Validation\ValidationException $e){check(true,'Negative given price is rejected');}
