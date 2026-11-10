<?php
require __DIR__.'/../vendor/autoload.php';
$app=require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default'=>'sqlite','database.connections.sqlite'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'']]);
Illuminate\Support\Facades\DB::purge('sqlite');
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\InventoryCountController;
foreach ([
 'articles'=>['code','name','category','status'], 'article_set_templates'=>['article_id'], 'article_set_items'=>['set_template_id','size_label'],
 'finished_goods_stock'=>['article_id','size_label','quantity','created_at','updated_at'],
 'finished_goods_movements'=>['article_id','size_label','movement_type','quantity','source_type','source_id','event_key','occurred_at','created_at','updated_at'],
 'stock_import_batches'=>['import_key','payload_hash','rows','created_at'], 'audit_logs'=>['event','entity_type','entity_id','payload','created_at'],
 'materials'=>['code','name'],'stock_balances'=>['material_id','batch_number','quantity','unit_cost','updated_at']
] as $name=>$columns) Schema::create($name,function($t)use($columns){$t->id();foreach($columns as $column)$t->string($column)->nullable();});
DB::table('articles')->insert(['id'=>1,'code'=>'001-A','name'=>'Test shoe','category'=>'SHOE','status'=>'active']);
DB::table('article_set_templates')->insert(['id'=>1,'article_id'=>1]);
foreach(['40','41'] as $size) DB::table('article_set_items')->insert(['set_template_id'=>1,'size_label'=>$size]);
$controller=new InventoryCountController();$checks=0;
function check($ok,$message){global $checks;if(!$ok)throw new Exception($message);$checks++;}
function applyCount($rows,$key=null){global $controller;return $controller->apply(new Request(['rows'=>$rows,'import_key'=>$key??(string)Illuminate\Support\Str::uuid(),'reason'=>'Verified stock count']));}
function rejected($rows){try{applyCount($rows);return false;}catch(Illuminate\Validation\ValidationException $e){return true;}}
$row=['code'=>'001-A','size'=>'40','expected'=>0,'quantity'=>12];$key=(string)Illuminate\Support\Str::uuid();
applyCount([$row],$key);check(DB::table('finished_goods_stock')->value('quantity')==12,'Assign absent stock');
applyCount([$row],$key);check(DB::table('finished_goods_movements')->count()==1,'Retry must not duplicate movements');
check(rejected([$row]),'Stale baseline rejected');
check(rejected([array_merge($row,['expected'=>12]),array_merge($row,['expected'=>12])]),'Duplicate sizes rejected');
check(rejected([array_merge($row,['size'=>'99'])]),'Invalid size rejected');
check(rejected([array_merge($row,['expected'=>12,'quantity'=>1.5])]),'Fractional pieces rejected');
check(rejected([array_merge($row,['quantity'=>-1])]),'Negative quantity rejected');
check(rejected([array_merge($row,['expected'=>12,'quantity'=>6]),array_merge($row,['size'=>'99'])]),'Invalid batch rejected');
check(DB::table('finished_goods_stock')->value('quantity')==12,'No partial update');
applyCount([array_merge($row,['expected'=>12,'quantity'=>0])]);check(DB::table('finished_goods_stock')->value('quantity')==0,'Zero count supported');
check(DB::table('finished_goods_movements')->sum('quantity')==0,'Movement ledger reconciles');
applyCount([array_merge($row,['quantity'=>0])]);check(DB::table('finished_goods_movements')->count()==2,'Unchanged count has no movement');
DB::table('materials')->insert(['id'=>1,'code'=>'RAW-1','name'=>'Test material']);
DB::table('stock_balances')->insert(['material_id'=>1,'batch_number'=>'B1','quantity'=>5,'unit_cost'=>10]);
check(rejected([['kind'=>'raw','code'=>'RAW-1','size'=>'B1','expected'=>5,'quantity'=>6,'unit_cost'=>12]]),'Existing batch cost protected');
foreach ([
 'stock_adjustments'=>['number','material_id','batch_number','adjustment_date','adjustment_type','quantity','unit_cost','reason','total','status','created_at','updated_at'],
 'stock_movements'=>['material_id','batch_number','movement_type','quantity','unit_cost','source_type','source_id','event_key','occurred_at','created_at'],
 'accounting_periods'=>['starts_on','ends_on','status'],
 'accounts'=>['code','is_postable','is_active'],
 'journal_entries'=>['number','accounting_period_id','source_type','source_id','posting_date','description','status','posted_at','created_at','updated_at'],
 'journal_lines'=>['journal_entry_id','account_id','debit','credit','description','created_at','updated_at']
] as $name=>$columns) Schema::create($name,function($t)use($columns){$t->id();foreach($columns as $column)$t->string($column)->nullable();});
DB::table('accounting_periods')->insert(['starts_on'=>date('Y').'-01-01','ends_on'=>date('Y').'-12-31','status'=>'open']);
foreach(['1300','5000'] as $code) DB::table('accounts')->insert(['code'=>$code,'is_postable'=>1,'is_active'=>1]);
applyCount([['kind'=>'raw','code'=>'RAW-1','size'=>'B1','expected'=>5,'quantity'=>8,'unit_cost'=>10]]);
check(DB::table('stock_balances')->value('quantity')==8,'Raw count replaces balance');
check(DB::table('stock_movements')->sum('quantity')==3,'Raw movement uses difference');
check(DB::table('journal_lines')->sum('debit')==30 && DB::table('journal_lines')->sum('credit')==30,'Raw journal balances at adjustment value');
DB::table('accounting_periods')->update(['status'=>'closed']);
check(rejected([['kind'=>'raw','code'=>'RAW-1','size'=>'B1','expected'=>8,'quantity'=>10,'unit_cost'=>10]]),'Closed period rejects raw adjustment');
check(DB::table('stock_balances')->value('quantity')==8,'Failed journal rolls back raw balance');
$response=$controller->template(new Request());ob_start();$response->sendContent();$bytes=ob_get_clean();
check(substr($bytes,0,2)==='PK','Real XLSX template');
$file=tempnam(sys_get_temp_dir(),'count');file_put_contents($file,$bytes);
$book=PhpOffice\PhpSpreadsheet\IOFactory::load($file);check($book->getSheet(0)->getCell('A2')->getValue()==='001-A','Article codes preserved');
check($book->getSheet(0)->getHighestDataRow()===2,'One row per article');
check($book->getSheet(0)->rangeToArray('A1:C1')[0]===['Article code','Category','Stock'],'Exactly three requested columns');
check($book->getSheet(0)->getHighestDataColumn()==='C','No size columns');
$request=new Request();$request->files->set('file',new Illuminate\Http\UploadedFile($file,'counts.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',null,true));
check($controller->preview($request)->getData(true)['rows']===[],'Unchanged file returns helpful no changes result');
$book->getSheet(0)->setCellValue('C2',70);(new PhpOffice\PhpSpreadsheet\Writer\Xlsx($book))->save($file);
$result=$controller->preview($request)->getData(true);
check(count($result['rows'])===1 && $result['rows'][0]['quantity']==70 && $result['rows'][0]['kind']==='article','Preview contains one article total');
check(DB::table('finished_goods_stock')->sum('quantity')==0,'Preview does not change stock');
applyCount($result['rows']);
check(DB::table('finished_goods_stock')->sum('quantity')==70,'Total imported exactly once');
$service=new App\Services\Inventory\FinishedGoodsInventoryService();
$service->receiveReturn(1,'40',3,1,1,date('Y-m-d'));
check(DB::table('finished_goods_stock')->where('size_label','__ARTICLE_TOTAL__')->value('quantity')==73,'Return updates shared article total');
$move=new ReflectionMethod($service,'move');$move->setAccessible(true);
$move->invoke($service,1,'41',-10,'sale','sales_invoice',1,'test-sale',date('Y-m-d'),true);
check(DB::table('finished_goods_stock')->sum('quantity')==63,'Sale deducts article total regardless of size');
try { $move->invoke($service,1,'40',-100,'sale','sales_invoice',2,'test-shortage',date('Y-m-d'),true); check(false,'Overselling rejected'); }
catch (Illuminate\Validation\ValidationException $e) { check(true,'Overselling rejected'); }
applyCount([['kind'=>'article','code'=>'001-A','size'=>'__ARTICLE_TOTAL__','expected'=>63,'quantity'=>0]]);
check(DB::table('finished_goods_stock')->sum('quantity')==0,'Zero clears article total');
check(rejected([['kind'=>'article','code'=>'001-A','size'=>'__ARTICLE_TOTAL__','expected'=>63,'quantity'=>4]]),'Stale article count rejected');
DB::table('finished_goods_stock')->where('size_label','40')->update(['quantity'=>12]);
applyCount([['kind'=>'article','code'=>'001-A','size'=>'__ARTICLE_TOTAL__','expected'=>12,'quantity'=>5]]);
check(DB::table('finished_goods_stock')->sum('quantity')==5 && DB::table('finished_goods_stock')->where('size_label','40')->value('quantity')==0,'Prior size stock consolidated without double counting');
$book->getSheet(0)->setCellValue('C2','=1+2');(new PhpOffice\PhpSpreadsheet\Writer\Xlsx($book))->save($file);
try { $controller->preview($request); check(false,'Formula rejected'); }
catch (Illuminate\Validation\ValidationException $e) { check(str_contains(json_encode($e->errors()),'numbers only'),'Readable formula error'); }
unlink($file);echo "Passed $checks inventory count checks. No real database changed.\n";
