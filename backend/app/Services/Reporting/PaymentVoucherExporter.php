<?php
namespace App\Services\Reporting;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

final class PaymentVoucherExporter
{
    public function make(): Spreadsheet
    {
        return DB::transaction(fn () => $this->build());
    }

    private function build(): Spreadsheet
    {
        $vouchers = DB::table('payment_vouchers as v')
            ->leftJoin('accounts as a', 'a.id', '=', 'v.payment_account_id')
            ->leftJoin('goods_receipts as g', 'g.id', '=', 'v.goods_receipt_id')
            ->leftJoin('journal_entries as j', 'j.id', '=', 'v.journal_id')
            ->leftJoin('journal_entries as r', 'r.id', '=', 'v.reversal_journal_id')
            ->select('v.*', 'a.name as payment_account_name', 'g.number as receipt_number',
                'j.number as journal_number', 'j.status as journal_status',
                'r.number as reversal_number', 'r.status as reversal_status',
                'r.source_type as reversal_type', 'r.source_id as reversal_source_id')
            ->orderBy('v.payment_date')->orderBy('v.id')->get();
        $lines = DB::table('payment_voucher_lines as l')
            ->leftJoin('accounts as a', 'a.id', '=', 'l.account_id')
            ->select('l.*', 'a.code as account_code', 'a.name as account_name')
            ->orderBy('l.id')->get()->groupBy('payment_voucher_id');
        $revisions = Schema::hasTable('payment_voucher_revisions')
            ? DB::table('payment_voucher_revisions')->get() : collect();
        $from = $revisions->keyBy('replacement_voucher_id');
        $to = $revisions->keyBy('original_voucher_id');
        $byId = $vouchers->keyBy('id');
        $journalIds = $vouchers->pluck('journal_id')->merge($vouchers->pluck('reversal_journal_id'))->filter()->unique();
        $ledger = DB::table('journal_lines')->whereIn('journal_entry_id', $journalIds)
            ->get()->groupBy('journal_entry_id');
        $book = new Spreadsheet();
        $book->getProperties()->setTitle('Full payment vouchers report');
        $summary = $book->getActiveSheet()->setTitle('Summary');
        $detail = $book->createSheet()->setTitle('Vouchers');
        $items = $book->createSheet()->setTitle('Payment lines');
        $stamp = now()->timezone('Asia/Colombo')->format('Y-m-d H:i:s');
        foreach ([$summary, $detail, $items] as $sheet) {
            $sheet->setShowGridlines(false);
            $sheet->setCellValue('A1', 'Full payment vouchers report (LKR)');
            $sheet->setCellValue('A2', 'Generated: '.$stamp.' Asia/Colombo. All vouchers; page filters do not apply.');
            $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
        }
        $this->row($detail, 4, ['Voucher', 'Payment date', 'Status', 'Payee', 'Purpose', 'Method',
            'Payment account', 'Original amount', 'Cancelled amount', 'Current voucher amount',
            'Net posted payment', 'Cancellation date', 'Cancellation reason', 'Original journal',
            'Reversal journal', 'Revision of', 'Replaced by', 'Supplier receipt', 'Reference', 'Ledger check']);
        $this->row($items, 4, ['Voucher', 'Payment date', 'Status', 'Account code', 'Account name', 'Description', 'Original line amount']);
        $totals = array_fill_keys(['Posted', 'Cancelled', 'Revised', 'Draft'], [0, 0, 0]);
        $row = 5;
        $lineRow = 5;
        foreach ($vouchers as $v) {
            $status = $v->status === 'void' ? ($to->has($v->id) ? 'Revised' : 'Cancelled') : ucfirst($v->status);
            $amount = (float) $v->total;
            $cancelled = $v->status === 'void' ? $amount : 0;
            $net = $v->status === 'posted' ? $amount : 0;
            $totals[$status][0]++;
            $totals[$status][1] += (int) round($amount * 100);
            $totals[$status][2] += (int) round($net * 100);
            $check = $this->ledgerCheck($v, $ledger);
            $this->row($detail, $row, [$v->number, $this->date($v->payment_date), $status, $v->payee,
                $v->description, str_replace('_', ' ', $v->payment_method), $v->payment_account_name,
                $amount, $cancelled, $amount - $cancelled, $net, $this->date($v->void_date),
                $v->void_reason, $v->journal_number, $v->reversal_number,
                $byId->get($from->get($v->id)?->original_voucher_id)?->number,
                $byId->get($to->get($v->id)?->replacement_voucher_id)?->number,
                $v->receipt_number, $v->reference, $check]);
            foreach ($lines->get($v->id, collect()) as $line) {
                $this->row($items, $lineRow++, [$v->number, $this->date($v->payment_date), $status,
                    $line->account_code, $line->account_name, $line->description, (float) $line->amount]);
            }
            $row++;
        }
        $this->row($summary, 4, ['Status', 'Vouchers', 'Original amounts (LKR)', 'Net posted payments (LKR)']);
        $s = 5;
        foreach ($totals as $status => $values) {
            $this->row($summary, $s++, [$status, $values[0], $values[1] / 100, $values[2] / 100]);
        }
        $this->row($summary, 9, ['Total', $vouchers->count(), array_sum(array_column($totals, 1)) / 100,
            array_sum(array_column($totals, 2)) / 100]);
        $summary->setCellValue('A12', 'Net posted payments exclude cancelled/revised vouchers and unposted drafts.');
        $summary->setCellValue('A13', 'Current voucher amounts include drafts. Cancellation reverses accounting on the cancellation date.');
        $summary->setCellValue('A14', 'Payment lines retain original amounts for history, including cancelled vouchers.');
        $summary->setCellValue('A15', 'Earlier dated reports can include payments until their cancellation date.');
        $this->format($summary, 'D', 9);
        $this->format($detail, 'T', $row - 1);
        $this->format($items, 'G', $lineRow - 1);
        $summary->getStyle('C5:D9')->getNumberFormat()->setFormatCode('#,##0.00');
        $summary->getStyle('A9:D9')->getFont()->setBold(true);
        $summary->getColumnDimension('C')->setWidth(26);
        $summary->getColumnDimension('D')->setWidth(29);
        $detail->getStyle('H5:K'.max(5, $row - 1))->getNumberFormat()->setFormatCode('#,##0.00');
        foreach (['B', 'L'] as $column) $detail->getStyle($column.'5:'.$column.max(5, $row - 1))->getNumberFormat()->setFormatCode('yyyy-mm-dd');
        $items->getStyle('B5:B'.max(5, $lineRow - 1))->getNumberFormat()->setFormatCode('yyyy-mm-dd');
        $items->getStyle('G5:G'.max(5, $lineRow - 1))->getNumberFormat()->setFormatCode('#,##0.00');
        foreach (['D', 'E', 'M'] as $column) $detail->getColumnDimension($column)->setWidth(38);
        foreach (['E', 'F'] as $column) $items->getColumnDimension($column)->setWidth(38);
        $book->setActiveSheetIndex(0);
        return $book;
    }

