<?php
// Isolated export regression checks; never uses the business database.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default'=>'sqlite','database.connections.sqlite'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'']]);
Illuminate\Support\Facades\DB::purge('sqlite');

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Services\Reporting\CustomerPoExporter;
use App\Http\Controllers\Api\CustomerPoExportController;
use PhpOffice\PhpSpreadsheet\Cell\DataType;

$tables=[
 'customers'=>['code','name','phone','address'], 'sales_representatives'=>['name'],
 'articles'=>['code','name'], 'article_set_templates'=>['name'], 'article_set_items'=>['size_label'],
 'customer_pos'=>['customer_id','sales_rep_id','number','customer_po_reference','po_date','sale_type','status','cash_amount','total'],
 'customer_po_lines'=>['customer_po_id','article_id','set_template_id','set_item_id','order_mode','colour','sets','pieces','rate','line_total'],
];
foreach($tables as $table=>$columns)Schema::create($table,function($schema)use($columns){$schema->id();foreach($columns as $column)$schema->string($column)->nullable();});
DB::table('customers')->insert(['id'=>1,'code'=>'0001','name'=>'=HYPERLINK("unsafe")','phone'=>'0771234567','address'=>'Colombo']);
DB::table('sales_representatives')->insert(['id'=>1,'name'=>'Rep']);
DB::table('articles')->insert(['id'=>1,'code'=>'0092','name'=>'Sandal']);
DB::table('article_set_templates')->insert(['id'=>1,'name'=>'Standard']);
DB::table('article_set_items')->insert(['id'=>1,'size_label'=>'40']);
DB::table('customer_pos')->insert([
 ['id'=>1,'customer_id'=>1,'sales_rep_id'=>1,'number'=>'CPO-1','customer_po_reference'=>'0010','po_date'=>'2026-10-27','sale_type'=>'credit','status'=>'draft','cash_amount'=>0,'total'=>300],
 ['id'=>2,'customer_id'=>1,'sales_rep_id'=>1,'number'=>'CPO-2','customer_po_reference'=>null,'po_date'=>'2026-10-26','sale_type'=>'cash','status'=>'invoiced','cash_amount'=>400,'total'=>400],
]);
foreach([[1,1,2,200],[2,1,1,100],[3,2,4,400]] as [$id,$po,$pieces,$total])DB::table('customer_po_lines')->insert(['id'=>$id,'customer_po_id'=>$po,'article_id'=>1,'set_template_id'=>1,'set_item_id'=>1,'order_mode'=>'size','colour'=>'BROWN','sets'=>0,'pieces'=>$pieces,'rate'=>100,'line_total'=>$total]);
function check($value,$message){if(!$value)throw new RuntimeException($message);echo "PASS $message\n";}
$exporter=new CustomerPoExporter();
$book=$exporter->make(); $summary=$book->getSheetByName('PO Summary');$items=$book->getSheetByName('PO Items');
check($book->getSheetCount()===2,'summary and item worksheets');
check($summary->getCell('A6')->getValue()==='CPO-1'&&$summary->getCell('A7')->getValue()==='CPO-2','all statuses and orders included');
check((float)$summary->getCell('M8')->getValue()===700.0&&(float)$summary->getCell('L8')->getValue()===7.0,'summary totals do not double-count multi-line POs');
check($items->getCell('A8')->getValue()==='CPO-2'&&(float)$items->getCell('L9')->getValue()===700.0,'all item rows and line totals');
check($summary->getCell('F6')->getValue()==='0771234567'&&$items->getCell('B6')->getValue()==='0092','leading zeroes preserved');
check($summary->getCell('E6')->getDataType()===DataType::TYPE_STRING,'customer text cannot become spreadsheet formulas');
$single=$exporter->make(2);
check($single->getActiveSheet()->getCell('A6')->getValue()==='CPO-2'&&(float)$single->getActiveSheet()->getCell('M7')->getValue()===400.0,'individual PO filtered with correct total');
$response=(new CustomerPoExportController)->download($exporter,1);
check(str_contains($response->headers->get('Content-Disposition'),'CPO-1.xlsx'),'individual download filename');
ob_start();$response->sendContent();$content=ob_get_clean();
check(substr($content,0,2)==='PK','download is a real XLSX archive');
$path=tempnam(sys_get_temp_dir(),'po-export-');
try {
 file_put_contents($path,$content);
 $loaded=\PhpOffice\PhpSpreadsheet\IOFactory::load($path);
 check($loaded->getSheetByName('PO Summary')->getCell('A6')->getValue()==='CPO-1','export can be reopened by spreadsheet reader');
 $loaded->disconnectWorksheets();
} finally {unlink($path);}
try{$exporter->make(999);throw new RuntimeException('Missing PO accepted');}
catch(\Symfony\Component\HttpKernel\Exception\HttpException $e){check($e->getStatusCode()===404,'missing PO returns 404');}
DB::table('customer_po_lines')->delete();DB::table('customer_pos')->delete();
$empty=$exporter->make();
check((float)$empty->getActiveSheet()->getCell('M6')->getValue()===0.0,'empty full report supported');
