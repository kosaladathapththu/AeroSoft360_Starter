<?php

use App\Http\Controllers\Api\ProcurementController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/workspace', [ProcurementController::class, 'workspace']);
    Route::post('/suppliers', [ProcurementController::class, 'storeSupplier']);
    Route::post('/purchase-orders', [ProcurementController::class, 'storePurchaseOrder']);
    Route::post('/purchase-orders/{purchaseOrder}/approve', [ProcurementController::class, 'approvePurchaseOrder']);
    Route::post('/purchase-orders/{purchaseOrder}/receive', [ProcurementController::class, 'receivePurchaseOrder']);
});
