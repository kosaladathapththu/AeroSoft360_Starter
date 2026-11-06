<?php
namespace App\Services\Accounting;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use RuntimeException;

/** Import a legacy outstanding-debt schedule without creating sales or moving stock. */
final class ReceivablesImportService
{
    public function read(string $path): array
    {
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $book = $reader->load($path);
        try {
            if ($book->getSheetCount() !== 1) {
                throw new RuntimeException("Expected a single receivables worksheet.");
            }
            $sheet = $book->getSheet(0);
            $headers = [
                "Invoice Number",
                "Invoice Date",
                "Customer Address",
                "Customer Name",
                "Sales Rep Name",
                "Sales Channel",
                "Gross Amount",
                "Other Charges",
                "Discount",
                "Total Amount",
                "Payment Terms / Credit Days",
            ];
            if ($sheet->rangeToArray("A1:K1", null, false, false)[0] !== $headers) {
                throw new RuntimeException("Unexpected spreadsheet headers.");
            }
            $records = [];
            $seen = [];
            foreach (
                $sheet->rangeToArray("A2:K" . $sheet->getHighestDataRow(), null, false, false)
                as $index => $cells
            ) {
                if (!array_filter($cells, fn($value) => $value !== null && $value !== "")) {
                    continue;
                }
                $row = $index + 2;
                foreach (range("A", "K") as $column) {
                    if ($sheet->getCell($column . $row)->isFormula()) {
                        throw new RuntimeException(
                            "Row $row contains a formula; verified values are required.",
                        );
                    }
                }
                [
                    $number,
                    $date,
                    $address,
                    $customer,
                    $rep,
                    $channel,
                    $gross,
                    $charges,
                    $discount,
                    $amount,
                    $days,
                ] = $cells;
                $number = is_numeric($number) ? sprintf("%.0f", $number) : trim((string) $number);
                $customer = trim((string) $customer);
                $rep = trim((string) $rep);
                if (
                    !$number ||
                    !$customer ||
                    !$rep ||
                    !is_numeric($date) ||
                    !is_numeric($amount) ||
                    $amount <= 0
                ) {
                    throw new RuntimeException("Invalid required values on row $row.");
                }
                if (
                    mb_strlen($customer) > 160 ||
                    mb_strlen($rep) > 160 ||
                    mb_strlen((string) $address) > 255
                ) {
                    throw new RuntimeException("Row $row exceeds database field lengths.");
                }
                if (
                    abs((float) $gross + (float) $charges - (float) $discount - (float) $amount) >
                    0.005
                ) {
                    throw new RuntimeException("Amounts do not reconcile on row $row.");
                }
                $days = $days === null || $days === "" ? null : $days;
                if (
                    $days !== null &&
                    (!is_numeric($days) || (int) $days != $days || $days < 0 || $days > 365)
                ) {
                    throw new RuntimeException("Invalid credit days on row $row.");
                }
                $record = [
                    "original_number" => $number,
                    "invoice_date" => Date::excelToDateTimeObject($date)->format("Y-m-d"),
                    "customer" => $customer,
                    "representative" => $rep,
                    "address" => trim((string) $address),
                    "channel" => trim((string) $channel),
                    "amount_cents" => (int) round($amount * 100),
                    "credit_days" => $days === null ? null : (int) $days,
                ];
                $key = hash("sha256", json_encode($record));
                if (isset($seen[$key])) {
                    throw new RuntimeException(
                        "Exact duplicate debts on rows {$seen[$key]} and $row.",
                    );
                }
                $seen[$key] = $row;
                $record["key"] = $key;
                $record["row"] = $row;
                $record["number"] =
                    "AR-" .
                    substr(preg_replace("/[^A-Za-z0-9-]/", "", $number), 0, 18) .
                    "-" .
                    substr($key, 0, 12);
                $records[] = $record;
            }
            if (!$records) {
                throw new RuntimeException("No receivables found.");
            }
            return $records;
        } finally {
            $book->disconnectWorksheets();
        }
    }

