<?php
// Isolated receipt checks using an in-memory database.
require __DIR__ . "/../vendor/autoload.php";
$app = require __DIR__ . "/../bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config([
    "database.default" => "sqlite",
    "database.connections.sqlite" => [
        "driver" => "sqlite",
        "database" => ":memory:",
        "prefix" => "",
    ],
]);
Illuminate\Support\Facades\DB::purge("sqlite");
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\SalesController;

$tables = [
    "accounts" => ["code", "type", "is_postable", "is_active", "is_cash_account"],
    "sales_invoices" => [
        "customer_id",
        "sales_rep_id",
        "invoice_date",
        "total",
        "received_amount",
        "outstanding",
        "status",
        "updated_at",
    ],
    "sales_representatives" => ["name", "default_commission_rate"],
    "sales_invoice_lines" => ["sales_invoice_id", "quantity"],
    "commission_settings" => ["max_collection_days"],
    "customer_receipts" => [
        "payment_account_id",
        "number",
        "customer_id",
        "sales_rep_id",
        "collector_sales_rep_id",
        "receipt_date",
        "collection_type",
        "payment_method",
        "reference",
        "amount",
        "status",
        "created_at",
        "updated_at",
    ],
    "receipt_allocations" => [
        "receipt_id",
        "invoice_id",
        "commission_payee_sales_rep_id",
        "amount",
        "days_taken",
        "commission_pieces",
        "commission_rate",
        "commission_amount",
        "commission_status",
        "commission_decision",
        "created_at",
        "updated_at",
    ],
];
foreach ($tables as $name => $columns) {
    Schema::create($name, function ($schema) use ($columns) {
        $schema->id();
        foreach ($columns as $column) {
            $schema->string($column)->nullable();
        }
    });
}
// All test data below is isolated in SQLite memory; no real database is migrated.
Schema::table('accounts', function ($t) { foreach (['name','parent_id','is_system','cash_flow_activity','description','created_at','updated_at'] as $column) $t->string($column)->nullable(); });
Schema::table('sales_representatives', fn($t) => $t->string('status')->default('active'));
Schema::table('sales_invoices', function ($t) { $t->string('number')->nullable(); $t->decimal('returned_amount',18,2)->default(0); $t->boolean('is_opening_balance')->default(false); });
foreach ([
    'customers' => ['name','code'],
    'accounting_periods' => ['starts_on','ends_on','status'],
    'journal_entries' => ['number','accounting_period_id','source_type','source_id','posting_date','description','status','posted_at','created_at','updated_at'],
    'journal_lines' => ['journal_entry_id','account_id','debit','credit','description','created_at','updated_at'],
    'audit_logs' => ['event','entity_type','entity_id','payload','created_at'],
] as $name => $columns) {
    Schema::create($name, function ($t) use ($columns) { $t->id(); foreach ($columns as $column) $t->string($column)->nullable(); });
}
foreach (['1000','1100','2260','5300'] as $code) DB::table('accounts')->insert([
    'code'=>$code,'name'=>$code,'type'=>$code==='2260'?'liability':($code==='5300'?'expense':'asset'),
    'is_active'=>1,'is_postable'=>1,'is_cash_account'=>$code==='1000'?1:0,
]);
DB::table('customers')->insert([['id'=>1,'name'=>'Customer One','code'=>'CUS-001'],['id'=>2,'name'=>'Customer Two','code'=>'CUS-002']]);
DB::table('sales_representatives')->insert(['id'=>1,'name'=>'Representative','status'=>'active','default_commission_rate'=>1]);
DB::table('commission_settings')->insert(['max_collection_days'=>100]);
DB::table('accounting_periods')->insert(['starts_on'=>'2026-01-01','ends_on'=>'2026-12-31','status'=>'open']);
(require __DIR__.'/../database/migrations/2026_11_06_000001_create_customer_collections.php')->up();
$controller = new App\Http\Controllers\Api\CustomerCollectionController();
$sales = new SalesController();
$posting = new App\Services\Accounting\PostingService();
function check($value, $label) { if (!$value) throw new RuntimeException($label); echo "PASS $label\n"; }
function reject($callback, $label) {
    try { $callback(); } catch (Illuminate\Validation\ValidationException | Symfony\Component\HttpKernel\Exception\HttpException $error) { echo "PASS $label\n"; return; }
    throw new RuntimeException("Accepted invalid action: $label");
}
function invoice($id, $customer=1, $opening=false) {
    DB::table('sales_invoices')->insert(['id'=>$id,'customer_id'=>$customer,'sales_rep_id'=>1,'invoice_date'=>'2026-10-01','number'=>'INV-'.$id,'total'=>1000,'received_amount'=>0,'outstanding'=>1000,'status'=>'unpaid','is_opening_balance'=>$opening]);
    DB::table('sales_invoice_lines')->insert(['sales_invoice_id'=>$id,'quantity'=>10]);
}
function body($ids, $cheque=false) {
    return ['request_key'=>(string) Illuminate\Support\Str::uuid(),'customer_id'=>1,'collector_sales_rep_id'=>1,'receipt_date'=>'2026-10-28','payment_method'=>$cheque?'cheque':'cash','payment_account_id'=>1,'amount'=>1500,
        'cheque_number'=>$cheque?'CHQ-123':null,'cheque_bank'=>$cheque?'Test Bank':null,'cheque_date'=>$cheque?'2026-11-03':null,
        'allocations'=>[['invoice_id'=>$ids[0],'amount'=>1000,'commission_decision'=>'invoice_salesperson'],['invoice_id'=>$ids[1],'amount'=>500,'commission_decision'=>'cancel']]];
}
function receive($body) { global $controller,$sales,$posting; return $controller->store(Request::create('/','POST',$body),$sales,$posting)->getData(true); }
function action($id,$type,$date='2026-11-04') { global $controller,$posting; return $controller->transition(Request::create('/','POST',['action'=>$type,'date'=>$date,'bank_account_id'=>1,'reason'=>'Bank returned cheque']),$id,$posting)->getData(true); }
function balance($code) { $account=DB::table('accounts')->where('code',$code)->value('id');return round((float) DB::table('journal_lines')->where('account_id',$account)->sum('debit')-(float) DB::table('journal_lines')->where('account_id',$account)->sum('credit'),2); }
invoice(1);invoice(2);$cash=body([1,2]);$result=receive($cash);
check($result['number']==='COL-000001','readable collection number');
check(DB::table('customer_receipts')->count()===2 && DB::table('customer_collection_lines')->count()===2,'one collection produces two linked invoice allocations');
check((float)DB::table('sales_invoices')->where('id',1)->value('outstanding')===0.0 && (float)DB::table('sales_invoices')->where('id',2)->value('outstanding')===500.0,'full and partial settlements calculated correctly');
check(balance('1000')===1500.0 && balance('5300')===10.0,'cash and only ticked commission posted');
receive($cash);check(DB::table('customer_collections')->count()===1,'retry does not duplicate payment');
$changed=$cash;$changed['amount']=1400;reject(fn()=>receive($changed),'reused key cannot silently accept a different payment');
invoice(3);invoice(4);$cheque=receive(body([3,4],true));
check(balance('1120')===1500.0 && balance('1000')===1500.0,'held cheque is an asset but does not increase cash');
check(balance('5300')===10.0,'held cheque does not accrue commission');
reject(fn()=>action($cheque['id'],'clear','2026-11-02'),'post-dated cheque cannot clear early');
DB::table('accounting_periods')->update(['status'=>'closed']);reject(fn()=>action($cheque['id'],'clear'),'closed period blocks cheque clearance');DB::table('accounting_periods')->update(['status'=>'open']);
check(DB::table('customer_collections')->where('id',$cheque['id'])->value('status')==='held','failed clearance retains held state');
action($cheque['id'],'clear');check(balance('1120')===0.0 && balance('1000')===3000.0 && balance('5300')===20.0,'clearance transfers asset to bank and releases commission');
reject(fn()=>action($cheque['id'],'clear'),'duplicate clearance rejected');
DB::table('accounting_periods')->update(['status'=>'closed']);reject(fn()=>action($cheque['id'],'return','2026-11-05'),'closed period blocks cheque return');DB::table('accounting_periods')->update(['status'=>'open']);
action($cheque['id'],'return','2026-11-05');
check(balance('1000')===1500.0 && balance('1120')===0.0 && balance('5300')===10.0,'bank return passes through cheque holding and reverses commission');
check((float)DB::table('sales_invoices')->where('id',3)->value('outstanding')===1000.0 && (float)DB::table('sales_invoices')->where('id',4)->value('outstanding')===1000.0,'returned cheque reopens exact invoice balances');
reject(fn()=>action($cheque['id'],'return','2026-11-05'),'duplicate return rejected');
$before=DB::table('receipt_allocations as a')->join('customer_receipts as r','r.id','=','a.receipt_id')->whereIn('a.invoice_id',[3,4]);
App\Services\Accounting\ReceiptScope::asOf($before,'r','2026-11-04');
check((float)$before->sum('a.amount')===1500.0,'historical aging retains receipt before its return');
$after=DB::table('receipt_allocations as a')->join('customer_receipts as r','r.id','=','a.receipt_id')->whereIn('a.invoice_id',[3,4]);
App\Services\Accounting\ReceiptScope::asOf($after,'r','2026-11-05');
check((float)$after->sum('a.amount')===0.0,'aging excludes returned cheque from its return date');
invoice(5);invoice(6);$held=receive(body([5,6],true));action($held['id'],'return','2026-11-01');
check(balance('1120')===0.0 && balance('1000')===1500.0,'uncleared return restores debt without touching bank');
invoice(7);invoice(8,2);$invalid=body([7,8]);$count=DB::table('customer_collections')->count();
reject(fn()=>receive($invalid),'cross-customer allocation rejected');
check(DB::table('customer_collections')->count()===$count && (float)DB::table('sales_invoices')->where('id',7)->value('outstanding')===1000.0,'invalid second invoice rolls back entire collection');
$invalid=body([7,2]);$invalid['amount']=1400;reject(fn()=>receive($invalid),'unallocated payment rejected');
$invalid=body([7,2]);$invalid['allocations'][1]['amount']=600;$invalid['amount']=1600;reject(fn()=>receive($invalid),'stale or overpaid invoice rejected under lock');
$invalid=body([7,2]);$invalid['allocations'][1]['invoice_id']=7;reject(fn()=>receive($invalid),'duplicate invoice rejected');
$invalid=body([7,2]);$invalid['payment_account_id']=2;reject(fn()=>receive($invalid),'non-cash posting account cannot receive cash');
DB::table('accounting_periods')->update(['status'=>'closed']);reject(fn()=>receive(body([7,2])),'closed accounting period rolls back collection');DB::table('accounting_periods')->update(['status'=>'open']);
$managed=DB::table('customer_collection_lines')->value('receipt_id');
reject(fn()=>(new App\Http\Controllers\Api\AccountingSalesController())->deleteReceipt($managed),'legacy deletion cannot break collection history');
foreach(DB::table('journal_entries')->get() as $journal) {
    $debit=(float)DB::table('journal_lines')->where('journal_entry_id',$journal->id)->sum('debit');
    $credit=(float)DB::table('journal_lines')->where('journal_entry_id',$journal->id)->sum('credit');
    check(abs($debit-$credit)<0.001,'balanced journal '.$journal->number);
}
check(!App\Services\Accounting\AccountPolicy::cash(DB::table('accounts')->where('code','1120')->first()),'cheque holding excluded from cash policy');
$ledger=(new App\Http\Controllers\Api\SubledgerController())->ledger(Request::create('/','GET',['kind'=>'customer','id'=>1,'from'=>'2026-01-01','to'=>'2026-11-06']))->getData(true);
check(abs($ledger['closing']+1500)<0.001,'customer subledger includes dated cheque return reversals');
echo "Customer collection and cheque lifecycle checks passed.\n";
// Existing single-invoice/POS callers are routed through the same cheque holding workflow.
$single = Request::create('/', 'POST', ['invoice_id'=>7,'collector_sales_rep_id'=>1,'receipt_date'=>'2026-10-28', 'payment_method'=>'cheque','amount'=>200,'commission_decision'=>'invoice_salesperson','cheque_number'=>'POS-CHQ','cheque_bank'=>'Test Bank','cheque_date'=>'2026-11-03']);
$adapted=(new App\Http\Controllers\Api\AccountingSalesController())->receipt($single,$sales,$posting)->getData(true);
check($adapted['collection']['status']==='held' && (float)$adapted['receipt']['amount']===200.0,'single-invoice cheque caller uses collection holding account');
check(balance('1000')===1500.0 && balance('1120')===200.0,'single-invoice cheque cannot accidentally post to cash');
