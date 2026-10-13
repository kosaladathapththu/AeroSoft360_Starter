<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class ProcureToStockTest extends TestCase
{
 use RefreshDatabase;
 protected function setUp():void {parent::setUp();$this->seed(DatabaseSeeder::class);}
 public function test_approved_po_can_be_partially_received_into_batch_stock_and_balanced_ledger():void {
  $supplier=$this->postJson('/api/v1/suppliers',['code'=>'SUP-001','name'=>'Lanka Polymer','payment_days'=>30])->assertCreated()->json('id');
  $material=DB::table('materials')->value('id');
  $order=$this->postJson('/api/v1/purchase-orders',['supplier_id'=>$supplier,'order_date'=>'2026-10-13','lines'=>[['material_id'=>$material,'quantity'=>100,'unit_cost'=>250]]])->assertCreated()->json('id');
  $this->postJson("/api/v1/purchase-orders/$order/approve")->assertOk(); $line=DB::table('purchase_order_lines')->value('id');
  $response=$this->postJson("/api/v1/purchase-orders/$order/receive",['received_on'=>'2026-10-13','lines'=>[['purchase_order_line_id'=>$line,'quantity'=>40,'batch_number'=>'RM-261013-A']]])->assertCreated();
  $this->assertSame(10000.0,(float)$response->json('total'));$this->assertDatabaseHas('purchase_orders',['id'=>$order,'status'=>'part_received']);$this->assertDatabaseHas('stock_balances',['material_id'=>$material,'batch_number'=>'RM-261013-A','quantity'=>40]);
  $journal=DB::table('journal_entries')->where('source_type','goods_receipt')->first();$this->assertNotNull($journal);$this->assertEquals(10000,(float)DB::table('journal_lines')->where('journal_entry_id',$journal->id)->sum('debit'));$this->assertEquals(10000,(float)DB::table('journal_lines')->where('journal_entry_id',$journal->id)->sum('credit'));
 }
 public function test_receipt_rejects_quantity_above_po_balance():void {
  $supplier=DB::table('suppliers')->insertGetId(['code'=>'SUP-X','name'=>'Supplier X','payment_days'=>30,'status'=>'active','created_at'=>now(),'updated_at'=>now()]);$material=DB::table('materials')->value('id');$order=DB::table('purchase_orders')->insertGetId(['number'=>'PO-X','supplier_id'=>$supplier,'order_date'=>'2026-10-13','status'=>'approved','total'=>250,'approved_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);$line=DB::table('purchase_order_lines')->insertGetId(['purchase_order_id'=>$order,'material_id'=>$material,'quantity'=>1,'received_quantity'=>0,'unit_cost'=>250,'line_total'=>250,'created_at'=>now(),'updated_at'=>now()]);
  $this->postJson("/api/v1/purchase-orders/$order/receive",['received_on'=>'2026-10-13','lines'=>[['purchase_order_line_id'=>$line,'quantity'=>2,'batch_number'=>'B-1']]])->assertUnprocessable();$this->assertDatabaseCount('goods_receipts',0);$this->assertDatabaseCount('stock_movements',0);$this->assertDatabaseCount('journal_entries',0);
 }
}
