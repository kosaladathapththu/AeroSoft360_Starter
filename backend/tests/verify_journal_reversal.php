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
$request = Request::create('/', 'POST', ['posting_date' => '2026-11-11', 'reason' => 'Incorrect opening']);
$reversal = $controller->reverse($request, $id, $posting)->getData(true);
if ((int) $reversal['source_id'] !== $id) throw new RuntimeException('Missing original link');
foreach (DB::table('journal_lines')->selectRaw('account_id, SUM(debit - credit) as net')->groupBy('account_id')->get() as $line) {
    if (abs((float) $line->net) > 0.001) throw new RuntimeException('Reversal did not offset balance');
}
$controller->reverse($request, $id, $posting);
if (DB::table('journal_entries')->count() !== 2) throw new RuntimeException('Duplicate reversal');
try {
    $controller->destroy($id);
    throw new RuntimeException('Posted journal deletion was allowed');
} catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
    if ($e->getStatusCode() !== 422) throw $e;
}
echo "Journal reversal checks passed.\n";
