<?php
// Isolated receipt checks using an in-memory database.
require __DIR__.'/../vendor/autoload.php';
$app=require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default'=>'sqlite','database.connections.sqlite'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'']]);
Illuminate\Support\Facades\DB::purge('sqlite');
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\SalesController;

$tables=[
 'accounts'=>['code','type','is_postable','is_active','is_cash_account'],
 'sales_invoices'=>['customer_id','sales_rep_id','invoice_date','total','received_amount','outstanding','status','updated_at'],
 'sales_representatives'=>['name','default_commission_rate'],
 'sales_invoice_lines'=>['sales_invoice_id','quantity'],
 'commission_settings'=>['max_collection_days'],
 'customer_receipts'=>['payment_account_id','number','customer_id','sales_rep_id','collector_sales_rep_id','receipt_date','collection_type','payment_method','reference','amount','status','created_at','updated_at'],
 'receipt_allocations'=>['receipt_id','invoice_id','commission_payee_sales_rep_id','amount','days_taken','commission_pieces','commission_rate','commission_amount','commission_status','commission_decision','created_at','updated_at'],
];
foreach($tables as $name=>$columns)Schema::create($name,function($schema)use($columns){$schema->id();foreach($columns as $column)$schema->string($column)->nullable();});
DB::table('accounts')->insert([['code'=>'1000','type'=>'asset','is_postable'=>1,'is_active'=>1,'is_cash_account'=>1],['code'=>'BANK-B','type'=>'asset','is_postable'=>1,'is_active'=>1,'is_cash_account'=>1]]);
DB::table('sales_representatives')->insert(['id'=>1,'name'=>'Rep','default_commission_rate'=>1]);
DB::table('sales_invoices')->insert(['id'=>1,'customer_id'=>1,'sales_rep_id'=>1,'invoice_date'=>'2026-10-20','total'=>1000,'received_amount'=>0,'outstanding'=>1000,'status'=>'unpaid']);
DB::table('sales_invoice_lines')->insert(['sales_invoice_id'=>1,'quantity'=>10]);
DB::table('commission_settings')->insert(['max_collection_days'=>100]);
$base=['invoice_id'=>1,'collector_sales_rep_id'=>1,'receipt_date'=>'2026-10-27','collection_type'=>'partial','payment_method'=>'cash','commission_decision'=>'invoice_salesperson'];
function check($value,$name){if(!$value)throw new RuntimeException($name);echo "PASS $name\n";}
$controller=new SalesController;
foreach([['amount'=>1100],['amount'=>500,'collection_type'=>'final']] as $override){
 try{$controller->receipt(Request::create('/','POST',array_replace($base,$override)));throw new RuntimeException('Invalid payment accepted');}
 catch(Symfony\Component\HttpKernel\Exception\HttpException $e){check($e->getStatusCode()===422,'invalid amount / final settlement rejected');}
 check(DB::table('customer_receipts')->count()===0,'invalid payment creates no receipt');
}
// Call after the invoice lock boundary to cover a balance changed by another payment.
$method=new ReflectionMethod(SalesController::class,'postReceipt');$method->setAccessible(true);
DB::table('sales_invoices')->where('id',1)->update(['outstanding'=>100]);
try{$method->invoke($controller,$base+['amount'=>200,'customer_id'=>1]);throw new RuntimeException('Stale payment accepted');}
catch(Symfony\Component\HttpKernel\Exception\HttpException $e){check($e->getStatusCode()===422,'locked balance rechecked before posting');}
DB::table('sales_invoices')->where('id',1)->update(['outstanding'=>1000]);
$controller->receipt(Request::create('/','POST',$base+['amount'=>250,'payment_account_id'=>2]));
check((int)DB::table('customer_receipts')->value('payment_account_id')===2,'selected bank account retained');
check((float)DB::table('sales_invoices')->value('outstanding')===750.0,'partial payment updates remaining balance');
check(DB::table('customer_receipts')->count()===1&&DB::table('receipt_allocations')->count()===1,'receipt and allocation saved together');
$controller->receipt(Request::create('/','POST',array_replace($base,['amount'=>750,'collection_type'=>'final'])));
check((float)DB::table('sales_invoices')->value('outstanding')===0.0&&DB::table('sales_invoices')->value('status')==='paid','full settlement marks invoice paid');
