<?php
// Private CLI diagnostic. Never upload it into the website document root.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$failed = 0;
function reportCheck(bool $ok, string $message): void {
    global $failed;
    echo ($ok ? 'PASS: ' : 'FAIL: ') . $message . PHP_EOL;
    if (!$ok) $failed++;
}
reportCheck(PHP_VERSION_ID >= 80002, 'PHP matches the locked dependencies minimum (8.0.2); running ' . PHP_VERSION);
foreach (['ctype','dom','fileinfo','filter','gd','hash','iconv','json','libxml','mbstring','openssl','pcre','PDO','pdo_mysql','session','SimpleXML','tokenizer','xml','xmlreader','xmlwriter','zip','zlib'] as $extension) {
    reportCheck(extension_loaded($extension), 'PHP extension ' . $extension);
}
foreach (['bootstrap/cache','storage/app','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs'] as $directory) {
    reportCheck(is_dir(__DIR__ . '/' . $directory) && is_writable(__DIR__ . '/' . $directory), 'Writable private directory ' . $directory);
}
reportCheck(is_file(__DIR__ . '/vendor/autoload.php'), 'Composer dependencies are present');
reportCheck(is_file(__DIR__ . '/.env'), 'Private .env configured');
if (is_file(__DIR__ . '/.env')) {
    $env = file_get_contents(__DIR__ . '/.env');
    reportCheck((bool) preg_match('/^APP_DEBUG=false\s*$/m', $env), 'Debug display disabled');
    reportCheck((bool) preg_match('/^APP_KEY=base64:[A-Za-z0-9+\/=]+\s*$/m', $env), 'Application key is configured (value hidden)');
    reportCheck(strpos($env, 'REPLACE_WITH_') === false, 'Environment placeholders replaced');
}
echo 'NOTE: This checks local runtime requirements, not a database restore or framework security support.' . PHP_EOL;
echo 'NOTE: Run the application regression tests and staging checks on the target PHP version before go-live.' . PHP_EOL;
exit($failed ? 1 : 0);
