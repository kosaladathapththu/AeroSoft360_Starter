<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite' => [
    'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
]]);
use Illuminate\Support\Facades\DB;
DB::purge('sqlite');
(require __DIR__ . '/../database/migrations/2026_10_13_000001_create_procure_to_stock_foundation.php')->up();
(require __DIR__ . '/../database/migrations/2026_10_28_000001_create_payment_vouchers.php')->up();
$account = DB::table('accounts')->insertGetId(['code' => '1000', 'name' => 'Cash', 'type' => 'asset', 'is_postable' => true]);
$period = DB::table('accounting_periods')->insertGetId(['name' => '2026', 'starts_on' => '2026-01-01', 'ends_on' => '2026-12-31', 'status' => 'open']);
$sources = [354=>['account_opening', 1],355=>['manual_journal',1],356=>['manual_journal',2],357=>['manual_journal',3],358=>['payment_voucher',1],359=>['journal_reversal',354],360=>['payment_voucher',2],361=>['payment_voucher_reversal',2],362=>['payment_voucher_reversal',1],363=>['payment_voucher',3],364=>['payment_voucher',4],365=>['journal_reversal',357],366=>['manual_journal',4],367=>['journal_reversal',366]];
foreach ([345 => ['sales_invoice', 1]] + $sources as $number => [$type, $source]) {
    DB::table('journal_entries')->insert(['id'=>$number, 'number'=>'JV-2611-'.str_pad($number,4,'0',STR_PAD_LEFT), 'accounting_period_id'=>$period,
        'source_type'=>$type,'source_id'=>$source,'posting_date'=>'2026-11-12','description'=>'Fixture','status'=>'posted','posted_at'=>now()]);
    DB::table('journal_lines')->insert(['journal_entry_id'=>$number,'account_id'=>$account,'debit'=>10,'credit'=>10]);
}
foreach ([1=>[358,362],2=>[360,361],3=>[363,null],4=>[364,null]] as $id=>[$journal,$reversal]) {
    DB::table('payment_vouchers')->insert(['id'=>$id,'number'=>'PV-TEST-'.$id,'kind'=>'expense','payment_date'=>'2026-11-12',
        'payee'=>'Test','payment_method'=>'cash','payment_account_id'=>$account,'description'=>'Test','total'=>10,'status'=>'posted',
        'journal_id'=>$journal,'reversal_journal_id'=>$reversal]);
    DB::table('payment_voucher_lines')->insert(['payment_voucher_id'=>$id,'account_id'=>$account,'description'=>'Test','amount'=>10]);
}
$service = new App\Services\Accounting\JournalRangeCleanupService();
$preview=$service->run();
if ($preview['applied'] || count($preview['journals'])!==14 || DB::table('journal_entries')->count()!==15) throw new RuntimeException('Preview modified data');
DB::table('accounting_periods')->update(['status'=>'closed']);
try { $service->run(true); throw new LogicException('Closed period allowed'); }
catch (RuntimeException $error) { if ($error instanceof LogicException) throw $error; }
DB::table('accounting_periods')->update(['status'=>'open']);
$result=$service->run(true);
if (DB::table('journal_entries')->count()!==1 || !DB::table('journal_entries')->where('id',345)->exists() || DB::table('journal_lines')->count()!==1)
    throw new RuntimeException('Cleanup affected wrong journals or left lines');
if (DB::table('payment_vouchers')->exists() || DB::table('payment_voucher_lines')->exists()) throw new RuntimeException('Voucher sources left behind');
if (!is_file($result['snapshot']) || !DB::table('audit_logs')->where('event','journal.range_deleted')->exists()) throw new RuntimeException('Recovery snapshot missing');
try { $service->run(true); throw new LogicException('Repeated cleanup allowed'); }
catch (RuntimeException $error) { if ($error instanceof LogicException) throw $error; }
unlink($result['snapshot']);
echo "Range cleanup checks passed: preview, exact scope, closed-period guard, source cleanup, snapshot and repeat guard.\n";
