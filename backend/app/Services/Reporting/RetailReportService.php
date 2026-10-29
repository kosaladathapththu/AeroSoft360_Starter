<?php

namespace App\Services\Reporting;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class RetailReportService
{
    public function reports(string $from, string $to): array
    {
        return [
            "period" => ["from" => $from, "to" => $to],
            "supplier_report" => $this->suppliers($from, $to),
            "customer_report" => $this->customers($from, $to),
            "product_report" => $this->products(),
            "inventory_balance" => $this->inventoryBalance(),
            "inventory_movement" => $this->inventoryMovements($from, $to),
            "purchase_report" => $this->purchases($from, $to),
            "product_purchase" => $this->productPurchases($from, $to),
            "sales_report" => $this->sales($from, $to),
            "product_sales" => $this->productSales($from, $to),
            "receipt_report" => $this->receipts($from, $to),
        ];
    }

    private function suppliers(string $from, string $to): array
    {
        return DB::table("suppliers as s")
            ->leftJoin("purchase_orders as p", function ($join) use ($from, $to) {
                $join->on("p.supplier_id", "=", "s.id")->whereBetween("p.order_date", [$from, $to]);
            })
            ->select(
                "s.code",
                "s.name",
                "s.phone",
                "s.payment_days",
                "s.status",
                DB::raw("COUNT(p.id) documents"),
                DB::raw("COALESCE(SUM(p.total),0) total"),
            )
            ->groupBy("s.id", "s.code", "s.name", "s.phone", "s.payment_days", "s.status")
            ->orderBy("s.name")
            ->get()
            ->all();
    }

    private function customers(string $from, string $to): array
    {
        return DB::table("customers as c")
            ->leftJoin("sales_invoices as i", function ($join) use ($from, $to) {
                $join
                    ->on("i.customer_id", "=", "c.id")
                    ->whereBetween("i.invoice_date", [$from, $to]);
            })
            ->select(
                "c.code",
                "c.name",
                "c.phone",
                "c.credit_days",
                "c.credit_limit",
                "c.status",
                DB::raw(
                    Schema::hasColumn("sales_invoices", "is_opening_balance")
                        ? "COALESCE(SUM(CASE WHEN i.is_opening_balance = 1 THEN i.total ELSE 0 END),0) opening_receivable"
                        : "0 as opening_receivable",
                ),
                DB::raw(
                    Schema::hasColumn("sales_invoices", "is_opening_balance")
                        ? "SUM(CASE WHEN i.is_opening_balance = 0 THEN 1 ELSE 0 END) invoices"
                        : "COUNT(i.id) invoices",
                ),
                DB::raw(
                    Schema::hasColumn("sales_invoices", "is_opening_balance")
                        ? "COALESCE(SUM(CASE WHEN i.is_opening_balance = 0 THEN i.total ELSE 0 END),0) sales"
                        : "COALESCE(SUM(i.total),0) sales",
                ),
                DB::raw("COALESCE(SUM(i.outstanding),0) outstanding"),
            )
            ->groupBy(
                "c.id",
                "c.code",
                "c.name",
                "c.phone",
                "c.credit_days",
                "c.credit_limit",
                "c.status",
            )
            ->orderBy("c.name")
            ->get()
            ->all();
    }

    private function products(): array
    {
        return DB::table("articles as a")
            ->join("article_set_templates as s", "s.article_id", "=", "a.id")
            ->join("article_set_items as i", "i.set_template_id", "=", "s.id")
            ->select(
                "a.code",
                "a.name",
                "a.category",
                "s.name as set_name",
                "i.item_code",
                "i.size_label",
                "i.colours",
                "i.quantity as pieces_per_set",
                "i.production_cost",
                "i.unit_price as selling_price",
                "i.price_source",
                "i.price_updated_at",
                "a.status",
            )
            ->orderBy("a.code")
            ->orderBy("i.sort_order")
            ->get()
            ->all();
    }

    private function inventoryBalance(): array
    {
        return DB::table("stock_balances as b")
            ->join("materials as m", "m.id", "=", "b.material_id")
            ->select(
                "m.code",
                "m.name",
                "m.category",
                "m.unit",
                "b.batch_number",
                "b.quantity",
                "b.unit_cost",
                DB::raw("(b.quantity*b.unit_cost) value"),
            )
            ->orderBy("m.name")
            ->orderBy("b.batch_number")
            ->get()
            ->all();
    }

