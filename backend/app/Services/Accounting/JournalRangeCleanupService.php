<?php
namespace App\Services\Accounting;

use Illuminate\Support\Facades\DB;

final class JournalRangeCleanupService
{
    public function run(bool $apply = false): array
    {
        return DB::transaction(function () use ($apply) {
            $numbers = array_map(fn ($n) => 'JV-2611-' . str_pad((string) $n, 4, '0', STR_PAD_LEFT), range(354, 367));
            $entries = DB::table('journal_entries')->whereIn('number', $numbers)->orderBy('id')->lockForUpdate()->get();
            if ($entries->count() !== 14) throw new \RuntimeException('Expected all 14 journals from JV-2611-0354 through JV-2611-0367. Nothing deleted.');
            $ids = $entries->pluck('id')->all();
            $expected = ['account_opening', 'manual_journal', 'manual_journal', 'manual_journal', 'payment_voucher', 'journal_reversal', 'payment_voucher', 'payment_voucher_reversal', 'payment_voucher_reversal', 'payment_voucher', 'payment_voucher', 'journal_reversal', 'manual_journal', 'journal_reversal'];
            foreach ($entries as $entry) {
                $index = array_search($entry->number, $numbers, true);
                if ($entry->source_type !== $expected[$index]) throw new \RuntimeException("Unexpected source for {$entry->number}. Nothing deleted.");
                if ($entry->source_type === 'journal_reversal' && !in_array((int) $entry->source_id, $ids))
                    throw new \RuntimeException('Reversal original is outside the authorized range.');
            }
            if (DB::table('journal_entries')->where('source_type', 'journal_reversal')->whereIn('source_id', $ids)->whereNotIn('id', $ids)->exists())
                throw new \RuntimeException('An additional reversal exists outside the authorized range.');
            if (DB::table('accounting_periods')->whereIn('id', $entries->pluck('accounting_period_id'))->where('status', '<>', 'open')->exists())
                throw new \RuntimeException('A selected accounting period is closed. Nothing deleted.');
            $voucherIds = $entries->whereIn('source_type', ['payment_voucher', 'payment_voucher_reversal'])->pluck('source_id')->unique()->values()->all();
            $vouchers = DB::table('payment_vouchers')->whereIn('id', $voucherIds)->orderBy('id')->lockForUpdate()->get();
            if ($vouchers->count() !== 4) throw new \RuntimeException('Expected four linked payment vouchers. Nothing deleted.');
            foreach ($vouchers as $voucher) {
                if ($voucher->kind !== 'expense' || $voucher->goods_receipt_id !== null ||
                    !in_array((int) $voucher->journal_id, $ids) ||
                    ($voucher->reversal_journal_id && !in_array((int) $voucher->reversal_journal_id, $ids)))
                    throw new \RuntimeException('A voucher has unexpected dependencies. Nothing deleted.');
            }
            $snapshot = [
                'reason' => 'User requested removal of JV-2611-0354 through JV-2611-0367 and linked payment vouchers before re-entry.',
                'actor' => 'cPanel CLI account owner', 'captured_at' => now()->toIso8601String(),
                'journal_entries' => $entries,
                'journal_lines' => DB::table('journal_lines')->whereIn('journal_entry_id', $ids)->get(),
                'payment_vouchers' => $vouchers,
                'payment_voucher_lines' => DB::table('payment_voucher_lines')->whereIn('payment_voucher_id', $voucherIds)->get(),
            ];
            $result = ['journals' => $entries->pluck('number')->all(), 'payment_vouchers' => $vouchers->pluck('number')->all(),
                'journal_lines' => $snapshot['journal_lines']->count(), 'applied' => false];
            if (!$apply) return $result;
            // Keep a recoverable snapshot outside the public website before deleting.
            $folder = storage_path('app/private/journal-cleanup');
            if (!is_dir($folder) && !mkdir($folder, 0700, true) && !is_dir($folder)) throw new \RuntimeException('Cannot create snapshot directory.');
            $file = $folder . '/0354-0367-' . now()->format('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json';
            $json = json_encode($snapshot, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
            if (file_put_contents($file, $json, LOCK_EX) === false) throw new \RuntimeException('Cannot save snapshot. Nothing deleted.');
            chmod($file, 0600);
            DB::table('audit_logs')->insert(['event' => 'journal.range_deleted', 'entity_type' => 'journal_cleanup', 'entity_id' => (int) $entries->first()->id,
                'payload' => $json, 'created_at' => now()]);
            DB::table('payment_voucher_lines')->whereIn('payment_voucher_id', $voucherIds)->delete();
            DB::table('payment_vouchers')->whereIn('id', $voucherIds)->delete();
            DB::table('journal_lines')->whereIn('journal_entry_id', $ids)->delete();
            DB::table('journal_entries')->whereIn('id', $ids)->delete();
            return array_merge($result, ['applied' => true, 'snapshot' => $file]);
        });
    }
}
