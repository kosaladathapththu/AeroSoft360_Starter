<?php
// SQLite memory only. Never modifies real users, passwords or sessions.
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
Illuminate\Support\Facades\DB::purge('sqlite');
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\Request;
use App\Http\Controllers\Api\AccessController;
foreach (['users'=>['password','updated_at'], 'access_tokens'=>['user_id','token_hash'], 'audit_logs'=>['event','entity_type','entity_id','payload','created_at']] as $name=>$fields) {
    Schema::create($name, function ($t) use ($fields) { $t->increments('id'); foreach ($fields as $f) $t->text($f)->nullable(); });
}
DB::table('users')->insert([['id'=>1,'password'=>Hash::make('OldPassword1')],['id'=>2,'password'=>Hash::make('OldPassword2')]]);
DB::table('access_tokens')->insert([['user_id'=>1,'token_hash'=>hash('sha256','current')],['user_id'=>2,'token_hash'=>hash('sha256','other')]]);
$controller = new AccessController();
function requestForReset($id, $body) { $r=Request::create('/','POST',$body); $r->attributes->set('auth_user',(object)['id'=>$id]); $r->headers->set('Authorization','Bearer current'); return $r; }
function checkReset($ok,$message) { if (!$ok) throw new RuntimeException($message); echo "PASS: $message\n"; }
$body=['password'=>'NewPassword123','password_confirmation'=>'NewPassword123','reason'=>'Requested by account owner'];
$result=$controller->resetPassword(requestForReset(1,$body),2)->getData(true);
checkReset(Hash::check($body['password'],DB::table('users')->where('id',2)->value('password')),'New password stored as a valid hash');
checkReset(DB::table('access_tokens')->where('user_id',2)->count()===0,'Target user sessions revoked');
checkReset(DB::table('access_tokens')->where('user_id',1)->count()===1,'Administrator session preserved');
checkReset(!str_contains(json_encode($result),'NewPassword123') && !str_contains(DB::table('audit_logs')->value('payload'),'NewPassword123'),'Password excluded from response and audit');
$controller->resetPassword(requestForReset(1,$body),1);
checkReset(DB::table('access_tokens')->where('user_id',1)->count()===1,'Own current session survives a password reset');
try { $controller->resetPassword(requestForReset(1,array_merge($body,['password_confirmation'=>'Different123'])),2); throw new RuntimeException('Mismatch accepted'); }
catch (Illuminate\Validation\ValidationException $e) { checkReset(true,'Mismatched confirmation rejected'); }
try { $controller->resetPassword(requestForReset(1,array_merge($body,['reason'=>'   '])),2); throw new RuntimeException('Blank reason accepted'); }
catch (Illuminate\Validation\ValidationException | Symfony\Component\HttpKernel\Exception\HttpException $e) { checkReset(true,'Blank reason rejected'); }
