<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));
ini_set('display_errors', '0');

// Upload this public folder to /home/camymarket/erp.supuncompanies.com.
// The application stays private at /home/camymarket/aerosoft360.
$application = dirname(__DIR__) . '/aerosoft360';
if (!is_file($application . '/vendor/autoload.php') || !is_file($application . '/bootstrap/app.php')) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'The application installation is not configured yet.']);
    exit;
}
if (is_file($maintenance = $application . '/storage/framework/maintenance.php')) {
    require $maintenance;
}
require $application . '/vendor/autoload.php';
$app = require $application . '/bootstrap/app.php';
$app->instance('path.public', __DIR__);
$kernel = $app->make(Kernel::class);
$response = $kernel->handle($request = Request::capture());
$response->send();
$kernel->terminate($request, $response);
