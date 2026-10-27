<?php
namespace App\Http\Controllers\Api;

use App\Services\Reporting\CustomerPoExporter;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

final class CustomerPoExportController
{
    public function download(CustomerPoExporter $exporter, ?int $id = null)
    {
        $book = $exporter->make($id);
        $name = $id === null ? 'All_Customer_POs' : preg_replace('/[^A-Za-z0-9_-]/', '_', $book->getProperties()->getTitle());
        return response()->streamDownload(function () use ($book) {
            try { (new Xlsx($book))->save('php://output'); }
            finally { $book->disconnectWorksheets(); }
        }, $name.'.xlsx', ['Content-Type'=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control'=>'no-store']);
    }
}
