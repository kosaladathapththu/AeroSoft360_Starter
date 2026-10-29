<?php
// Reuse the isolated fixture set; all operations below remain in SQLite memory.
require __DIR__ . "/verify_connected_workflows.php";
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Api\ProcurementController;
use App\Services\Procurement\GoodsReceiptService;
use App\Services\Procurement\SupplierBalance;

$procurement = new ProcurementController();
$flowOrder = $procurement
    ->storePurchaseOrder(
        req([
            "supplier_id" => 1,
            "order_date" => "2026-10-01",
            "lines" => [["material_id" => 1, "quantity" => 100, "unit_cost" => 7]],
        ]),
    )
    ->getData(true);
$orderId = $flowOrder["id"];
rejects(
    fn() => $procurement->updatePurchaseOrder(
        req(["supplier_id" => 1, "order_date" => "2026-10-01", "status" => "received"]),
        $orderId,
    ),
    "PO status cannot skip the actual goods receipt",
);
$lineId = DB::table("purchase_order_lines")->where("purchase_order_id", $orderId)->value("id");
$receiver = new GoodsReceiptService($posting);
$receive = [
    "received_on" => "2026-10-15",
    "lines" => [
        ["purchase_order_line_id" => $lineId, "quantity" => 40, "batch_number" => "FLOW-BATCH"],
    ],
];
rejects(
    fn() => $procurement->receivePurchaseOrder(req($receive), $orderId, $receiver),
    "Draft purchase order cannot skip approval",
);
$procurement->approvePurchaseOrder($orderId);
$tooEarly = $receive;
$tooEarly["received_on"] = "2026-09-30";
rejects(
    fn() => $procurement->receivePurchaseOrder(req($tooEarly), $orderId, $receiver),
    "Goods receipt cannot predate its purchase order",
);
$first = $procurement->receivePurchaseOrder(req($receive), $orderId, $receiver)->getData(true);
check(
    $first["total"] == 280 &&
        DB::table("purchase_orders")->where("id", $orderId)->value("status") === "part_received",
    "Partial GRN records actual receipt and leaves PO open",
);
rejects(
    fn() => $procurement->updatePurchaseOrder(
        req(["supplier_id" => 1, "order_date" => "2026-10-01", "status" => "draft"]),
        $orderId,
    ),
    "Received PO cannot be reset to draft to bypass its history",
);
$journals = DB::table("journal_entries")->count();
$business->supplierInvoice(
    req([
        "goods_receipt_id" => $first["id"],
        "invoice_number" => "FLOW-BILL-1",
        "invoice_date" => "2026-10-15",
        "due_date" => "2026-11-15",
    ]),
);
check(
    DB::table("journal_entries")->count() === $journals,
    "Purchase invoice links to the GRN without posting inventory or liability twice",
);
$secondInput = $receive;
$secondInput["lines"][0]["quantity"] = 60;
$secondInput["received_on"] = "2026-10-16";
$second = $procurement->receivePurchaseOrder(req($secondInput), $orderId, $receiver)->getData(true);
check(
    $second["total"] == 420 &&
        DB::table("purchase_orders")->where("id", $orderId)->value("status") === "received",
    "Final GRN closes the order at exactly the ordered quantity",
);
check(
    (float) DB::table("stock_balances")->where("batch_number", "FLOW-BATCH")->sum("quantity") ===
        100.0,
    "Separate deliveries add stock once each",
);
rejects(
    fn() => $procurement->receivePurchaseOrder(req($receive), $orderId, $receiver),
    "Fully received PO cannot receive again",
);
$bill = DB::table("supplier_invoices")->where("goods_receipt_id", $first["id"])->first();
check(
    $bill->supplier_id == 1 && (float) $bill->total === 280.0,
    "Supplier invoice inherits supplier and received value from its GRN",
);
$voucher = [
    "kind" => "supplier",
    "payment_date" => "2026-10-20",
    "payment_method" => "cash",
    "payment_account_id" => $ids["1000"],
    "goods_receipt_id" => $first["id"],
    "description" => "FLOW-BILL-1 settlement",
    "lines" => [["description" => "Pay registered bill", "amount" => 280]],
];
$paymentId = $voucherService->save($voucher, null, 1);
$voucherService->post($paymentId, 1);
check(
    SupplierBalance::available(DB::table("goods_receipts")->find($first["id"])) === 0.0,
    "Supplier payment settles the selected GRN and registered bill",
);
check(
    SupplierBalance::available(DB::table("goods_receipts")->find($second["id"])) === 420.0,
    "Paying the first invoice does not settle a different delivery",
);
