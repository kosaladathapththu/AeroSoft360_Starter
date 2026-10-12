<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\SystemStatusController;
use App\Http\Controllers\Api\ProductionBatchController;
use App\Models\Product;

Route::get('/v1/status', [SystemStatusController::class, 'show']);
Route::get('/v1/products', fn () => Product::query()->select('id', 'code', 'name')->where('is_active', true)->orderBy('name')->get());
Route::apiResource('/v1/production-batches', ProductionBatchController::class)->except('show');
