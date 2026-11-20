<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable("payment_voucher_revisions")) {
            Schema::create("payment_voucher_revisions", function (Blueprint $t) {
                $t->id();
                $t->foreignId("original_voucher_id")->constrained("payment_vouchers");
                $t->foreignId("replacement_voucher_id")
                    ->nullable()
                    ->unique()
                    ->constrained("payment_vouchers")
                    ->nullOnDelete();
                $t->date("revision_date");
                $t->string("reason", 500);
                $t->foreignId("reversal_journal_id")->nullable()->constrained("journal_entries");
                $t->unsignedBigInteger("created_by")->nullable();
                $t->timestamps();
                $t->index(["original_voucher_id", "revision_date"], "pvr_original_date_idx");
            });
        }

        if (!$this->hasRevisionIndex()) {
            Schema::table("payment_voucher_revisions", function (Blueprint $t) {
                $t->index(["original_voucher_id", "revision_date"], "pvr_original_date_idx");
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists("payment_voucher_revisions");
    }

    private function hasRevisionIndex(): bool
    {
        if (DB::getDriverName() === "mysql") {
            $index = DB::selectOne(
                "SELECT COUNT(*) AS aggregate FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
                ["payment_voucher_revisions", "pvr_original_date_idx"],
            );
            return (int) $index->aggregate > 0;
        }

        if (DB::getDriverName() === "sqlite") {
            return collect(DB::select("PRAGMA index_list('payment_voucher_revisions')"))->contains(
                fn($index) => $index->name === "pvr_original_date_idx",
            );
        }

        throw new RuntimeException("Payment voucher revision migration supports MySQL and SQLite.");
    }
};
