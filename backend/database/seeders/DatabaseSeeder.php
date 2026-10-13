<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

final class DatabaseSeeder extends Seeder
{
 public function run():void {
  $now=now();
  DB::table('accounts')->insert([['code'=>'1300','name'=>'Inventory - Raw Materials','type'=>'asset','is_postable'=>true,'created_at'=>$now,'updated_at'=>$now],['code'=>'2100','name'=>'Goods Received Not Invoiced','type'=>'liability','is_postable'=>true,'created_at'=>$now,'updated_at'=>$now]]);
  DB::table('accounting_periods')->insert(['name'=>'Initial open period','starts_on'=>'2026-01-01','ends_on'=>'2027-03-31','status'=>'open','created_at'=>$now,'updated_at'=>$now]);
  DB::table('materials')->insert([['code'=>'SOLE-EVA-01','name'=>'EVA Sole','category'=>'raw_material','unit'=>'PCS','active'=>true,'created_at'=>$now,'updated_at'=>$now],['code'=>'BOX-YMAC-L','name'=>'Y-MAC Shoe Box Large','category'=>'packing','unit'=>'PCS','active'=>true,'created_at'=>$now,'updated_at'=>$now]]);
 }
}
