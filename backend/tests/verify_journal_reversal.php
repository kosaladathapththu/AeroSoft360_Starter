<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite' => [
    'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
]]);
Illuminate\Support\Facades\DB::purge('sqlite');
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use App\Services\Accounting\PostingService;
use App\Http\Controllers\Api\JournalController;
(require __DIR__ . '/../database/migrations/2026_10_13_000001_create_procure_to_stock_foundation.php')->up();
foreach ([['1000', 'Cash', 'asset'], ['3990', 'Opening equity', 'equity']] as [$code, $name, $type]) {
    DB::table('accounts')->insert(compact('code', 'name', 'type') + ['is_postable' => true]);
}
DB::table('accounting_periods')->insert(['name' => '2026', 'starts_on' => '2026-01-01', 'ends_on' => '2026-12-31', 'status' => 'open']);
$posting = new PostingService();
$id = $posting->post('account_opening', 1, '2026-11-11', 'Opening', [
    ['account_code' => '1000', 'debit' => 900000], ['account_code' => '3990', 'credit' => 900000],
]);
$controller = new JournalController();
$request = Request::create('/', 'POST', ['posting_date' => '2026-11-12', 'reason' => 'Incorrect opening']);
$reversal = $controller->reverse($request, $id, $posting)->getData(true);
$cashFlow = new App\Services\Reporting\CashFlowService();
$before = $cashFlow->report('2026-11-01', '2026-11-10');
if ($before['closing_balance'] != 0) throw new RuntimeException('Future opening leaked into earlier report');
$originalDate = $cashFlow->report('2026-11-01', '2026-11-11');
if ($originalDate['opening_balance'] != 900000 || $originalDate['closing_balance'] != 900000 || $originalDate['outflows'] != 0)
    throw new RuntimeException('Historical opening was changed before reversal date');
$after = $cashFlow->report('2026-11-01', '2026-11-12');
if ($after['opening_balance'] != 0 || $after['outflows'] != 0 || $after['net_change'] != 0 || $after['closing_balance'] != 0 || count($after['movements']) !== 0)
    throw new RuntimeException('Cancelled opening was reported as cash flow');
if ($after['reconciliation_difference'] != 0) throw new RuntimeException('Opening correction does not reconcile');
if ((int) $reversal['source_id'] !== $id) throw new RuntimeException('Missing original link');
foreach (DB::table('journal_lines')->selectRaw('account_id, SUM(debit - credit) as net')->groupBy('account_id')->get() as $line) {
    if (abs((float) $line->net) > 0.001) throw new RuntimeException('Reversal did not offset balance');
}
$controller->reverse($request, $id, $posting);
if (DB::table('journal_entries')->count() !== 2) throw new RuntimeException('Duplicate reversal');
DB::table('accounts')->insert(['code' => '5400', 'name' => 'Office expenses', 'type' => 'expense', 'is_postable' => true]);
$posting->post('manual_journal', 99, '2026-11-12', 'Actual expense', [
    ['account_code' => '5400', 'debit' => 25000], ['account_code' => '1000', 'credit' => 25000],
]);
$expenseReport = $cashFlow->report('2026-11-01', '2026-11-12');
if ($expenseReport['opening_balance'] != 0 || $expenseReport['outflows'] != 25000 || $expenseReport['closing_balance'] != -25000 || $expenseReport['reconciliation_difference'] != 0)
    throw new RuntimeException('Real expense or negative balance was hidden by opening correction');
