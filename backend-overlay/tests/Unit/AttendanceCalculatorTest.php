<?php
namespace Tests\Unit;
use App\Services\Payroll\AttendanceCalculator;
use DateTimeImmutable;
use Tests\TestCase;

class AttendanceCalculatorTest extends TestCase {
 public function test_weekday_rules_match_confirmed_workbook_defaults(): void {
  $result=(new AttendanceCalculator())->calculate(new DateTimeImmutable('2026-07-06'),'08:15','18:00');
  $this->assertSame(15,$result['late_minutes']);
  $this->assertSame(60,$result['single_ot_minutes']);
  $this->assertSame(0,$result['double_ot_minutes']);
  $this->assertSame('0.00',$result['morning_incentive']);
 }
 public function test_sunday_work_is_double_overtime(): void {
  $result=(new AttendanceCalculator())->calculate(new DateTimeImmutable('2026-07-05'),'08:00','12:00');
  $this->assertSame(0,$result['single_ot_minutes']);
  $this->assertSame(240,$result['double_ot_minutes']);
 }
}
