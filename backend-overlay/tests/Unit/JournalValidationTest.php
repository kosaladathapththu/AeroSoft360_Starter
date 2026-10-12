<?php
namespace Tests\Unit;
use App\Services\Accounting\JournalValidation;
use InvalidArgumentException;
use Tests\TestCase;
class JournalValidationTest extends TestCase {
 public function test_accepts_balanced_entry(): void { (new JournalValidation())->validate([['account_id'=>1,'debit'=>'100.00','credit'=>'0'],['account_id'=>2,'debit'=>'0','credit'=>'100.00']]);$this->assertTrue(true); }
 public function test_rejects_unbalanced_entry(): void {$this->expectException(InvalidArgumentException::class);(new JournalValidation())->validate([['account_id'=>1,'debit'=>'100.00','credit'=>'0'],['account_id'=>2,'debit'=>'0','credit'=>'99.99']]);}
}
