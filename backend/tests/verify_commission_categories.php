<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''], 'cache.default' => 'array']);
Illuminate\Support\Facades\DB::purge('sqlite');
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\Request;
use App\Services\Accounting\CommissionPolicy;
use App\Http\Controllers\Api\CommissionCategoryController;
Schema::create('sales_representatives', function ($t) { $t->id(); $t->string('channel'); $t->decimal('default_commission_rate'); });
Schema::create('commission_settings', function ($t) { $t->id(); $t->integer('max_collection_days'); });
Schema::create('manual_commissions', function ($t) { $t->id(); $t->integer('sales_rep_id'); });
Schema::create('receipt_allocations', function ($t) { $t->id(); $t->integer('commission_payee_sales_rep_id'); });
DB::table('sales_representatives')->insert([['id'=>1,'channel'=>'direct','default_commission_rate'=>5],['id'=>2,'channel'=>'head_office','default_commission_rate'=>99]]);
DB::table('commission_settings')->insert(['max_collection_days'=>90]);
DB::table('manual_commissions')->insert(['sales_rep_id'=>2]);
$migration = require __DIR__.'/../database/migrations/2026_11_10_100000_add_commission_categories.php';
$migration->up();
$checks = 0;
function verifyCategory($ok, $message) { global $checks; if (!$ok) throw new Exception($message); $checks++; }
verifyCategory(DB::table('manual_commissions')->value('commission_category') === 'head_office', 'Existing Head Office entries classified');
DB::table('head_office_commission_settings')->update(['password_hash'=>Hash::make('test-only-password'), 'rate_per_piece'=>12, 'max_collection_days'=>60]);
verifyCategory(CommissionPolicy::rate(DB::table('sales_representatives')->find(1)) === 5.0, 'Direct rate retained');
verifyCategory(CommissionPolicy::rate(DB::table('sales_representatives')->find(2)) === 12.0, 'Independent Head Office rate');
verifyCategory(CommissionPolicy::days(2) === 60 && CommissionPolicy::days(1) === 90, 'Independent eligibility days');
$request = Request::create('/', 'POST', ['password'=>'test-only-password']);
$request->headers->set('Authorization', 'Bearer test-session-a');
$other = Request::create('/'); $other->headers->set('Authorization', 'Bearer test-session-b');
verifyCategory(!CommissionPolicy::unlocked($request), 'Locked initially');
$controller = new CommissionCategoryController();
$controller->unlock($request);
verifyCategory(CommissionPolicy::unlocked($request), 'Correct password unlocks');
verifyCategory(!CommissionPolicy::unlocked($other), 'Unlock isolated by session');
$wrong = Request::create('/', 'POST', ['password'=>'wrong-password']); $wrong->headers->set('Authorization','Bearer test-session-b');
try { $controller->unlock($wrong); throw new Exception('Wrong password accepted'); }
catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { verifyCategory($e->getStatusCode() === 422, 'Wrong password rejected'); }
DB::table('head_office_commission_settings')->update(['password_hash'=>Hash::make('rotated-test-password')]);
verifyCategory(!CommissionPolicy::unlocked($request), 'Password rotation invalidates access');
echo "Passed $checks commission category checks. No real database changed.\n";
