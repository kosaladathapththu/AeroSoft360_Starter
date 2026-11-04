<?php
// Backup and restore verification against SQLite memory fixtures only.
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default'=>'sqlite','database.connections.sqlite'=>['driver'=>'sqlite','database'=>':memory:','prefix'=>'']]);
Illuminate\Support\Facades\DB::purge('sqlite');
use Illuminate\Support\Facades\DB;
use App\Services\DatabaseBackupService;
use App\Http\Middleware\RequirePermission;
use Illuminate\Http\Request;
function checkBackup($ok,$message) { if (!$ok) throw new RuntimeException($message); echo "PASS: $message\n"; }
DB::statement('CREATE TABLE fixture (id INTEGER PRIMARY KEY, description TEXT, amount DECIMAL(18,2))');
DB::insert('INSERT INTO fixture VALUES (?, ?, ?)', [1, "Customer's record \n with special characters", 123.45]);
DB::statement('CREATE INDEX fixture_amount ON fixture(amount)');
$service = new DatabaseBackupService();
$backup = $service->create();
try {
    $restored = new PDO('sqlite:' . $backup['path']);
    checkBackup($restored->query('SELECT COUNT(*) FROM fixture')->fetchColumn()==1, 'Snapshot restores all fixture rows');
    checkBackup($restored->query('SELECT description FROM fixture')->fetchColumn()=== "Customer's record \n with special characters", 'Quotes and multiline data survive restore');
    checkBackup((float)$restored->query('SELECT amount FROM fixture')->fetchColumn()===123.45, 'Financial amounts survive restore');
    checkBackup((int)$restored->query("SELECT COUNT(*) FROM sqlite_master WHERE name='fixture_amount'")->fetchColumn()===1, 'Schema indexes survive restore');
    checkBackup(str_ends_with($backup['filename'],'.sqlite') && !str_contains($backup['filename'],'/'), 'Download filename has safe database extension');
    $restored = null;
} finally { ($backup['cleanup'])(); }
checkBackup(!is_file($backup['path']) && !is_dir(dirname($backup['path'])), 'Temporary backup and private directory are deleted');
$request = Request::create('/','POST');
try { (new RequirePermission())->handle($request,fn()=>true,'admin.manage'); throw new RuntimeException('Unauthorized access accepted'); }
catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { checkBackup($e->getStatusCode()===403,'Non-admin is rejected by server permission check'); }
$request->attributes->set('permissions',['admin.manage']);
checkBackup((new RequirePermission())->handle($request,fn()=>true,'admin.manage')===true,'Administrator permission is accepted');
