<?php

namespace App\Services\Inventory;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class SerialWarrantyService
{
    public function register(array $d,?int $user):array
    {
        return DB::transaction(function()use($d,$user){
            $article=DB::table('articles')->lockForUpdate()->find($d['article_id']);abort_unless($article&&$article->status==='active',422,'Choose an active article.');
            abort_unless(DB::table('article_set_items as i')->join('article_set_templates as s','s.id','=','i.set_template_id')->where('s.article_id',$article->id)->where('i.size_label',$d['size_label'])->exists(),422,'Size does not belong to the article.');
            $serials=array_map('trim',$d['serial_numbers']);abort_if(count(array_unique($serials))!==count($serials)||in_array('',$serials,true),422,'Serial numbers must be non-empty and unique.');
            abort_if(DB::table('product_serials')->whereIn('serial_number',$serials)->exists(),422,'A serial number is already registered.');
            if(empty($d['sales_invoice_id'])){
                $stock=DB::table('finished_goods_stock')->where('article_id',$article->id)->where('size_label',$d['size_label'])->lockForUpdate()->first();
                $registered=DB::table('product_serials')->where('article_id',$article->id)->where('size_label',$d['size_label'])->where('status','available')->count();
                abort_unless($stock&&$registered+count($serials)<=(float)$stock->quantity+0.00001,422,'Serials must describe existing available stock. Receive/import stock first; serial registration does not create stock.');
            }
            $ids=[];
            foreach($serials as $serial)$ids[]=DB::table('product_serials')->insertGetId(['serial_number'=>$serial,'article_id'=>$article->id,'size_label'=>$d['size_label'],'received_on'=>$d['received_on'],'warranty_months'=>$d['warranty_months'],'created_at'=>now(),'updated_at'=>now()]);
            if(!empty($d['sales_invoice_id']))$this->attach($ids,(int)$d['sales_invoice_id'],$user);
            $this->audit('serials.registered',0,$user,['serial_ids'=>$ids,'article_id'=>$article->id,'invoice_id'=>$d['sales_invoice_id']??null]);return $ids;
        });
    }

    public function attach(array $ids,int $invoiceId,?int $user):void
    {
        DB::transaction(function()use($ids,$invoiceId,$user){
            $invoice=DB::table('sales_invoices')->lockForUpdate()->find($invoiceId);abort_unless($invoice,404,'Invoice not found.');
            $serials=DB::table('product_serials')->whereIn('id',$ids)->orderBy('id')->lockForUpdate()->get();abort_if($serials->count()!==count(array_unique($ids)),422,'Serial selection is invalid.');
            foreach($serials as $serial){
                if($serial->sales_invoice_id==$invoiceId)continue;
                abort_unless($serial->status==='available'&&!$serial->sales_invoice_id,422,'Serial is already issued.');
                abort_if($invoice->invoice_date<$serial->received_on,422,'Invoice date cannot precede serial receipt date.');
                $quantity=(float)DB::table('sales_invoice_lines')->where('sales_invoice_id',$invoiceId)->where('article_id',$serial->article_id)->where('size_label',$serial->size_label)->sum('quantity');
                $assigned=DB::table('product_serials')->where('sales_invoice_id',$invoiceId)->where('article_id',$serial->article_id)->where('size_label',$serial->size_label)->count();
                abort_if($assigned+1>$quantity+0.00001,422,'Issued serials exceed this product/size quantity on the invoice.');
                $end=$serial->warranty_months>0?Carbon::parse($invoice->invoice_date)->addMonthsNoOverflow($serial->warranty_months)->toDateString():null;
                DB::table('product_serials')->where('id',$serial->id)->update(['sales_invoice_id'=>$invoiceId,'status'=>'sold','warranty_starts_on'=>$invoice->invoice_date,'warranty_ends_on'=>$end,'updated_at'=>now()]);
            }
            $this->audit('serials.issued',$invoiceId,$user,['serial_ids'=>$ids]);
        });
    }

    public function issueForInvoice(int $invoiceId):void
    {
        if(!Schema::hasTable('product_serials'))return;
        foreach(DB::table('sales_invoice_lines')->where('sales_invoice_id',$invoiceId)->select('article_id','size_label',DB::raw('SUM(quantity) quantity'))->groupBy('article_id','size_label')->get() as $line){
            // Lock the product to serialize receipt/issue decisions for this article.
            $article=DB::table('articles')->lockForUpdate()->find($line->article_id);
            $assigned=DB::table('product_serials')->where('sales_invoice_id',$invoiceId)->where('article_id',$line->article_id)->where('size_label',$line->size_label)->count();
            $needed=(float)$line->quantity-$assigned;
            $available=DB::table('product_serials')->where('article_id',$line->article_id)->where('size_label',$line->size_label)->where('status','available')->orderBy('id')->lockForUpdate()->limit(max(0,(int)floor($needed)))->pluck('id')->all();
            abort_if($article->track_serials&&($needed!=floor($needed)||count($available)<$needed),422,'Register a serial for every invoiced unit of '.$article->code.' / size '.$line->size_label.' before dispatch.');
            if($available)$this->attach($available,$invoiceId,null);
        }
    }

    public function guardInvoice(int $invoiceId):void
    {
        if(Schema::hasTable('product_serials'))abort_if(DB::table('product_serials')->where('sales_invoice_id',$invoiceId)->exists(),422,'This invoice has issued serials/warranty history and cannot be edited or deleted. Preserve the original invoice and use a controlled return or adjustment.');
    }

    public function claim(array $d,?int $user):int
    {
        return DB::transaction(function()use($d,$user){
            $serial=DB::table('product_serials')->lockForUpdate()->find($d['product_serial_id']);
            abort_unless($serial&&$serial->status==='sold'&&$serial->warranty_ends_on,422,'Choose an invoiced serial with warranty coverage.');
            abort_if($d['claim_date']<$serial->warranty_starts_on||$d['claim_date']>$serial->warranty_ends_on,422,'Claim date is outside the recorded warranty period.');
            abort_if(trim($d['issue'])==='',422,'Describe the issue.');
            abort_if(DB::table('warranty_claims')->where('product_serial_id',$serial->id)->whereIn('status',['open','in_progress'])->exists(),422,'This serial already has an open claim.');
            $id=DB::table('warranty_claims')->insertGetId($d+['created_by'=>$user,'created_at'=>now(),'updated_at'=>now()]);$this->audit('warranty.claimed',$id,$user,$d);return $id;
        });
    }

    public function resolve(int $id,array $d,?int $user):void
    {
        DB::transaction(function()use($id,$d,$user){
            $claim=DB::table('warranty_claims')->lockForUpdate()->find($id);abort_unless($claim,404);
            abort_unless(in_array($claim->status,['open','in_progress']),422,'Closed claims retain their recorded outcome.');
            abort_if(trim($d['resolution'])==='',422,'Enter an update/resolution reason.');
            abort_if($d['resolved_on']<$claim->claim_date,422,'Update date cannot precede the claim.');
            DB::table('warranty_claims')->where('id',$id)->update($d+['updated_at'=>now()]);$this->audit('warranty.updated',$id,$user,['before'=>$claim,'after'=>$d]);
        });
    }

    private function audit(string $event,int $id,?int $user,array $data):void
    {
        DB::table('audit_logs')->insert(['event'=>$event,'entity_type'=>'serial_warranty','entity_id'=>$id,'payload'=>json_encode(['user_id'=>$user]+$data),'created_at'=>now()]);
    }
}
