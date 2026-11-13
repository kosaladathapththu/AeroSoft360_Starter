<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
try {
    $apply = in_array('--apply', $argv, true);
    $result = (new App\Services\Accounting\JournalRangeCleanupService())->run($apply);
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), PHP_EOL;
    if (!$apply) echo "PREVIEW ONLY. To delete exactly these journals and their four linked expense vouchers, run again with --apply.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Cleanup stopped: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