DB::table('accounting_periods')->update(['status' => 'closed']);
$deleteRequest = Request::create('/', 'DELETE', ['reason' => 'Entered by mistake']);
try {
    $controller->destroy($deleteRequest, $id);
    throw new RuntimeException('Closed-period journal deletion was allowed');
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    if ($e->getStatusCode() !== 422) throw $e;
}
DB::table('accounting_periods')->update(['status' => 'open']);
echo "Journal reversal checks passed.\n";
foreach ([['1001', 'NTB'], ['1002', 'BOC'], ['1003', 'Super Center']] as [$code, $name]) {
    DB::table('accounts')->insert(['code' => $code, 'name' => $name, 'type' => 'asset', 'is_postable' => true]);
}
foreach ([['1001', 209000, 101], ['1002', 500000, 102], ['1003', 400000, 103]] as [$code, $amount, $sourceId]) {
    $posting->post('manual_journal', $sourceId, '2026-11-12', 'Transfer received', [
        ['account_code' => '1000', 'debit' => $amount], ['account_code' => $code, 'credit' => $amount],
    ]);
}
$posting->post('payment_voucher', 81, '2026-11-12', 'Cancelled payment', [
    ['account_code' => '5400', 'debit' => 80000], ['account_code' => '1000', 'credit' => 80000],
]);
$posting->post('payment_voucher_reversal', 81, '2026-11-13', 'Cancel payment', [
    ['account_code' => '1000', 'debit' => 80000], ['account_code' => '5400', 'credit' => 80000],
]);
$posting->post('payment_voucher', 82, '2026-11-12', 'Commission', [
    ['account_code' => '5400', 'debit' => 42810], ['account_code' => '1000', 'credit' => 42810],
]);
$cashId = (int) DB::table('accounts')->where('code', '1000')->value('id');
$selected = $cashFlow->report('2026-11-01', '2026-11-13', $cashId);
if ($selected['inflows'] != 1109000 || $selected['outflows'] != 67810 || $selected['closing_balance'] != 1041190 || $selected['reconciliation_difference'] != 0)
    throw new RuntimeException('Selected cash account does not match transfers less real payments');
if ($selected['accounts'][0]['receipts'] != 1109000 || $selected['accounts'][0]['payments'] != 67810)
    throw new RuntimeException('Account detail differs from selected report');
$previousDay = $cashFlow->report('2026-11-01', '2026-11-12', $cashId);
if ($previousDay['outflows'] != 147810) throw new RuntimeException('Future cancellation incorrectly removed earlier payment');
$combined = $cashFlow->report('2026-11-01', '2026-11-13');
if ($combined['closing_balance'] != -67810 || $combined['reconciliation_difference'] != 0)
    throw new RuntimeException('Combined account totals changed');
echo "Selected cash account checks passed: received 1,109,000; paid 67,810; closing 1,041,190.\n";
$pairIds = [$id, (int) $reversal['id']];
$controller->destroy($deleteRequest, (int) $reversal['id']);
if (DB::table('journal_entries')->whereIn('id', $pairIds)->exists() || DB::table('journal_lines')->whereIn('journal_entry_id', $pairIds)->exists())
    throw new RuntimeException('Original or reversal left behind');
if (!DB::table('audit_logs')->where('event', 'journal.deleted')->where('entity_id', $id)->exists())
    throw new RuntimeException('Deletion audit missing');
if ($cashFlow->report('2026-11-01', '2026-11-11')['closing_balance'] != 0)
    throw new RuntimeException('Deleted opening still affects historical reports');
if ($cashFlow->report('2026-11-01', '2026-11-13', $cashId)['closing_balance'] != 1041190)
    throw new RuntimeException('Deleting offsetting pair changed current cash');
$paymentId = (int) DB::table('journal_entries')->where('source_type', 'payment_voucher')->value('id');
try {
    $controller->destroy($deleteRequest, $paymentId);
    throw new RuntimeException('Source payment journal deletion was allowed');
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    if ($e->getStatusCode() !== 422) throw $e;
}
$standaloneId = $posting->post('manual_journal', 150, '2026-11-13', 'Mistake', [
    ['account_code' => '1000', 'debit' => 10], ['account_code' => '3990', 'credit' => 10],
]);
$controller->destroy($deleteRequest, $standaloneId);
if ($cashFlow->report('2026-11-01', '2026-11-13', $cashId)['closing_balance'] != 1041190)
    throw new RuntimeException('Standalone journal remains in balances after deletion');
echo "Journal deletion checks passed: pair cleanup, historical/current reports, audit, source protection and closed-period protection.\n";
