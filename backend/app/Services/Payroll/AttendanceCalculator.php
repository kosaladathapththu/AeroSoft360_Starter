<?php
namespace App\Services\Payroll;

use DateTimeImmutable;
use InvalidArgumentException;

final class AttendanceCalculator
{
    /**
     * Confirmed defaults from the July 2026 workbook remain parameters so HR can approve replacements.
     * @return array{worked_minutes:int,late_minutes:int,single_ot_minutes:int,double_ot_minutes:int,morning_incentive:string}
     */
    public function calculate(
        DateTimeImmutable $workDate,
        string $inTime,
        string $outTime,
        string $weekdayStart = '08:00',
        string $weekdayOtStart = '17:00',
        string $saturdayOtStart = '13:45',
        string $morningIncentive = '200.00'
    ): array {
        $in = $this->minutes($inTime);
        $out = $this->minutes($outTime);
        if ($out < $in) $out += 24 * 60;
        if ($out - $in > 24 * 60) throw new InvalidArgumentException('Attendance duration cannot exceed 24 hours.');

        $day = (int)$workDate->format('N');
        $worked = $out - $in;
        $late = $day === 7 ? 0 : max(0, $in - $this->minutes($weekdayStart));
        $singleOt = 0;
        $doubleOt = 0;
        if ($day === 7) $doubleOt = $worked;
        elseif ($day === 6) $singleOt = max(0, $out - $this->minutes($saturdayOtStart));
        else $singleOt = max(0, $out - $this->minutes($weekdayOtStart));

        return [
            'worked_minutes' => $worked,
            'late_minutes' => $late,
            'single_ot_minutes' => $singleOt,
            'double_ot_minutes' => $doubleOt,
            'morning_incentive' => $day !== 7 && $in <= $this->minutes($weekdayStart) ? $morningIncentive : '0.00',
        ];
    }

    private function minutes(string $time): int
    {
        if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time)) throw new InvalidArgumentException('Time must use HH:MM format.');
        [$hours, $minutes] = array_map('intval', explode(':', $time));
        return ($hours * 60) + $minutes;
    }
}
