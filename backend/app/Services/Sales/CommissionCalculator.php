<?php
namespace App\Services\Sales;

use DateTimeImmutable;
use InvalidArgumentException;

final class CommissionCalculator
{
    /** @return array{eligible:bool,days:int,payment_percentage:string,base_commission:string,final_commission:string} */
    public function calculate(
        string $invoiceAmount,
        string $eligibleAllocatedAmount,
        int $quantity,
        string $rate,
        DateTimeImmutable $invoiceDate,
        DateTimeImmutable $eligibilityDate,
        int $eligibilityDays = 100
    ): array {
        $invoice = $this->minorUnits($invoiceAmount);
        $allocated = $this->minorUnits($eligibleAllocatedAmount);
        $rateMinor = $this->minorUnits($rate);
        if ($invoice <= 0 || $quantity <= 0 || $rateMinor < 0 || $allocated < 0 || $allocated > $invoice) {
            throw new InvalidArgumentException('Invalid commission inputs.');
        }
        $days = (int)$invoiceDate->diff($eligibilityDate)->format('%r%a');
        if ($days < 0) throw new InvalidArgumentException('Eligibility date cannot precede invoice date.');
        $eligible = $days <= $eligibilityDays;
        $base = $quantity * $rateMinor;
        $final = $eligible ? intdiv(($base * $allocated) + intdiv($invoice, 2), $invoice) : 0;

        return [
            'eligible' => $eligible,
            'days' => $days,
            'payment_percentage' => number_format(($allocated / $invoice) * 100, 2, '.', ''),
            'base_commission' => $this->decimal($base),
            'final_commission' => $this->decimal($final),
        ];
    }

    private function minorUnits(string $amount): int
    {
        if (!preg_match('/^\d+(?:\.\d{1,2})?$/', $amount)) throw new InvalidArgumentException('Invalid money amount.');
        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');
        if (strlen($whole) > 14) throw new InvalidArgumentException('Money amount is too large.');
        return ((int)$whole * 100) + (int)str_pad($fraction, 2, '0');
    }

    private function decimal(int $minor): string
    {
        return intdiv($minor, 100).'.'.str_pad((string)($minor % 100), 2, '0', STR_PAD_LEFT);
    }
}
