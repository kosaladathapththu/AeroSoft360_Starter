<?php
namespace App\Services\Reporting;

use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

final class CustomerPoExporter
{
    public function make(?int $id = null): Spreadsheet
    {
        return DB::transaction(function () use ($id) {
            $query = DB::table("customer_pos as po")
                ->join("customers as customer", "customer.id", "=", "po.customer_id")
                ->join("sales_representatives as rep", "rep.id", "=", "po.sales_rep_id")
                ->select(
                    "po.*",
                    "customer.code as customer_code",
                    "customer.name as customer_name",
                    "customer.phone as customer_phone",
                    "customer.address as customer_address",
                    "rep.name as rep_name",
                )
                ->orderByDesc("po.po_date")
                ->orderByDesc("po.id");
            if ($id !== null) {
                $query->where("po.id", $id);
            }
            $orders = $query->get();
            abort_if($id !== null && $orders->isEmpty(), 404, "Customer PO not found.");
            $lines = DB::table("customer_po_lines as line")
                ->join("articles as article", "article.id", "=", "line.article_id")
                ->leftJoin(
                    "article_set_templates as template",
                    "template.id",
                    "=",
                    "line.set_template_id",
                )
                ->leftJoin("article_set_items as item", "item.id", "=", "line.set_item_id")
                ->select(
                    "line.*",
                    "article.code as article_code",
                    "article.name as article_name",
                    "template.name as set_name",
                    "item.size_label",
                )
                ->whereIn("line.customer_po_id", $orders->pluck("id"))
                ->orderBy("line.customer_po_id")
                ->orderBy("line.id")
                ->get();
            $pieces = $lines
                ->groupBy("customer_po_id")
                ->map(fn($rows) => (float) $rows->sum("pieces"));
            $book = new Spreadsheet();
            $book
                ->getProperties()
                ->setCreator("AeroSoft360")
                ->setTitle($id === null ? "All Customer POs" : $orders->first()->number);
            $summary = $book->getActiveSheet()->setTitle("PO Summary");
            $scope =
                $id === null
                    ? "All customer POs · all dates and statuses"
                    : "Customer PO: " . $orders->first()->number;
            $this->heading($summary, "CUSTOMER PURCHASE ORDERS", $scope, 13);
            $this->row($summary, 5, [
                "PO number",
                "Customer reference",
                "PO date",
                "Customer code",
                "Customer",
                "Phone",
                "Address",
                "Salesperson",
                "Sale type",
                "Status",
                "Cash amount (LKR)",
                "Pieces",
                "PO total (LKR)",
            ]);
            $row = 6;
            foreach ($orders as $order) {
                $this->row($summary, $row++, [
                    $order->number,
                    $order->customer_po_reference,
                    $order->po_date,
                    $order->customer_code,
                    $order->customer_name,
                    $order->customer_phone,
                    $order->customer_address,
                    $order->rep_name,
                    $order->sale_type,
                    $order->status,
                    (float) ($order->cash_amount ?? 0),
                    $pieces->get($order->id, 0.0),
                    (float) $order->total,
                ]);
            }
            $this->row($summary, $row, [
                "TOTAL · " . $orders->count() . " POs",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                (float) $orders->sum("cash_amount"),
                (float) $lines->sum("pieces"),
                (float) $orders->sum("total"),
            ]);
            $summary
                ->getStyle("A$row:M$row")
                ->getFont()
                ->setBold(true);
            $summary
                ->getStyle("K6:K$row")
                ->getNumberFormat()
                ->setFormatCode("#,##0.00");
            $summary
                ->getStyle("M6:M$row")
                ->getNumberFormat()
                ->setFormatCode("#,##0.00");
            $this->finish($summary, 13, $row - 1);
            $items = $book->createSheet()->setTitle("PO Items");
            $this->heading(
                $items,
                "CUSTOMER PO ITEM DETAILS",
                $scope . " · quantities and values as saved on each PO",
                12,
            );
            $this->row($items, 5, [
                "PO number",
                "Article code",
                "Article",
                "Order method",
                "Set template",
                "Size",
                "Colour",
                "Sets",
                "Pieces",
                "Stored rate (LKR)",
                "Rate basis",
                "Line total (LKR)",
                "Fixed rate per piece (LKR)",
            ]);
            $numbers = $orders->pluck("number", "id");
            $row = 6;
            foreach ($lines as $line) {
                $individual = ($line->order_mode ?? "badge") === "size";
                $this->row($items, $row++, [
                    $numbers[$line->customer_po_id],
                    $line->article_code,
                    $line->article_name,
                    $individual ? "Individual size" : "Complete set",
                    $line->set_name,
                    $individual ? $line->size_label : "Complete set",
                    $line->colour,
                    (float) $line->sets,
                    (float) $line->pieces,
                    (float) $line->rate,
                    "Per piece",
                    (float) $line->line_total,
                    $line->fixed_rate ?? 'Not recorded',
                ]);
            }
            $this->row($items, $row, [
                "TOTAL",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                (float) $lines->sum("pieces"),
                "",
                "",
                (float) $lines->sum("line_total"),
            ]);
            $items
                ->getStyle("A$row:L$row")
                ->getFont()
                ->setBold(true);
            $items
                ->getStyle("J6:J$row")
                ->getNumberFormat()
                ->setFormatCode("#,##0.00");
            $items
                ->getStyle("L6:L$row")
                ->getNumberFormat()
                ->setFormatCode("#,##0.00");
            $this->finish($items, 13, $row - 1);
            $book->setActiveSheetIndex(0);
            return $book;
        });
    }

