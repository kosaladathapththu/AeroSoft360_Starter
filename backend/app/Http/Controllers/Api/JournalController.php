<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class JournalController extends Controller
{
    public function reverse(Request $request, int $journal, PostingService $posting): JsonResponse
    {
        $data = $request->validate([
            'posting_date' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:160'],
        ]);
        abort_if(trim($data['reason']) === '', 422, 'Enter a reversal reason.');
        return DB::transaction(function () use ($request, $journal, $posting, $data) {
            $entry = DB::table('journal_entries')->lockForUpdate()->find($journal);
            abort_unless($entry, 404, 'Journal not found.');
            abort_unless(in_array($entry->source_type, ['manual_journal', 'account_opening'], true), 422,
                'Reverse the source transaction for this system-generated journal.');
            abort_unless($entry->status === 'posted', 422, 'Only posted journals can be reversed.');
            abort_if($data['posting_date'] < $entry->posting_date, 422, 'Reversal date cannot precede the original journal.');
            $existing = DB::table('journal_entries')->where('source_type', 'journal_reversal')->where('source_id', $journal)->value('id');
            if ($existing) return response()->json($this->journal((int) $existing));
            $lines = DB::table('journal_lines as l')->join('accounts as a', 'a.id', '=', 'l.account_id')
                ->where('l.journal_entry_id', $journal)->select('a.code as account_code', 'l.debit', 'l.credit')->get()
                ->map(fn ($line) => ['account_code' => $line->account_code, 'debit' => $line->credit, 'credit' => $line->debit])->all();
            $id = $posting->post('journal_reversal', $journal, $data['posting_date'],
                "Reversal of {$entry->number}: " . trim($data['reason']), $lines);
            DB::table('audit_logs')->insert([
                'event' => 'journal.reversed', 'entity_type' => 'journal', 'entity_id' => $journal,
                'payload' => json_encode(['reversal_id' => $id, 'reason' => $data['reason'], 'user_id' => $request->attributes->get('auth_user')?->id]),
                'created_at' => now(),
            ]);
            return response()->json($this->journal($id), 201);
        });
    }

    public function store(Request $request, PostingService $posting): JsonResponse
    {
        $data = $request->validate([
            "posting_date" => ["required", "date"],
            "description" => ["required", "string", "max:255"],
            "lines" => ["required", "array", "min:2"],
            "lines.*.account_code" => ["required", "string", "exists:accounts,code"],
            "lines.*.debit" => ["nullable", "numeric", "gte:0"],
            "lines.*.credit" => ["nullable", "numeric", "gte:0"],
            "lines.*.description" => ["nullable", "string", "max:255"],
        ]);
        foreach ($data['lines'] as $index => $line) {
            $debit = (float) ($line['debit'] ?? 0);
            $credit = (float) ($line['credit'] ?? 0);
            if (($debit > 0) === ($credit > 0) ||
                abs($debit * 100 - round($debit * 100)) > 0.00001 ||
                abs($credit * 100 - round($credit * 100)) > 0.00001) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    "lines.$index" => 'Enter either a debit or a credit with at most two decimal places on each line.',
                ]);
            }
        }
        return DB::transaction(function () use ($data, $posting) {
            $sourceId =
                (int) DB::table("journal_entries")
                    ->where("source_type", "manual_journal")
                    ->max("source_id") + 1;
            $id = $posting->post(
                "manual_journal",
                $sourceId,
                $data["posting_date"],
                $data["description"],
                $data["lines"],
            );
            DB::table("audit_logs")->insert([
                "event" => "manual_journal.posted",
                "entity_type" => "journal",
                "entity_id" => $id,
                "payload" => json_encode(["description" => $data["description"]]),
                "created_at" => now(),
            ]);
            return response()->json($this->journal($id), 201);
        });
    }

    public function update(Request $request, int $journal): JsonResponse
    {
        $entry = DB::table("journal_entries")->find($journal);
        abort_unless($entry, 404, "Journal not found.");
        abort_if(DB::table('journal_entries')->where('source_type', 'journal_reversal')->where('source_id', $journal)->exists(), 422, 'A reversed journal cannot be edited.');
        abort_unless(
            $entry->source_type === "manual_journal",
            422,
            "System-generated journals cannot be edited. Reverse the source transaction instead.",
        );
        $data = $request->validate(["description" => ["required", "string", "max:255"]]);
        DB::table("journal_entries")
            ->where("id", $journal)
            ->update($data + ["updated_at" => now()]);
        return response()->json($this->journal($journal));
    }

    public function destroy(Request $request, int $journal): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        abort_if(trim($data['reason']) === '', 422, 'Enter a deletion reason.');
        return DB::transaction(function () use ($request, $journal, $data) {
            $selected = DB::table('journal_entries')->find($journal);
            abort_unless($selected, 404, 'Journal not found.');
            $originalId = $selected->source_type === 'journal_reversal' ? (int) $selected->source_id : $journal;
            $original = DB::table('journal_entries')->lockForUpdate()->find($originalId);
            abort_unless($original, 422, 'Original journal is missing.');
            abort_unless(in_array($original->source_type, ['manual_journal', 'account_opening'], true), 422,
                'This journal belongs to a source transaction. Delete or cancel that transaction in its own module.');
            $entries = DB::table('journal_entries')->where('id', $originalId)
                ->orWhere(fn ($query) => $query->where('source_type', 'journal_reversal')->where('source_id', $originalId))
                ->orderBy('id')->lockForUpdate()->get();
            $ids = $entries->pluck('id')->all();
            $closedPeriod = DB::table('accounting_periods')->whereIn('id', $entries->pluck('accounting_period_id'))
                ->where('status', '<>', 'open')->exists();
            abort_if($closedPeriod, 422, 'A journal in a closed accounting period cannot be deleted.');
            $lines = DB::table('journal_lines')->whereIn('journal_entry_id', $ids)->get();
            DB::table('audit_logs')->insert([
                'event' => 'journal.deleted', 'entity_type' => 'journal', 'entity_id' => $originalId,
                'payload' => json_encode(['reason' => trim($data['reason']), 'user_id' => $request->attributes->get('auth_user')?->id,
                    'entries' => $entries, 'lines' => $lines]),
                'created_at' => now(),
            ]);
            DB::table('journal_lines')->whereIn('journal_entry_id', $ids)->delete();
            DB::table('journal_entries')->whereIn('id', $ids)->delete();
            return response()->json(['message' => 'Journal and linked reversal deleted. Reports will recalculate from remaining entries.', 'deleted_ids' => $ids]);
        });
    }

    private function journal(int $id): object
    {
        $journal = DB::table("journal_entries")->find($id);
        $journal->lines = DB::table("journal_lines as line")
            ->join("accounts as account", "account.id", "=", "line.account_id")
            ->where("line.journal_entry_id", $id)
            ->select("line.*", "account.code as account_code", "account.name as account_name")
            ->get();
        return $journal;
    }
}
