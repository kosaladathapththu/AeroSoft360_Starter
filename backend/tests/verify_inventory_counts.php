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
 'articles'=>['code','name'], 'article_set_templates'=>['article_id'], 'article_set_items'=>['set_template_id','size_label'],
 'finished_goods_stock'=>['article_id','size_label','quantity','created_at','updated_at'],
 'finished_goods_movements'=>['article_id','size_label','movement_type','quantity','source_type','source_id','event_key','occurred_at','created_at','updated_at'],
 'stock_import_batches'=>['import_key','payload_hash','rows','created_at'], 'audit_logs'=>['event','entity_type','entity_id','payload','created_at'],
 'materials'=>['code','name'],'stock_balances'=>['material_id','batch_number','quantity','unit_cost']
] as $name=>$columns) Schema::create($name,function($t)use($columns){$t->id();foreach($columns as $column)$t->string($column)->nullable();});
DB::table('articles')->insert(['id'=>1,'code'=>'001-A','name'=>'Test shoe']);
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
$response=$controller->template(new Request());ob_start();$response->sendContent();$bytes=ob_get_clean();
check(substr($bytes,0,2)==='PK','Real XLSX template');
$file=tempnam(sys_get_temp_dir(),'count');file_put_contents($file,$bytes);
$book=PhpOffice\PhpSpreadsheet\IOFactory::load($file);check($book->getSheet(0)->getCell('A2')->getValue()==='001-A','Article codes preserved');
$book->getSheet(0)->setCellValue('E2',7);(new PhpOffice\PhpSpreadsheet\Writer\Xlsx($book))->save($file);
$request=new Request();$request->files->set('file',new Illuminate\Http\UploadedFile($file,'counts.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',null,true));
$result=$controller->preview($request)->getData(true);check(count($result['rows'])===1 && $result['rows'][0]['quantity']==7,'Preview ignores blank new quantities');
check(DB::table('finished_goods_stock')->value('quantity')==0,'Preview never mutates stock');
unlink($file);echo "Passed $checks inventory count checks. No real database changed.\n";
