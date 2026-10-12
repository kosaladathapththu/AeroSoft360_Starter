<?php
namespace App\Services\Accounting;

use InvalidArgumentException;

final class JournalValidation
{
    /** @param array<int, array{account_id:int, debit:string, credit:string}> $lines */
    public function validate(array $lines): void
    {
        if (count($lines) < 2) throw new InvalidArgumentException('At least two journal lines are required.');
        $deb=0; $cred=0;
        foreach ($lines as $line) {
            if (!isset($line['account_id'], $line['debit'], $line['credit']) || !is_int($line['account_id']) || $line['account_id'] < 1 || !is_string($line['debit']) || !is_string($line['credit'])) {
                throw new InvalidArgumentException('Each journal line requires a valid account, debit and credit.');
            }
            // Integer 1/10000 units to avoid floating point inaccuracies.
            $d=$this->asScaledInt($line['debit']); $c=$this->asScaledInt($line['credit']);
            if ($d<0 || $c<0 || ($d>0 && $c>0) || ($d===0 && $c===0)) throw new InvalidArgumentException('Each journal line must have exactly one positive side.');
            $deb += $d; $cred += $c;
        }
        if ($deb!==$cred) throw new InvalidArgumentException('Journal debits and credits must balance.');
        if ($deb === 0) throw new InvalidArgumentException('Journal total must be greater than zero.');
    }
    private function asScaledInt(string $amount): int
    {
        if (!preg_match('/^\d+(?:\.\d{1,4})?$/', $amount)) throw new InvalidArgumentException('Invalid decimal amount.');
        [$whole,$fraction] = array_pad(explode('.', $amount, 2),2,'');
        if (strlen($whole)>13) throw new InvalidArgumentException('Amount exceeds safe scaled integer range.');
        return (int)$whole*10000+(int)str_pad($fraction,4,'0');
    }
}
