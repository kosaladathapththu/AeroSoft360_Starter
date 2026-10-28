<?php
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AccessController;
use App\Http\Controllers\Api\AccountingPayrollController;
use App\Http\Controllers\Api\AccountingSalesController;
use App\Http\Controllers\Api\JournalController;
use App\Http\Controllers\Api\PaymentVoucherController;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\StockAdjustmentController;
use App\Http\Controllers\Api\PriceListController;
use App\Http\Controllers\Api\ProcurementController;
use App\Http\Controllers\Api\PayrollReportController;
use App\Http\Controllers\Api\SalesController;
use App\Http\Controllers\Api\CustomerPoExportController;
use Illuminate\Support\Facades\Route;

Route::prefix("v1")->group(function (): void {
    Route::post("/auth/login", [AuthController::class, "login"]);
    Route::middleware("token.auth")->group(function (): void {
        Route::get("/auth/me", [AuthController::class, "me"]);
        Route::post("/auth/logout", [AuthController::class, "logout"]);
        Route::get("/access", [AccessController::class, "index"])->middleware(
            "permission:admin.manage",
        );
        Route::post("/users", [AccessController::class, "storeUser"])->middleware(
            "permission:admin.manage",
        );
        Route::put("/users/{id}", [AccessController::class, "updateUser"])->middleware(
            "permission:admin.manage",
        );
        Route::delete("/users/{id}", [AccessController::class, "deleteUser"])->middleware(
            "permission:admin.manage",
        );
        Route::post("/roles", [AccessController::class, "storeRole"])->middleware(
            "permission:admin.manage",
        );
        Route::put("/roles/{id}", [AccessController::class, "updateRole"])->middleware(
            "permission:admin.manage",
        );
        Route::delete("/roles/{id}", [AccessController::class, "deleteRole"])->middleware(
            "permission:admin.manage",
        );
        Route::get("/quotations", [
            \App\Http\Controllers\Api\QuotationController::class,
            "index",
        ])->middleware("permission:workspace.view");
        Route::post("/quotations", [
            \App\Http\Controllers\Api\QuotationController::class,
            "store",
        ])->middleware("permission:accounting.manage");
        Route::put("/quotations/{id}", [
            \App\Http\Controllers\Api\QuotationController::class,
            "update",
        ])->middleware("permission:accounting.manage");
        Route::post("/quotations/{id}/convert", [
            \App\Http\Controllers\Api\QuotationController::class,
            "convert",
        ])->middleware("permission:accounting.manage");
        Route::post("/quotations/{id}/cancel", [
            \App\Http\Controllers\Api\QuotationController::class,
            "cancel",
        ])->middleware("permission:accounting.manage");
        Route::get("/business-workflows", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "index",
        ])->middleware("permission:workspace.view");
        Route::get("/subledger", [
            \App\Http\Controllers\Api\SubledgerController::class,
            "ledger",
        ])->middleware("permission:workspace.view");
        Route::post("/supplier-invoices", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "supplierInvoice",
        ])->middleware("permission:purchases.manage");
        Route::post("/purchase-returns", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "purchaseReturn",
        ])->middleware("permission:purchases.manage");
        Route::get("/cash-closing-preview", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "cashPreview",
        ])->middleware("permission:workspace.view");
        Route::post("/cash-closings", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "closeCash",
        ])->middleware("permission:accounting.manage");
        Route::post("/cash-closings/{id}/reopen", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "reopenCash",
        ])->middleware("permission:accounting.manage");
        Route::post("/recurring-journals", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "recurring",
        ])->middleware("permission:accounting.manage");
        Route::post("/recurring-journals/{id}/post", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "runRecurring",
        ])->middleware("permission:accounting.manage");
        Route::post("/recurring-journals/{id}/stop", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "stopRecurring",
        ])->middleware("permission:accounting.manage");
        Route::post("/bulk-stock-import", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "bulkStock",
        ])->middleware("permission:stock.manage");
        Route::post("/catalog-terms", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "term",
        ])->middleware("permission:accounting.manage");
        Route::post("/product-classification", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "assignProduct",
        ])->middleware("permission:accounting.manage");
        Route::post("/purchase-returns/{id}/cancel", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "cancelReturn",
        ])->middleware("permission:purchases.manage");
        Route::post("/salary-payments", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "salaryPayment",
        ])->middleware("permission:accounting.manage");
        Route::post("/salary-payments/{id}/reverse", [
            \App\Http\Controllers\Api\BusinessWorkflowController::class,
            "reverseSalary",
        ])->middleware("permission:accounting.manage");
        Route::get("/serial-warranties", [
            \App\Http\Controllers\Api\SerialWarrantyController::class,
            "index",
        ])->middleware("permission:workspace.view");
        Route::post("/product-serials", [
            \App\Http\Controllers\Api\SerialWarrantyController::class,
            "register",
        ])->middleware("permission:stock.manage");
        Route::post("/product-serials/attach", [
            \App\Http\Controllers\Api\SerialWarrantyController::class,
            "attach",
        ])->middleware("permission:accounting.manage");
        Route::post("/warranty-claims", [
            \App\Http\Controllers\Api\SerialWarrantyController::class,
            "claim",
        ])->middleware("permission:stock.manage");
        Route::put("/warranty-claims/{id}", [
            \App\Http\Controllers\Api\SerialWarrantyController::class,
            "resolve",
        ])->middleware("permission:stock.manage");
        Route::get("/point-of-sale", [
            \App\Http\Controllers\Api\PointOfSaleController::class,
            "index",
        ])->middleware("permission:workspace.view");
        Route::post("/point-of-sale/checkout", [
            \App\Http\Controllers\Api\PointOfSaleController::class,
            "checkout",
        ])->middleware("permission:accounting.manage");
        Route::get("/workspace", [ProcurementController::class, "workspace"])->middleware(
            "permission:workspace.view",
        );
        Route::get("/sales/workspace", [AccountingSalesController::class, "workspace"])->middleware(
            "permission:workspace.view",
        );
        Route::get("/sales/dashboard", [AccountingSalesController::class, "dashboard"])->middleware(
            "permission:workspace.view",
        );
        Route::get('/customers/{id}/profile', [\App\Http\Controllers\Api\CustomerProfileController::class, 'show'])->middleware('permission:workspace.view');
        Route::post("/customers", [SalesController::class, "storeCustomer"])->middleware(
            "permission:accounting.manage",
        );
        Route::put("/customers/{id}", [SalesController::class, "updateCustomer"])->middleware(
            "permission:accounting.manage",
        );
        Route::delete("/customers/{id}", [
            AccountingSalesController::class,
            "deleteCustomer",
        ])->middleware("permission:accounting.manage");
        Route::post("/sales-reps", [SalesController::class, "storeRep"])->middleware(
            "permission:accounting.manage",
        );
        Route::put("/sales-reps/{id}", [SalesController::class, "updateRep"])->middleware(
            "permission:accounting.manage",
        );
        Route::delete("/sales-reps/{id}", [
            AccountingSalesController::class,
            "deleteSalesRep",
        ])->middleware("permission:accounting.manage");
        Route::post("/articles", [SalesController::class, "storeArticle"])->middleware(
            "permission:accounting.manage",
        );
        Route::put("/articles/{id}", [SalesController::class, "updateArticle"])->middleware(
            "permission:accounting.manage",
        );
        Route::delete("/articles/{id}", [
            AccountingSalesController::class,
            "deleteArticle",
        ])->middleware("permission:accounting.manage");
        Route::post("/price-list/import", [PriceListController::class, "import"])->middleware(
            "permission:accounting.manage",
        );
        Route::post("/price-list/preview", [PriceListController::class, "preview"])->middleware(
            "permission:accounting.manage",
        );
        Route::post("/customer-pos", [SalesController::class, "storePo"])->middleware(
            "permission:accounting.manage",
        );
        Route::get("/customer-pos/export", [
            CustomerPoExportController::class,
            "download",
        ])->middleware("permission:workspace.view");
        Route::get("/customer-pos/{id}/export", [
            CustomerPoExportController::class,
            "download",
        ])->middleware("permission:workspace.view");
        Route::put("/customer-pos/{id}", [
            AccountingSalesController::class,
            "updateCustomerPo",
        ])->middleware("permission:accounting.manage");
        Route::delete("/customer-pos/{id}", [
            AccountingSalesController::class,
            "deleteCustomerPo",
        ])->middleware("permission:accounting.manage");
        Route::post("/customer-pos/{id}/convert", [SalesController::class, "convert"])->middleware(
            "permission:accounting.manage",
        );
        Route::post("/customer-pos/{id}/invoice", [
            AccountingSalesController::class,
            "invoiceCustomerPo",
        ])->middleware("permission:accounting.manage");
        Route::post("/sales-orders/manual", [
            AccountingSalesController::class,
            "manualSalesOrder",
        ])->middleware("permission:accounting.manage");
        Route::put("/sales-orders/{id}", [
            AccountingSalesController::class,
            "updateSalesOrder",
        ])->middleware("permission:accounting.manage");
        Route::delete("/sales-orders/{id}", [
            AccountingSalesController::class,
            "deleteSalesOrder",
        ])->middleware("permission:accounting.manage");
        Route::post("/sales-orders/{id}/invoice", [
            AccountingSalesController::class,
            "invoiceDispatch",
        ])->middleware("permission:accounting.manage");
        Route::post("/sales-invoices/manual", [
            AccountingSalesController::class,
            "manualInvoice",
        ])->middleware("permission:accounting.manage");
        Route::get("/sales-invoices/{id}/bill", [
            AccountingSalesController::class,
            "invoiceBill",
        ])->middleware("permission:workspace.view");
        Route::put("/sales-invoices/{id}", [
            AccountingSalesController::class,
            "updateInvoice",
        ])->middleware("permission:accounting.manage");
        Route::delete("/sales-invoices/{id}", [
            AccountingSalesController::class,
            "deleteInvoice",
        ])->middleware("permission:accounting.manage");
        Route::post("/customer-receipts", [
            AccountingSalesController::class,
            "receipt",
        ])->middleware("permission:accounting.manage");
        Route::put("/customer-receipts/{id}", [
            AccountingSalesController::class,
            "updateReceipt",
        ])->middleware("permission:accounting.manage");
        Route::delete("/customer-receipts/{id}", [
            AccountingSalesController::class,
            "deleteReceipt",
        ])->middleware("permission:accounting.manage");
        Route::post("/commissions/manual", [
            AccountingSalesController::class,
            "manualCommission",
        ])->middleware("permission:accounting.manage");
        Route::put("/commissions/manual/{id}", [
            AccountingSalesController::class,
            "updateManualCommission",
        ])->middleware("permission:accounting.manage");
        Route::delete("/commissions/manual/{id}", [
            AccountingSalesController::class,
            "deleteManualCommission",
        ])->middleware("permission:accounting.manage");
        Route::put("/commissions/{id}", [
            AccountingSalesController::class,
            "updateAutomaticCommission",
        ])->middleware("permission:accounting.manage");
        Route::delete("/commissions/{id}", [
            AccountingSalesController::class,
            "deleteAutomaticCommission",
        ])->middleware("permission:accounting.manage");
        Route::put("/commission-settings", [
            AccountingSalesController::class,
            "updateCommissionSettings",
        ])->middleware("permission:accounting.manage");
        Route::post("/finished-stock-adjustments", [
            AccountingSalesController::class,
            "adjustFinishedStock",
        ])->middleware("permission:stock.manage");
        Route::put("/finished-stock/{id}", [
            AccountingSalesController::class,
            "updateFinishedStock",
        ])->middleware("permission:stock.manage");
        Route::delete("/finished-stock/{id}", [
            AccountingSalesController::class,
            "deleteFinishedStock",
        ])->middleware("permission:stock.manage");
        Route::post("/finished-stock/temporary-fill", [
            AccountingSalesController::class,
            "temporaryFillFinishedStock",
        ])->middleware("permission:stock.manage");
        Route::get("/sales/aging", [SalesController::class, "aging"])->middleware(
            "permission:workspace.view",
        );
        Route::post("/suppliers", [ProcurementController::class, "storeSupplier"])->middleware(
            "permission:suppliers.manage",
        );
        Route::put("/suppliers/{supplier}", [
            ProcurementController::class,
            "updateSupplier",
        ])->middleware("permission:suppliers.manage");
        Route::delete("/suppliers/{supplier}", [
            ProcurementController::class,
            "deleteSupplier",
        ])->middleware("permission:suppliers.manage");
        Route::post("/purchase-orders", [
            ProcurementController::class,
            "storePurchaseOrder",
        ])->middleware("permission:purchases.manage");
        Route::put("/purchase-orders/{purchaseOrder}", [
            ProcurementController::class,
            "updatePurchaseOrder",
        ])->middleware("permission:purchases.manage");
        Route::delete("/purchase-orders/{purchaseOrder}", [
            ProcurementController::class,
            "deletePurchaseOrder",
        ])->middleware("permission:purchases.manage");
        Route::post("/purchase-orders/{purchaseOrder}/approve", [
            ProcurementController::class,
            "approvePurchaseOrder",
        ])->middleware("permission:purchases.approve");
        Route::post("/purchase-orders/{purchaseOrder}/receive", [
            ProcurementController::class,
            "receivePurchaseOrder",
        ])->middleware("permission:stock.manage");
        Route::put("/stock/{stock}", [ProcurementController::class, "updateStock"])->middleware(
            "permission:stock.manage",
        );
        Route::delete("/stock/{stock}", [ProcurementController::class, "deleteStock"])->middleware(
            "permission:stock.manage",
        );
        Route::post("/stock-adjustments", [StockAdjustmentController::class, "store"])->middleware(
            "permission:stock.manage",
        );
        Route::post("/journals", [JournalController::class, "store"])->middleware(
            "permission:accounting.manage",
        );
        Route::get("/payment-vouchers", [PaymentVoucherController::class, "index"])->middleware(
            "permission:workspace.view",
        );
        Route::get("/accounts", [AccountController::class, "index"])->middleware(
            "permission:workspace.view",
        );
        Route::post("/accounts", [AccountController::class, "store"])->middleware(
            "permission:accounting.manage",
        );
        Route::put("/accounts/{id}", [AccountController::class, "update"])->middleware(
            "permission:accounting.manage",
        );
        Route::get("/accounts/{id}/ledger", [AccountController::class, "ledger"])->middleware(
            "permission:workspace.view",
        );
        Route::get("/cash-flow", [AccountController::class, "cashFlow"])->middleware(
            "permission:workspace.view",
        );
        Route::post("/payment-vouchers", [PaymentVoucherController::class, "store"])->middleware(
            "permission:accounting.manage",
        );
        Route::put("/payment-vouchers/{id}", [
            PaymentVoucherController::class,
            "update",
        ])->middleware("permission:accounting.manage");
        Route::post("/payment-vouchers/{id}/post", [
            PaymentVoucherController::class,
            "post",
        ])->middleware("permission:accounting.manage");
        Route::post("/payment-vouchers/{id}/cancel", [
            PaymentVoucherController::class,
            "cancel",
        ])->middleware("permission:accounting.manage");
        Route::put("/journals/{journal}", [JournalController::class, "update"])->middleware(
            "permission:accounting.manage",
        );
        Route::delete("/journals/{journal}", [JournalController::class, "destroy"])->middleware(
            "permission:accounting.manage",
        );
        Route::get("/payroll", [PayrollReportController::class, "payroll"])->middleware(
            "permission:workspace.view",
        );
        Route::post("/attendance/import", [
            PayrollReportController::class,
            "importAttendance",
        ])->middleware("permission:accounting.manage");
        Route::get("/attendance/{attendanceImport}/excel", [
            PayrollReportController::class,
            "exportAttendance",
        ])->middleware("permission:workspace.view");
        Route::post("/payroll/calculate", [
            PayrollReportController::class,
            "calculatePayroll",
        ])->middleware("permission:accounting.manage");
        Route::post("/employees", [PayrollReportController::class, "storeEmployee"])->middleware(
            "permission:accounting.manage",
        );
        Route::put("/employees/{employee}", [
            PayrollReportController::class,
            "updateEmployee",
        ])->middleware("permission:accounting.manage");
        Route::put("/employees/{employee}/payroll-settings", [
            PayrollReportController::class,
            "updatePayrollSettings",
        ])->middleware("permission:accounting.manage");
        Route::delete("/employees/{employee}", [
            PayrollReportController::class,
            "deleteEmployee",
        ])->middleware("permission:accounting.manage");
        Route::put("/payroll-runs/{payrollRun}", [
            AccountingPayrollController::class,
            "updatePayrollRun",
        ])->middleware("permission:accounting.manage");
        Route::delete("/payroll-runs/{payrollRun}", [
            PayrollReportController::class,
            "deletePayrollRun",
        ])->middleware("permission:accounting.manage");
        Route::put("/payroll-items/{payrollItem}", [
            PayrollReportController::class,
            "updatePayrollItem",
        ])->middleware("permission:accounting.manage");
        Route::put("/payroll-items/{payrollItem}/payment", [
            PayrollReportController::class,
            "updatePayrollItemPayment",
        ])->middleware("permission:accounting.manage");
        Route::delete("/payroll-items/{payrollItem}", [
            PayrollReportController::class,
            "deletePayrollItem",
        ])->middleware("permission:accounting.manage");
        Route::get("/payroll-runs/{payrollRun}/excel", [
            PayrollReportController::class,
            "exportPayroll",
        ])->middleware("permission:workspace.view");
        Route::get("/reports/management", [PayrollReportController::class, "reports"])->middleware(
            "permission:workspace.view",
        );
        Route::get("/reports/financial-statements", [
            PayrollReportController::class,
            "financialStatements",
        ])->middleware("permission:workspace.view");
        Route::get("/reports/financial-statements/excel", [
            PayrollReportController::class,
            "exportFinancialStatements",
        ])->middleware("permission:workspace.view");
        Route::get("/reports/aging", [PayrollReportController::class, "aging"])->middleware(
            "permission:workspace.view",
        );
        Route::get("/reports/retail", [
            PayrollReportController::class,
            "retailReports",
        ])->middleware("permission:workspace.view");
        Route::get("/reports/aging/excel", [
            PayrollReportController::class,
            "exportAging",
        ])->middleware("permission:workspace.view");
    });
});
