<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\SystemStatusController;

Route::get('/v1/status', [SystemStatusController::class, 'show']);
// TODO: Register authenticated API routes protected by Laravel auth and policies.
