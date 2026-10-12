<?php
namespace Tests\Unit;
use App\Services\Sales\SetExpansion;
use Tests\TestCase;

class SetExpansionTest extends TestCase {
 public function test_expands_configured_variants_without_assuming_size_labels(): void {
  $components=array_map(fn($id)=>['variant_id'=>$id,'quantity'=>2],range(11,15));
  $result=(new SetExpansion())->expand(3,$components);
  $this->assertSame([6,6,6,6,6],array_column($result,'quantity'));
  $this->assertSame(30,array_sum(array_column($result,'quantity')));
 }
}
