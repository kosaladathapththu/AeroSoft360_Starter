<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Accounting\PostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class JournalController extends Controller
{
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

    public function destroy(int $journal): JsonResponse
    {
        $entry = DB::table("journal_entries")->find($journal);
        abort_unless($entry, 404, "Journal not found.");
        abort_unless(
            $entry->source_type === "manual_journal",
            422,
            "System-generated journals cannot be deleted. Reverse the source transaction instead.",
        );
        DB::table("journal_entries")->where("id", $journal)->delete();
        return response()->json(["message" => "Manual journal deleted."]);
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