    private function inventoryMovements(string $from, string $to): array
    {
        return DB::table("stock_movements as sm")
            ->join("materials as m", "m.id", "=", "sm.material_id")
            ->whereBetween(DB::raw("DATE(sm.occurred_at)"), [$from, $to])
            ->select(
                "sm.occurred_at",
                "m.code",
                "m.name",
                "sm.batch_number",
                "sm.movement_type",
                "sm.quantity",
                "sm.unit_cost",
                DB::raw("(sm.quantity*sm.unit_cost) value"),
                "sm.source_type",
                "sm.source_id",
            )
            ->orderByDesc("sm.occurred_at")
            ->get()
            ->all();
    }

    private function purchases(string $from, string $to): array
    {
        return DB::table("purchase_orders as p")
            ->join("suppliers as s", "s.id", "=", "p.supplier_id")
            ->whereBetween("p.order_date", [$from, $to])
            ->select(
                "p.number",
                "p.order_date",
                "p.expected_date",
                "s.code as supplier_code",
                "s.name as supplier",
                "p.status",
                "p.total",
            )
            ->orderByDesc("p.order_date")
            ->get()
            ->all();
    }

    private function productPurchases(string $from, string $to): array
    {
        return DB::table("goods_receipt_lines as l")
            ->join("goods_receipts as g", "g.id", "=", "l.goods_receipt_id")
            ->join("materials as m", "m.id", "=", "l.material_id")
            ->join("suppliers as s", "s.id", "=", "g.supplier_id")
            ->whereBetween("g.received_on", [$from, $to])
            ->select(
                "g.received_on",
                "g.number as receipt",
                "s.name as supplier",
                "m.code",
                "m.name",
                "l.batch_number",
                "l.quantity",
                "l.unit_cost",
                "l.line_total",
            )
            ->orderByDesc("g.received_on")
            ->get()
            ->all();
    }

    private function sales(string $from, string $to): array
    {
        return DB::table("sales_invoices as i")
            ->join("customers as c", "c.id", "=", "i.customer_id")
            ->join("sales_representatives as r", "r.id", "=", "i.sales_rep_id")
            ->whereBetween("i.invoice_date", [$from, $to])
            ->when(
                Schema::hasColumn("sales_invoices", "is_opening_balance"),
                fn($q) => $q->where("i.is_opening_balance", false),
            )
            ->select(
                "i.number",
                "i.invoice_date",
                "i.due_date",
                "c.code as customer_code",
                "c.name as customer",
                "r.name as sales_rep",
                "i.sale_type",
                "i.status",
                "i.total",
                "i.received_amount",
                "i.outstanding",
            )
            ->orderByDesc("i.invoice_date")
            ->get()
            ->all();
    }

    private function productSales(string $from, string $to): array
    {
        return DB::table("sales_invoice_lines as l")
            ->join("sales_invoices as i", "i.id", "=", "l.sales_invoice_id")
            ->join("articles as a", "a.id", "=", "l.article_id")
            ->join("customers as c", "c.id", "=", "i.customer_id")
            ->whereBetween("i.invoice_date", [$from, $to])
            ->select(
                "i.invoice_date",
                "i.number as invoice",
                "c.name as customer",
                "a.code",
                "a.name",
                "a.category",
                "l.size_label",
                "l.quantity",
                "l.rate",
                "l.line_total",
            )
            ->orderByDesc("i.invoice_date")
            ->get()
            ->all();
    }

    private function receipts(string $from, string $to): array
    {
        return DB::table("customer_receipts as r")
            ->join("customers as c", "c.id", "=", "r.customer_id")
            ->join("sales_representatives as rep", "rep.id", "=", "r.sales_rep_id")
            ->whereBetween("r.receipt_date", [$from, $to])
            ->when(
                Schema::hasColumn("customer_receipts", "is_opening_balance"),
                fn($q) => $q->where("r.is_opening_balance", false),
            )
            ->select(
                "r.number",
                "r.receipt_date",
                "c.code as customer_code",
                "c.name as customer",
                "rep.name as sales_rep",
                "r.payment_method",
                "r.reference",
                "r.amount",
                "r.status",
            )
            ->orderByDesc("r.receipt_date")
            ->get()
            ->all();
    }
}