    public function import(array $records, string $postingDate, string $sourceHash): array
    {
        return DB::transaction(function () use ($records, $postingDate, $sourceHash) {
            // Serialize imports through the control-account row; never silently replace an existing debt.
            $control = DB::table("accounts")->where("code", "1100")->lockForUpdate()->first();
            $offset = DB::table("accounts")->where("code", "3990")->first();
            if (
                !$control ||
                !$offset ||
                !AccountPolicy::active($control) ||
                !AccountPolicy::active($offset)
            ) {
                throw new RuntimeException("Active AR and opening-equity accounts are required.");
            }
            $result = [
                "created" => 0,
                "skipped" => 0,
                "amount_cents" => 0,
                "invoice_ids" => [],
                "customer_ids" => [],
            ];
            foreach ($records as $record) {
                $prior = DB::table("audit_logs")
                    ->where("event", "receivable.import")
                    ->where("entity_type", "sales_invoice")
                    ->get()
                    ->first(
                        fn($x) => (json_decode($x->payload, true)["row_key"] ?? null) ===
                            $record["key"],
                    );
                if ($prior) {
                    if (!DB::table("sales_invoices")->where("id", $prior->entity_id)->exists()) {
                        throw new RuntimeException(
                            "An imported debt was removed; manual reconciliation is required.",
                        );
                    }
                    $result["skipped"]++;
                    continue;
                }
                if ($record["invoice_date"] > $postingDate) {
                    throw new RuntimeException("Import date cannot precede a source invoice.");
                }
                foreach (
                    DB::table("audit_logs")->where("event", "receivable.import")->get()
                    as $audit
                ) {
                    $saved = json_decode($audit->payload, true)["source_record"] ?? [];
                    if (
                        ($saved["original_number"] ?? null) === $record["original_number"] &&
                        ($saved["customer"] ?? null) === $record["customer"] &&
                        ($saved["invoice_date"] ?? null) === $record["invoice_date"]
                    ) {
                        throw new RuntimeException(
                            "An imported invoice has changed source values. Reconcile it instead of importing a second debt.",
                        );
                    }
                }
                $customer = $this->party("customers", $record["customer"], "AR-C-", [
                    "address" => $record["address"] ?: null,
                    "credit_days" => $record["credit_days"],
                    "credit_limit" => 0,
                ]);
                // Do not assign invented channel or commission terms to imported representatives.
                $rep = $this->party("sales_representatives", $record["representative"], "AR-R-", [
                    "channel" => $record["channel"] ?: "unassigned",
                    "default_commission_rate" => 0,
                ]);
                $amount = $record["amount_cents"] / 100;
                $due =
                    $record["credit_days"] === null
                        ? null
                        : Carbon::parse($record["invoice_date"])
                            ->addDays($record["credit_days"])
                            ->toDateString();
                $id = DB::table("sales_invoices")->insertGetId([
                    "number" => $record["number"],
                    "sales_order_id" => null,
                    "customer_id" => $customer,
                    "sales_rep_id" => $rep,
                    "invoice_date" => $record["invoice_date"],
                    "due_date" => $due,
                    "sale_type" => "credit",
                    "status" => "unpaid",
                    "subtotal" => 0,
                    "discount" => 0,
                    "tax" => 0,
                    "total" => $amount,
                    "received_amount" => 0,
                    "outstanding" => $amount,
                    "is_opening_balance" => true,
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
                $journal = app(PostingService::class)->post(
                    "sales_invoice",
                    $id,
                    $postingDate,
                    "Imported opening receivable / " .
                        $record["original_number"] .
                        " / " .
                        $record["customer"],
                    [
                        ["account_code" => "1100", "debit" => $amount, "credit" => 0],
                        ["account_code" => "3990", "debit" => 0, "credit" => $amount],
                    ],
                );
                DB::table("customer_opening_balances")->insert([
                    "customer_id" => $customer,
                    "amount" => $amount,
                    "balance_date" => $postingDate,
                    "due_date" => $due,
                    "offset_account_id" => $offset->id,
                    "invoice_id" => $id,
                    "receipt_id" => null,
                    "journal_id" => $journal,
                    "created_at" => now(),
                    "updated_at" => now(),
                ]);
                DB::table("audit_logs")->insert([
                    "event" => "receivable.import",
                    "entity_type" => "sales_invoice",
                    "entity_id" => $id,
                    "payload" => json_encode([
                        "source_sha256" => $sourceHash,
                        "row_key" => $record["key"],
                        "source_row" => $record["row"],
                        "original_invoice_number" => $record["original_number"],
                        "source_record" => $record,
                        "posting_date" => $postingDate,
                        "meaning" =>
                            "Remaining unpaid opening receivable; no new sale or stock movement",
                    ]),
                    "created_at" => now(),
                ]);
                $result["created"]++;
                $result["amount_cents"] += $record["amount_cents"];
                $result["invoice_ids"][] = $id;
                $result["customer_ids"][] = $customer;
            }
            $result["customer_ids"] = array_values(array_unique($result["customer_ids"]));
            $ids = $result["invoice_ids"];
            $invoiceCents = (int) round(
                DB::table("sales_invoices")->whereIn("id", $ids)->sum("outstanding") * 100,
            );
            $ledgerCents = (int) round(
                DB::table("journal_lines as l")
                    ->join("journal_entries as j", "j.id", "=", "l.journal_entry_id")
                    ->where("j.source_type", "sales_invoice")
                    ->whereIn("j.source_id", $ids)
                    ->where("l.account_id", $control->id)
                    ->selectRaw("COALESCE(SUM(l.debit - l.credit),0) as balance")
                    ->value("balance") * 100,
            );
            if ($invoiceCents !== $result["amount_cents"] || $ledgerCents !== $invoiceCents) {
                throw new RuntimeException("Imported receivables do not reconcile to the ledger.");
            }
            return $result;
        });
    }

    private function party(string $table, string $name, string $prefix, array $defaults): int
    {
        $matches = DB::table($table)
            ->get()
            ->filter(fn($row) => mb_strtolower(trim($row->name)) === mb_strtolower(trim($name)));
        if ($matches->count() > 1) {
            throw new RuntimeException("Ambiguous customer or representative: $name");
        }
        if ($matches->count()) {
            return (int) $matches->first()->id;
        }
        return DB::table($table)->insertGetId(
            [
                "code" => $prefix . substr(hash("sha256", mb_strtolower($name)), 0, 12),
                "name" => $name,
                "status" => "active",
                "created_at" => now(),
                "updated_at" => now(),
            ] + $defaults,
        );
    }
}
