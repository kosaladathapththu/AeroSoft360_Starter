<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class ReceivableController
{
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            "reason" => "required|string|max:1000",
            "invoice_date" => "required|date",
            "due_date" => "nullable|date|after_or_equal:invoice_date",
            "total" => "required|numeric|min:0.01",
        ]);
        abort_if(
            trim($data["reason"]) === "",
            422,
            "Enter a reason for this change.",
        );
        return DB::transaction(function () use ($request, $id, $data) {
            [$invoice, $opening, $journal, $lines] = $this->editable($id);
            $amount = round((float) $data["total"], 2);
            abort_if(
                !$opening && $data["invoice_date"] !== $invoice->invoice_date,
                422,
                "Change the sales invoice date from Invoices.",
            );
            abort_if(
                !$opening && abs($amount - $invoice->total) > 0.001,
                422,
                "Change sales quantities and rates from Invoices. Aging only changes invoice dates for sales invoices.",
            );
            if ($opening) {
                abort_if(
                    $data["invoice_date"] > $opening->balance_date,
                    422,
                    "The invoice date cannot be after the opening posting date.",
                );
                foreach ($lines as $line) {
                    DB::table("journal_lines")
                        ->where("id", $line->id)
                        ->update([
                            "debit" => (float) $line->debit > 0 ? $amount : 0,
                            "credit" => (float) $line->credit > 0 ? $amount : 0,
                            "updated_at" => now(),
                        ]);
                }
                DB::table("customer_opening_balances")
                    ->where("id", $opening->id)
                    ->update([
                        "amount" => $amount,
                        "due_date" => $data["due_date"] ?? null,
                        "updated_at" => now(),
                    ]);
            }
            $changes = [
                "invoice_date" => $data["invoice_date"],
                "due_date" => $data["due_date"] ?? null,
                "total" => $amount,
                "outstanding" => $amount,
                "updated_at" => now(),
            ];
            DB::table("sales_invoices")->where("id", $id)->update($changes);
            $this->audit(
                $request,
                "receivable.update",
                $invoice,
                $opening,
                $journal,
                $lines,
                $changes,
            );
            return response()->json(["message" => "Receivable updated."]);
        });
    }

    public function destroy(Request $request, int $id)
    {
        $request->validate(["reason" => "required|string|max:1000"]);
        abort_if(
            trim($request->input("reason")) === "",
            422,
            "Enter a reason for deletion.",
        );
        return DB::transaction(function () use ($request, $id) {
            [$invoice, $opening, $journal, $lines] = $this->editable($id);
            $this->audit(
                $request,
                "receivable.delete",
                $invoice,
                $opening,
                $journal,
                $lines,
                [],
            );
            if (!$opening) {
                return app(AccountingSalesController::class)->deleteInvoice(
                    $id,
                );
            }
            // Only unallocated openings in an open period can be removed. The audit
            // retains the original invoice, opening record and full journal image.
            DB::table("customer_opening_balances")
                ->where("id", $opening->id)
                ->delete();
            DB::table("journal_lines")
                ->where("journal_entry_id", $journal->id)
                ->delete();
            DB::table("journal_entries")->where("id", $journal->id)->delete();
            DB::table("sales_invoices")->where("id", $id)->delete();
            return response()->json([
                "message" => "Receivable and its opening posting deleted.",
            ]);
        });
    }

    private function editable(int $id): array
    {
        $invoice = DB::table("sales_invoices")
            ->where("id", $id)
            ->lockForUpdate()
            ->first();
        abort_unless($invoice, 404, "Receivable not found.");
        abort_if(
            in_array($invoice->status, ["void", "cancelled"]),
            422,
            "This invoice is cancelled.",
        );
        abort_if(
            DB::table("receipt_allocations")
                ->where("invoice_id", $id)
                ->exists() ||
                DB::table("sales_returns")
                    ->where("sales_invoice_id", $id)
                    ->exists() ||
                (float) $invoice->received_amount > 0,
            422,
            "This receivable has collections or returns. Resolve those linked records before editing or deleting.",
        );
        $journal = DB::table("journal_entries")
            ->where("source_type", "sales_invoice")
            ->where("source_id", $id)
            ->lockForUpdate()
            ->first();
        abort_unless(
            $journal && $journal->status === "posted",
            422,
            "A posted invoice journal is required.",
        );
        $period = DB::table("accounting_periods")
            ->where("id", $journal->accounting_period_id)
            ->lockForUpdate()
            ->first();
        abort_unless(
            $period && $period->status === "open",
            422,
            "The original accounting period is closed.",
        );
        $opening = DB::table("customer_opening_balances")
            ->where("invoice_id", $id)
            ->lockForUpdate()
            ->first();
        abort_if(
            (bool) $invoice->is_opening_balance !== (bool) $opening,
            422,
            "The opening balance link needs review.",
        );
        $lines = DB::table("journal_lines")
            ->where("journal_entry_id", $journal->id)
            ->get();
        if ($opening) {
            $ar = DB::table("accounts")->where("code", "1100")->value("id");
            abort_unless(
                $opening->journal_id == $journal->id &&
                    $lines->count() === 2 &&
                    $lines->contains(
                        fn($l) => $l->account_id == $ar &&
                            abs($l->debit - $invoice->total) < 0.001 &&
                            (float) $l->credit === 0.0,
                    ) &&
                    $lines->contains(
                        fn($l) => $l->account_id ==
                            $opening->offset_account_id &&
                            abs($l->credit - $invoice->total) < 0.001 &&
                            (float) $l->debit === 0.0,
                    ),
                422,
                "The opening journal does not match this receivable; review it before changing.",
            );
        }
        return [$invoice, $opening, $journal, $lines];
    }

    private function audit(
        Request $request,
        string $event,
        $invoice,
        $opening,
        $journal,
        $lines,
        array $changes,
    ): void {
        DB::table("audit_logs")->insert([
            "event" => $event,
            "entity_type" => "sales_invoice",
            "entity_id" => $invoice->id,
            "payload" => json_encode([
                "reason" => trim($request->input("reason")),
                "actor_id" =>
                    $request->attributes->get("auth_user")->id ?? null,
                "before" => $invoice,
                "opening" => $opening,
                "journal" => $journal,
                "journal_lines" => $lines,
                "changes" => $changes,
            ]),
            "created_at" => now(),
        ]);
    }
}
