<?php
namespace Tests\Unit;
use App\Services\Sales\CommissionCalculator;
use DateTimeImmutable;
use Tests\TestCase;

class CommissionCalculatorTest extends TestCase {
 public function test_calculates_proportional_commission_within_one_hundred_days(): void {
  $result=(new CommissionCalculator())->calculate('10000.00','5000.00',10,'50.00',new DateTimeImmutable('2026-01-01'),new DateTimeImmutable('2026-04-01'));
  $this->assertTrue($result['eligible']);
  $this->assertSame('50.00',$result['payment_percentage']);
  $this->assertSame('250.00',$result['final_commission']);
 }
 public function test_late_collection_earns_zero(): void {
  $result=(new CommissionCalculator())->calculate('10000.00','10000.00',10,'50.00',new DateTimeImmutable('2026-01-01'),new DateTimeImmutable('2026-04-12'));
  $this->assertFalse($result['eligible']);
  $this->assertSame('0.00',$result['final_commission']);
 }
}
