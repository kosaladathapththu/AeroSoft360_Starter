<?php
namespace App\Console\Commands;
use App\Services\Accounting\ReceivablesImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

final class ImportReceivables extends Command
{
    protected $signature = "receivables:import {file} {--posting-date=} {--commit : Post the validated unpaid opening balances}";
    protected $description = "Preview or import a legacy unpaid receivables workbook with an audit trail";
    public function handle(ReceivablesImportService $service): int
    {
        $path = realpath($this->argument("file"));
        if (!$path || !is_file($path)) {
            $this->error("Workbook not found.");
            return 1;
        }
        $records = $service->read($path);
        $summary = [
            "rows" => count($records),
            "customers" => count(array_unique(array_column($records, "customer"))),
            "amount" => array_sum(array_column($records, "amount_cents")) / 100,
            "missing_credit_days" => count(
                array_filter($records, fn($x) => $x["credit_days"] === null),
            ),
            "invoice_date_from" => min(array_column($records, "invoice_date")),
            "invoice_date_to" => max(array_column($records, "invoice_date")),
            "source_sha256" => hash_file("sha256", $path),
        ];
        $this->line(json_encode($summary, JSON_PRETTY_PRINT));
        if (!$this->option("commit")) {
            $this->info("Preview only. No database changes.");
            return 0;
        }
        $date = $this->option("posting-date");
        if (
            !$date ||
            !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ||
            date("Y-m-d", strtotime($date)) !== $date
        ) {
            $this->error("A valid explicit --posting-date=YYYY-MM-DD is required.");
            return 1;
        }
        $period = DB::table("accounting_periods")
            ->where("starts_on", "<=", $date)
            ->where("ends_on", ">=", $date)
            ->where("status", "open")
            ->exists();
        if (!$period) {
            $this->error("The posting date must fall in an existing open accounting period.");
            return 1;
        }
        $dir = storage_path("app/ar-import/" . date("Ymd-His") . "-" . bin2hex(random_bytes(3)));
        File::makeDirectory($dir, 0700, true);
        // Retain a private source copy and the affected tables before the append-only transaction.
        File::copy($path, $dir . "/source.xlsx");
        $before = [];
        foreach (
            [
                "customers",
                "sales_representatives",
                "sales_invoices",
                "customer_opening_balances",
                "journal_entries",
                "journal_lines",
                "audit_logs",
            ]
            as $table
        ) {
            $before[$table] = DB::table($table)->get();
        }
        File::put($dir . "/before.json", json_encode($before, JSON_PRETTY_PRINT));
        $result = $service->import($records, $date, $summary["source_sha256"]);
        File::put(
            $dir . "/result.json",
            json_encode(
                ["source" => $summary, "posting_date" => $date, "result" => $result],
                JSON_PRETTY_PRINT,
            ),
        );
        $this->line(
            json_encode(
                array_diff_key($result, ["invoice_ids" => true, "customer_ids" => true]),
                JSON_PRETTY_PRINT,
            ),
        );
        $this->info("Reconciled import completed. Private recovery files: " . $dir);
        return 0;
    }
}
