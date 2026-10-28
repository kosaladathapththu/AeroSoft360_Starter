<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class GlobalSearchController
{
    public function index(Request $request)
    {
        $input = $request->validate(['q' => 'required|string|max:120']);
        $words = preg_split('/[^\p{L}\p{N}]+/u', trim($input['q']), -1, PREG_SPLIT_NO_EMPTY);
        if (!$words) return response()->json(['results' => []]);
        $sources = [
            'customers' => 'Customers', 'sales_representatives' => 'Salespersons',
            'articles' => 'Pricing List', 'categories' => 'Categories', 'brands' => 'Brands',
            'units' => 'Units', 'suppliers' => 'Suppliers', 'materials' => 'Raw Material Stock',
            'quotations' => 'Quotations', 'customer_pos' => 'Customer POs',
            'sales_orders' => 'Sales Orders', 'sales_invoices' => 'Invoices',
            'customer_receipts' => 'Collections', 'purchase_orders' => 'Purchase Orders',
            'goods_receipts' => 'Receive Goods', 'supplier_invoices' => 'Supplier Invoices',
            'purchase_returns' => 'Purchase Returns', 'accounts' => 'Chart of Accounts',
            'payment_vouchers' => 'Payment Vouchers', 'journal_entries' => 'General Ledger',
            'employees' => 'Employees', 'payroll_runs' => 'Payroll',
            'product_serials' => 'Serials & Warranty', 'warranty_claims' => 'Serials & Warranty',
            'recurring_journals' => 'Recurring Journals',
        ];
        // Search only business display fields. Never search authentication or credential tables.
        $fields = ['code', 'number', 'name', 'phone', 'address', 'tin', 'description',
            'reference', 'customer_po_reference', 'supplier_invoice_number', 'serial_number',
            'issue', 'resolution', 'status', 'category', 'brand', 'period_start', 'period_end',
            'invoice_date', 'po_date', 'order_date', 'receipt_date', 'posting_date', 'payment_date'];
        $results = [];
        foreach ($sources as $table => $page) {
            if (!Schema::hasTable($table)) continue;
            $columns = array_values(array_intersect($fields, Schema::getColumnListing($table)));
            if (!$columns) continue;
            $query = DB::table($table);
            foreach (array_slice($words, 0, 12) as $word) {
                $query->where(function ($query) use ($columns, $word) {
                    foreach ($columns as $column) $query->orWhere($column, 'like', '%' . $word . '%');
                });
            }
            foreach ($query->select(array_merge(['id'], $columns))->orderByDesc('id')->limit(5)->get() as $row) {
                $label = $row->number ?? $row->code ?? $row->serial_number ?? $row->name ?? ('#' . $row->id);
                $results[] = ['id' => $row->id, 'page' => $page, 'label' => $label,
                    'description' => $row->name ?? $row->description ?? $row->reference ?? $row->issue ?? '',
                    'query' => $row->number ?? $row->code ?? $row->serial_number ?? $row->name ?? (string)$row->id];
            }
        }
        return response()->json(['results' => $results, 'note' => 'Up to five matches per record type. Open a page to see its matching records.']);
    }
}
