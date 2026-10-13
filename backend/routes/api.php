<?php

use App\Http\Controllers\Api\ProcurementController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/workspace', [ProcurementController::class, 'workspace']);
    Route::post('/suppliers', [ProcurementController::class, 'storeSupplier']);
    Route::put('/suppliers/{supplier}', [ProcurementController::class, 'updateSupplier']);
    Route::delete('/suppliers/{supplier}', [ProcurementController::class, 'deleteSupplier']);
    Route::post('/purchase-orders', [ProcurementController::class, 'storePurchaseOrder']);
    Route::put('/purchase-orders/{purchaseOrder}', [ProcurementController::class, 'updatePurchaseOrder']);
    Route::delete('/purchase-orders/{purchaseOrder}', [ProcurementController::class, 'deletePurchaseOrder']);
    Route::post('/purchase-orders/{purchaseOrder}/approve', [ProcurementController::class, 'approvePurchaseOrder']);
    Route::post('/purchase-orders/{purchaseOrder}/receive', [ProcurementController::class, 'receivePurchaseOrder']);
    Route::put('/stock/{stock}', [ProcurementController::class, 'updateStock']);
    Route::delete('/stock/{stock}', [ProcurementController::class, 'deleteStock']);
    Route::put('/journals/{journal}', [ProcurementController::class, 'updateJournal']);
    Route::delete('/journals/{journal}', [ProcurementController::class, 'deleteJournal']);
});
