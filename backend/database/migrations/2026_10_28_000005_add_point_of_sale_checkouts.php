<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up():void
    {
        Schema::create('pos_checkouts',function(Blueprint $t){$t->id();$t->uuid('checkout_key')->unique();$t->string('payload_hash',64);$t->foreignId('sales_invoice_id')->nullable()->constrained();$t->foreignId('customer_receipt_id')->nullable()->constrained('customer_receipts');$t->unsignedBigInteger('created_by')->nullable();$t->timestamps();});
    }
    public function down():void { Schema::dropIfExists('pos_checkouts'); }
};
