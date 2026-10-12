<?php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

final class AeroSoftDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('AeroSoft demo data must never be seeded in production.');
        }

        DB::transaction(function (): void {
            $now = now();
            $this->upsert('aero_roles', ['code' => 'SUPER_ADMIN'], ['name' => 'Super Admin', 'created_at' => $now, 'updated_at' => $now]);
            $roleId = $this->id('aero_roles', 'code', 'SUPER_ADMIN');
            foreach (['dashboard.view','inventory.view','inventory.create','sales.view','finance.view','workflow.approve'] as $permission) {
                $this->upsert('aero_permissions', ['code' => $permission], ['description' => 'Demo permission: '.$permission, 'created_at' => $now, 'updated_at' => $now]);
                DB::table('aero_role_permissions')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $this->id('aero_permissions', 'code', $permission)]);
            }

            $this->upsert('users', ['email' => 'demo.admin@example.test'], ['name' => 'Demo Administrator', 'email_verified_at' => $now, 'password' => Hash::make('AeroSoft360-Demo!'), 'created_at' => $now, 'updated_at' => $now]);
            $userId = $this->id('users', 'email', 'demo.admin@example.test');
            DB::table('aero_user_roles')->insertOrIgnore(['user_id' => $userId, 'role_id' => $roleId]);

            $this->upsert('aero_companies', ['code' => 'SUPUN-DEMO'], ['name' => 'Supun AeroSoft Demo Company', 'timezone' => 'Asia/Colombo', 'base_currency' => 'LKR', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
            $companyId = $this->id('aero_companies', 'code', 'SUPUN-DEMO');
            $this->upsert('aero_units', ['code' => 'PCS'], ['name' => 'Pieces', 'decimal_places' => 0, 'created_at' => $now, 'updated_at' => $now]);
            $unitId = $this->id('aero_units', 'code', 'PCS');
            $this->upsert('aero_warehouses', ['company_id' => $companyId, 'code' => 'MAIN'], ['name' => 'Main Warehouse', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
            $warehouseId = DB::table('aero_warehouses')->where(['company_id' => $companyId, 'code' => 'MAIN'])->value('id');
            $this->upsert('aero_locations', ['warehouse_id' => $warehouseId, 'code' => 'FG-A01'], ['name' => 'Finished Goods A01', 'stock_type' => 'saleable', 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
            $locationId = DB::table('aero_locations')->where(['warehouse_id' => $warehouseId, 'code' => 'FG-A01'])->value('id');

            $this->upsert('aero_customers', ['company_id' => $companyId, 'code' => 'CUS-001'], ['name' => 'City Footwear (Demo)', 'email' => 'buyer@example.test', 'phone' => '0000000000', 'credit_days' => 30, 'credit_limit' => 500000, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
            $customerId = DB::table('aero_customers')->where(['company_id' => $companyId, 'code' => 'CUS-001'])->value('id');
            $this->upsert('aero_suppliers', ['company_id' => $companyId, 'code' => 'SUP-001'], ['name' => 'Lanka Polymer Supplies (Demo)', 'email' => 'supplier@example.test', 'phone' => '0000000000', 'payment_days' => 30, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
            $supplierId = DB::table('aero_suppliers')->where(['company_id' => $companyId, 'code' => 'SUP-001'])->value('id');

            $this->upsert('aero_products', ['code' => 'AERO-RUNNER'], ['name' => 'Aero Runner', 'category' => 'Shoes', 'is_active' => true, 'unit_id' => $unitId, 'product_type' => 'finished_good', 'created_at' => $now, 'updated_at' => $now]);
            $productId = $this->id('aero_products', 'code', 'AERO-RUNNER');
            $variantIds = [];
            foreach (['06','07','08','09','10'] as $size) {
                $sku = 'AR-BLK-'.$size;
                $this->upsert('aero_product_variants', ['sku' => $sku], ['product_id' => $productId, 'size' => $size, 'color' => 'Black', 'created_at' => $now, 'updated_at' => $now]);
                $variantIds[] = $this->id('aero_product_variants', 'sku', $sku);
            }
            $variantId = $variantIds[2];
            $this->upsert('aero_set_templates', ['product_id' => $productId, 'name' => 'Standard 10-piece set', 'version' => 1], ['is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
            $setId = DB::table('aero_set_templates')->where(['product_id' => $productId, 'name' => 'Standard 10-piece set', 'version' => 1])->value('id');
            foreach ($variantIds as $id) DB::table('aero_set_components')->updateOrInsert(['set_template_id' => $setId, 'product_variant_id' => $id], ['quantity' => 2]);

            $this->upsert('aero_inventory_batches', ['product_variant_id' => $variantId, 'batch_no' => 'FG-260091'], ['received_on' => '2026-10-08', 'unit_cost' => 1245, 'status' => 'available', 'created_at' => $now, 'updated_at' => $now]);
            $batchId = DB::table('aero_inventory_batches')->where(['product_variant_id' => $variantId, 'batch_no' => 'FG-260091'])->value('id');
            DB::table('aero_stock_movements')->updateOrInsert(['event_key' => 'demo-opening-FG-260091'], ['batch_id' => $batchId, 'location_id' => $locationId, 'movement_type' => 'opening', 'quantity' => 190, 'unit_cost' => 1245, 'source_type' => 'demo_opening', 'source_id' => 1, 'reason' => 'Fictional demonstration opening balance', 'created_by' => $userId, 'occurred_at' => '2026-10-08 08:00:00', 'created_at' => $now, 'updated_at' => $now]);

            $this->upsert('aero_purchase_orders', ['po_no' => 'PO-260041'], ['supplier_id' => $supplierId, 'order_date' => '2026-10-08', 'expected_date' => '2026-10-15', 'status' => 'part_received', 'currency' => 'LKR', 'total' => 685000, 'created_by' => $userId, 'created_at' => $now, 'updated_at' => $now]);
            $poId = $this->id('aero_purchase_orders', 'po_no', 'PO-260041');
            DB::table('aero_purchase_order_lines')->updateOrInsert(['purchase_order_id' => $poId, 'product_variant_id' => $variantId], ['quantity' => 500, 'unit_price' => 1245, 'tax_amount' => 62500, 'created_at' => $now, 'updated_at' => $now]);
            $poLineId = DB::table('aero_purchase_order_lines')->where(['purchase_order_id' => $poId, 'product_variant_id' => $variantId])->value('id');
            $this->upsert('aero_goods_receipts', ['grn_no' => 'GRN-260118'], ['purchase_order_id' => $poId, 'received_on' => '2026-10-11', 'status' => 'approved', 'received_by' => $userId, 'created_at' => $now, 'updated_at' => $now]);
            $grnId = $this->id('aero_goods_receipts', 'grn_no', 'GRN-260118');
            DB::table('aero_goods_receipt_lines')->updateOrInsert(['goods_receipt_id' => $grnId, 'purchase_order_line_id' => $poLineId], ['batch_id' => $batchId, 'accepted_quantity' => 250, 'rejected_quantity' => 5, 'quality_status' => 'accepted', 'created_at' => $now, 'updated_at' => $now]);

            $this->upsert('aero_sales_invoices', ['invoice_no' => 'INV-260812'], ['customer_id' => $customerId, 'representative_id' => $userId, 'invoice_date' => '2026-10-01', 'due_date' => '2026-10-31', 'channel' => 'head_office', 'status' => 'posted', 'subtotal' => 185000, 'tax_total' => 0, 'grand_total' => 185000, 'created_at' => $now, 'updated_at' => $now]);
            $invoiceId = $this->id('aero_sales_invoices', 'invoice_no', 'INV-260812');
            DB::table('aero_sales_invoice_lines')->updateOrInsert(['sales_invoice_id' => $invoiceId, 'product_variant_id' => $variantId], ['quantity' => 100, 'unit_price' => 1850, 'discount' => 0, 'tax_amount' => 0, 'line_total' => 185000, 'created_at' => $now, 'updated_at' => $now]);
            $invoiceLineId = DB::table('aero_sales_invoice_lines')->where(['sales_invoice_id' => $invoiceId, 'product_variant_id' => $variantId])->value('id');
            $this->upsert('aero_receipts', ['receipt_no' => 'RCT-260312'], ['customer_id' => $customerId, 'collection_date' => '2026-10-10', 'cleared_date' => '2026-10-10', 'payment_method' => 'bank_transfer', 'status' => 'cleared', 'amount' => 92500, 'reference' => 'DEMO-BANK-001', 'collected_by' => $userId, 'created_at' => $now, 'updated_at' => $now]);
            $receiptId = $this->id('aero_receipts', 'receipt_no', 'RCT-260312');
            DB::table('aero_receipt_allocations')->updateOrInsert(['receipt_id' => $receiptId, 'sales_invoice_id' => $invoiceId], ['amount' => 92500, 'created_at' => $now, 'updated_at' => $now]);
            $allocationId = DB::table('aero_receipt_allocations')->where(['receipt_id' => $receiptId, 'sales_invoice_id' => $invoiceId])->value('id');
            DB::table('aero_commission_rates')->updateOrInsert(['product_id' => $productId, 'representative_id' => $userId, 'channel' => 'head_office', 'effective_from' => '2026-10-01'], ['rate' => 46.25, 'effective_to' => null, 'status' => 'approved', 'created_at' => $now, 'updated_at' => $now]);
            $rateId = DB::table('aero_commission_rates')->where(['product_id' => $productId, 'representative_id' => $userId, 'channel' => 'head_office', 'effective_from' => '2026-10-01'])->value('id');
            DB::table('aero_commissions')->updateOrInsert(['sales_invoice_line_id' => $invoiceLineId, 'receipt_allocation_id' => $allocationId, 'commission_rate_id' => $rateId], ['representative_id' => $userId, 'eligible_days' => 100, 'eligible_amount' => 92500, 'payment_percentage' => 0.5, 'base_commission' => 4625, 'final_commission' => 2312.5, 'status' => 'calculated', 'created_at' => $now, 'updated_at' => $now]);

            $this->upsert('aero_fiscal_periods', ['code' => '2026-10'], ['starts_on' => '2026-10-01', 'ends_on' => '2026-10-31', 'is_closed' => false, 'created_at' => $now, 'updated_at' => $now]);
            $periodId = $this->id('aero_fiscal_periods', 'code', '2026-10');
            foreach ([['1100','Trade Receivables','asset'],['4100','Sales Revenue','revenue']] as [$code,$name,$type]) $this->upsert('aero_gl_accounts', ['code' => $code], ['name' => $name, 'type' => $type, 'parent_id' => null, 'postable' => true, 'created_at' => $now, 'updated_at' => $now]);
            $this->upsert('aero_journal_entries', ['event_key' => 'sales-invoice-INV-260812'], ['journal_no' => 'JNL-260901', 'source_type' => 'sales_invoice', 'source_id' => (string)$invoiceId, 'period_id' => $periodId, 'posted_on' => '2026-10-01', 'status' => 'posted', 'posted_by' => $userId, 'created_at' => $now, 'updated_at' => $now]);
            $journalId = $this->id('aero_journal_entries', 'event_key', 'sales-invoice-INV-260812');
            foreach ([['1100',185000,0],['4100',0,185000]] as [$code,$debit,$credit]) DB::table('aero_journal_lines')->updateOrInsert(['journal_entry_id' => $journalId, 'account_id' => $this->id('aero_gl_accounts', 'code', $code)], ['debit' => $debit, 'credit' => $credit, 'memo' => 'Fictional demo invoice', 'created_at' => $now, 'updated_at' => $now]);
        });
    }

    private function upsert(string $table, array $identity, array $values): void
    {
        DB::table($table)->updateOrInsert($identity, $values);
    }

    private function id(string $table, string $column, string $value): int
    {
        return (int) DB::table($table)->where($column, $value)->value('id');
    }
}
