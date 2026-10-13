<?php
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProcurementController;
use App\Http\Controllers\Api\PayrollReportController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function ():void {
 Route::post('/auth/login',[AuthController::class,'login']);
 Route::middleware('token.auth')->group(function ():void {
  Route::get('/auth/me',[AuthController::class,'me']);
  Route::post('/auth/logout',[AuthController::class,'logout']);
  Route::get('/workspace',[ProcurementController::class,'workspace'])->middleware('permission:workspace.view');
  Route::post('/suppliers',[ProcurementController::class,'storeSupplier'])->middleware('permission:suppliers.manage');
  Route::put('/suppliers/{supplier}',[ProcurementController::class,'updateSupplier'])->middleware('permission:suppliers.manage');
  Route::delete('/suppliers/{supplier}',[ProcurementController::class,'deleteSupplier'])->middleware('permission:suppliers.manage');
  Route::post('/purchase-orders',[ProcurementController::class,'storePurchaseOrder'])->middleware('permission:purchases.manage');
  Route::put('/purchase-orders/{purchaseOrder}',[ProcurementController::class,'updatePurchaseOrder'])->middleware('permission:purchases.manage');
  Route::delete('/purchase-orders/{purchaseOrder}',[ProcurementController::class,'deletePurchaseOrder'])->middleware('permission:purchases.manage');
  Route::post('/purchase-orders/{purchaseOrder}/approve',[ProcurementController::class,'approvePurchaseOrder'])->middleware('permission:purchases.approve');
  Route::post('/purchase-orders/{purchaseOrder}/receive',[ProcurementController::class,'receivePurchaseOrder'])->middleware('permission:stock.manage');
  Route::put('/stock/{stock}',[ProcurementController::class,'updateStock'])->middleware('permission:stock.manage');
  Route::delete('/stock/{stock}',[ProcurementController::class,'deleteStock'])->middleware('permission:stock.manage');
  Route::put('/journals/{journal}',[ProcurementController::class,'updateJournal'])->middleware('permission:accounting.manage');
  Route::delete('/journals/{journal}',[ProcurementController::class,'deleteJournal'])->middleware('permission:accounting.manage');
  Route::get('/payroll',[PayrollReportController::class,'payroll'])->middleware('permission:workspace.view');
  Route::post('/employees',[PayrollReportController::class,'storeEmployee'])->middleware('permission:accounting.manage');
  Route::put('/employees/{employee}',[PayrollReportController::class,'updateEmployee'])->middleware('permission:accounting.manage');
  Route::delete('/employees/{employee}',[PayrollReportController::class,'deleteEmployee'])->middleware('permission:accounting.manage');
  Route::put('/payroll-runs/{payrollRun}',[PayrollReportController::class,'updatePayrollRun'])->middleware('permission:accounting.manage');
  Route::delete('/payroll-runs/{payrollRun}',[PayrollReportController::class,'deletePayrollRun'])->middleware('permission:accounting.manage');
  Route::get('/reports/management',[PayrollReportController::class,'reports'])->middleware('permission:workspace.view');
  Route::get('/reports/financial-statements',[PayrollReportController::class,'financialStatements'])->middleware('permission:workspace.view');
  Route::get('/reports/financial-statements/excel',[PayrollReportController::class,'exportFinancialStatements'])->middleware('permission:workspace.view');
 });
});