    private function ledgerCheck(object $v, $ledger): string
    {
        if (!$v->journal_id) return $v->status === 'posted' ? 'CHECK REQUIRED' : 'Not posted';
        $original = $ledger->get($v->journal_id, collect());
        if ($v->status !== 'void') return $v->journal_status === 'posted' && $original->isNotEmpty() ? 'Posted' : 'CHECK REQUIRED';
        $reversal = $ledger->get($v->reversal_journal_id, collect());
        if ($v->journal_status !== 'posted' || $v->reversal_status !== 'posted' ||
            $v->reversal_type !== 'payment_voucher_reversal' || (int) $v->reversal_source_id !== (int) $v->id ||
            $original->isEmpty() || $reversal->isEmpty()) return 'CHECK REQUIRED';
        $net = [];
        foreach ($original->merge($reversal) as $line) {
            $net[$line->account_id] = ($net[$line->account_id] ?? 0) +
                (int) round((float) $line->debit * 100) - (int) round((float) $line->credit * 100);
        }
        return count(array_filter($net, fn ($amount) => $amount !== 0)) ? 'CHECK REQUIRED' : 'Reversed to zero';
    }

    private function date(?string $date): ?float
    {
        return $date ? Date::PHPToExcel(new \DateTimeImmutable($date)) : null;
    }

    private function row(Worksheet $sheet, int $row, array $values): void
    {
        foreach ($values as $i => $value) {
            $sheet->setCellValueExplicitByColumnAndRow($i + 1, $row, $value ?? '',
                is_int($value) || is_float($value) ? DataType::TYPE_NUMERIC : DataType::TYPE_STRING);
        }
    }

    private function format(Worksheet $sheet, string $end, int $last): void
    {
        $sheet->getStyle('A4:'.$end.'4')->getFill()->setFillType('solid')->getStartColor()->setARGB('FF203D50');
        $sheet->getStyle('A4:'.$end.'4')->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
        $sheet->getStyle('A4:'.$end.max(4, $last))->getAlignment()->setWrapText(true)->setVertical('center');
        $sheet->getRowDimension(4)->setRowHeight(36);
        foreach (range(5, max(5, $last)) as $row) $sheet->getRowDimension($row)->setRowHeight(42);
        foreach (range('A', $end) as $column) $sheet->getColumnDimension($column)->setWidth(24);
        $sheet->freezePane('C5');
        $sheet->setAutoFilter('A4:'.$end.max(4, $last));
    }
}