    private function row(Worksheet $sheet, int $row, array $values): void
    {
        foreach ($values as $index => $value) {
            $sheet->setCellValueExplicitByColumnAndRow(
                $index + 1,
                $row,
                $value ?? "",
                is_int($value) || is_float($value) ? DataType::TYPE_NUMERIC : DataType::TYPE_STRING,
            );
        }
    }

    private function heading(Worksheet $sheet, string $title, string $scope, int $columns): void
    {
        $last = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($columns);
        $sheet->mergeCells("A1:{$last}1")->setCellValue("A1", $title);
        $sheet
            ->mergeCells("A2:{$last}2")
            ->setCellValueExplicit("A2", $scope, DataType::TYPE_STRING);
        $sheet
            ->mergeCells("A3:{$last}3")
            ->setCellValue(
                "A3",
                "Exported " .
                    now()->timezone("Asia/Colombo")->format("Y-m-d H:i") .
                    " · LKR · Supun AeroSoft (Pvt) Ltd",
            );
        $sheet
            ->getStyle("A1")
            ->getFont()
            ->setSize(18)
            ->setBold(true)
            ->getColor()
            ->setARGB("FF145D57");
        $sheet->getRowDimension(1)->setRowHeight(30);
    }

    private function finish(Worksheet $sheet, int $columns, int $lastData): void
    {
        $last = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($columns);
        $sheet
            ->getStyle("A5:{$last}5")
            ->getFont()
            ->setBold(true)
            ->getColor()
            ->setARGB("FFFFFFFF");
        $sheet
            ->getStyle("A5:{$last}5")
            ->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()
            ->setARGB("FF145D57");
        $sheet
            ->getStyle("A5:{$last}" . ($lastData + 1))
            ->getAlignment()
            ->setVertical("top")
            ->setWrapText(true);
        $sheet->getRowDimension(5)->setRowHeight(32);
        foreach (range(1, $columns) as $column) {
            $sheet->getColumnDimensionByColumn($column)->setWidth(21);
        }
        $sheet->getColumnDimension("C")->setWidth(29);
        $sheet->getColumnDimension("E")->setWidth(29);
        $sheet->freezePane("A6");
        $sheet->setAutoFilter("A5:{$last}" . max(5, $lastData));
        $sheet
            ->getPageSetup()
            ->setOrientation("landscape")
            ->setPaperSize(9)
            ->setFitToWidth(1)
            ->setFitToHeight(0)
            ->setRowsToRepeatAtTopByStartAndEnd(1, 5);
    }
}
