<?php
namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use App\Services\Inventory\FinishedGoodsInventoryService;

class InventoryCountController
{
    public function template(Request $request)
    {
        if ($request->query('kind') === 'raw') return $this->rawTemplate();
        $book = new Spreadsheet();
        $sheet = $book->getActiveSheet();
        $sheet->setTitle('Article stock');
        $sheet->fromArray([['Article code', 'Category', 'Stock']]);
        $baseline = $book->createSheet();
        $baseline->setTitle('Import baseline');
        $baseline->fromArray([['article_code', 'current_quantity']]);
        $totals = DB::table('finished_goods_stock')->select('article_id', DB::raw('SUM(quantity) as quantity'))->groupBy('article_id')->pluck('quantity', 'article_id');
        $line = 2;
        foreach (DB::table('articles')->where('status', 'active')->orderBy('code')->get() as $article) {
            $quantity = (float) ($totals[$article->id] ?? 0);
            $sheet->setCellValueExplicit('A'.$line, (string) $article->code, \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            $sheet->setCellValueExplicit('B'.$line, (string) ($article->category ?? ''), \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            $sheet->setCellValue('C'.$line, $quantity);
            $baseline->setCellValueExplicit('A'.$line, (string) $article->code, \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            $baseline->setCellValue('B'.$line, $quantity);
            $line++;
        }
        $sheet->freezePane('A2');
        $sheet->setAutoFilter('A1:C'.max(1, $line - 1));
        foreach (['A' => 24, 'B' => 36, 'C' => 22] as $column => $width) $sheet->getColumnDimension($column)->setWidth($width);
        $sheet->getStyle('A1:C1')->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $sheet->getStyle('A1:C1')->getFill()->setFillType('solid')->getStartColor()->setRGB('245443');
        $sheet->getStyle('C2:C'.max(2, $line - 1))->getFill()->setFillType('solid')->getStartColor()->setRGB('FFF2CC');
        $sheet->getRowDimension(1)->setRowHeight(28);
        $baseline->setSheetState(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet::SHEETSTATE_VERYHIDDEN);
        $help = $book->createSheet();
        $help->setTitle('Instructions');
        $help->fromArray([
            ['Each article appears once. Stock is the TOTAL number of pieces for that article.'],
            ['Edit Stock only. Existing totals are filled in. Blank keeps stock unchanged; 0 clears it.'],
            ['Save this file, upload, review and save the update. No sizes or size allocation are required.'],
            ['The new article total replaces its existing stock total; it is not added again.'],
            ['Download a fresh template for each update. Keep Article code and Category unchanged.'],
        ]);
        $help->getColumnDimension('A')->setWidth(110);
        $book->setActiveSheetIndex(0);
        return response()->streamDownload(fn () => (new Xlsx($book))->save('php://output'),
            'Article_Stock_Counts.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    private function rawTemplate()
    {
        $book=new Spreadsheet();$sheet=$book->getActiveSheet();$sheet->setTitle('Raw material counts');
        $sheet->fromArray([['material_code','material_name','batch','current_quantity','new_quantity','unit_cost']]);
        $rows=DB::table('materials as m')->leftJoin('stock_balances as s','s.material_id','=','m.id')
            ->select('m.code','m.name','s.batch_number','s.quantity','s.unit_cost')->orderBy('m.code')->get();
        $i=2;
        foreach ($rows as $row) {
            foreach ([$row->code,$row->name,$row->batch_number??''] as $j=>$value) $sheet->setCellValueExplicit(chr(65+$j).$i,(string)$value,\PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            $sheet->setCellValue('D'.$i,(float)($row->quantity??0));$sheet->setCellValue('F'.$i,(float)($row->unit_cost??0));$i++;
        }
        foreach (['A','B','C','D','E','F'] as $col) $sheet->getColumnDimension($col)->setWidth($col==='B'?38:22);
        $sheet->freezePane('A2');$sheet->setAutoFilter('A1:F'.max(1,$i-1));
        $sheet->getStyle('A1:F1')->getFont()->setBold(true);
        $sheet->getStyle('E2:E'.max(2,$i))->getFill()->setFillType('solid')->getStartColor()->setRGB('FFF2CC');
        $help=$book->createSheet();$help->setTitle('Instructions');$help->getColumnDimension('A')->setWidth(110);
        $help->fromArray([['Fill new_quantity; blank leaves unchanged, zero sets stock to zero.'],['Enter a batch and positive unit cost for new material batches; keep current_quantity as 0.'],['For existing batches keep the unit cost unchanged. Differences post stock movements and adjustment journals.'],['Counts replace balances. Download a fresh template before updating.']]);
        $book->setActiveSheetIndex(0);
        return response()->streamDownload(fn()=>(new Xlsx($book))->save('php://output'),'Material_Stock_Counts.xlsx',['Content-Type'=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    public function preview(Request $request)
    {
        $request->validate(['file'=>'required|file|max:2048|mimes:xlsx'], [
            'file.required' => 'Choose your completed Excel file first.',
            'file.mimes' => 'Choose an Excel .xlsx file downloaded from this page.',
            'file.max' => 'Choose an Excel file smaller than 2 MB.',
        ]);
        $reader=IOFactory::createReader('Xlsx');
        $file=$request->file('file')->getRealPath();
        $info=$reader->listWorksheetInfo($file);
        abort_if(($info[0]['totalRows']??0)>5001 || ($info[0]['totalColumns']??0)>256,422,'Use the supplied template (maximum 5,000 rows).');
        $book=$reader->load($file);
        $sheet=$book->getSheet(0);
        if ($sheet->getTitle() === 'Article stock') {
            abort_unless($sheet->rangeToArray('A1:C1', null, false, false)[0] === ['Article code', 'Category', 'Stock'], 422, 'Use the Article code, Category, Stock template.');
            $baseline = $book->getSheetByName('Import baseline');
            abort_unless($baseline, 422, 'Download a fresh stock template from this page.');
            $expected = [];
            foreach ($baseline->toArray(null, false, false) as $index => $cells) {
                if ($index > 0) $expected[(string) $cells[0]] = $cells[1];
            }
            $rows = [];
            $seen = [];
            for ($line = 2; $line <= $sheet->getHighestDataRow(); $line++) {
                $code = (string) $sheet->getCell('A'.$line)->getValue();
                $quantity = $sheet->getCell('C'.$line)->getValue();
                if ($quantity === null || $quantity === '') continue;
                abort_unless(array_key_exists($code, $expected), 422, 'Unknown article on row '.$line.'. Download a fresh template.');
                abort_if(isset($seen[$code]), 422, 'Article '.$code.' appears more than once. Keep one row per article.');
                $seen[$code] = true;
                if (is_numeric($quantity) && (float) $quantity === (float) $expected[$code]) continue;
                $rows[] = ['kind' => 'article', 'code' => $code, 'size' => '__ARTICLE_TOTAL__', 'expected' => $expected[$code], 'quantity' => $quantity];
            }
            if (!$rows) return response()->json(['rows' => [], 'message' => 'No stock changes found. Edit the Stock column, save your file and upload it again.']);
            $request->merge(['rows' => $rows]);
            $data = $this->validated($request);
            return response()->json(['rows' => $this->resolve($data['rows'])]);
        }
        if ($sheet->getTitle() === 'Article counts') {
            $baseline = $book->getSheetByName('Import baseline');
            abort_unless($baseline && $sheet->getCell('A1')->getValue() === 'article_code' && $sheet->getCell('B1')->getValue() === 'article_name', 422, 'Download a fresh article template and keep its headings unchanged.');
            $expected = [];
            foreach ($baseline->toArray(null, false, false) as $index => $cells) {
                if ($index === 0) continue;
                $expected[(string) $cells[0]][(string) $cells[1]] = $cells[2];
            }
            $rows = [];
            $columns = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($sheet->getHighestDataColumn());
            for ($line = 2; $line <= $sheet->getHighestDataRow(); $line++) {
                $code = (string) $sheet->getCell('A'.$line)->getValue();
                for ($column = 3; $column <= $columns; $column++) {
                    $letter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($column);
                    $quantity = $sheet->getCell($letter.$line)->getValue();
                    if ($quantity === null || $quantity === '') continue;
                    $heading = (string) $sheet->getCell($letter.'1')->getValue();
                    $size = substr($heading, 5);
                    abort_unless(str_starts_with($heading, 'Size ') && array_key_exists($size, $expected[$code] ?? []), 422,
                        'Cell '.$letter.$line.' is not an available size for article '.$code.'. Use yellow cells only.');
                    $rows[] = ['code' => $code, 'size' => $size, 'expected' => $expected[$code][$size], 'quantity' => $quantity];
                }
            }
            $request->merge(['rows' => $rows]);
            $data = $this->validated($request);
            return response()->json(['rows' => $this->resolve($data['rows'])]);
        }
        if ($sheet->getTitle()==='Raw material counts') {
            abort_unless($sheet->rangeToArray('A1:F1',null,false,false)[0]===['material_code','material_name','batch','current_quantity','new_quantity','unit_cost'],422,'Use the raw material template.');
            $rows=[];
            for ($i=2;$i<=$sheet->getHighestDataRow();$i++) {
                $cells=$sheet->rangeToArray('A'.$i.':F'.$i,null,false,false)[0];
                if ($cells[4]===null || $cells[4]==='') continue;
                $rows[]=['kind'=>'raw','code'=>(string)$cells[0],'size'=>(string)$cells[2],'expected'=>$cells[3],'quantity'=>$cells[4],'unit_cost'=>$cells[5]];
            }
            $request->merge(['rows'=>$rows]);$data=$this->validated($request);
            return response()->json(['rows'=>$this->resolve($data['rows'])]);
        }
        abort_unless($sheet->rangeToArray('A1:E1',null,false,false)[0]===['article_code','article_name','size','current_quantity','new_quantity'],422,'Use the supplied template.');
        $rows=[];
        for ($i=2;$i<=$sheet->getHighestDataRow();$i++) {
            $cells=$sheet->rangeToArray('A'.$i.':E'.$i,null,false,false)[0];
            if ($cells[4]===null || $cells[4]==='') continue;
            $rows[]=['code'=>(string)$cells[0],'size'=>(string)$cells[2],'expected'=>$cells[3],'quantity'=>$cells[4]];
        }
        $request->merge(['rows'=>$rows]);
        $data=$this->validated($request);
        return response()->json(['rows'=>$this->resolve($data['rows'])]);
    }

    private function validated(Request $request): array
    {
        return $request->validate(['rows'=>'required|array|min:1|max:5000',
            'rows.*.code'=>'required|string|max:80','rows.*.size'=>'required|string|max:80',
            'rows.*.expected'=>'required|numeric|min:0|max:999999999',
            'rows.*.quantity'=>'required|numeric|min:0|max:999999999',
            'rows.*.kind'=>'sometimes|in:finished,raw,article','rows.*.unit_cost'=>'nullable|numeric|min:0|max:999999999'], [
                'rows.required' => 'No new quantities found. Fill the yellow cells in Article counts (or new_quantity for raw materials), save the file and upload again. Blank cells leave stock unchanged.',
                'rows.*.quantity.numeric' => 'Enter numbers only in quantity cells. Formulas and text are not accepted.',
                'rows.*.quantity.min' => 'Stock quantities cannot be negative.',
                'rows.*.quantity.max' => 'A stock quantity is too large.',
            ]);
    }

    private function resolve(array $rows): array
    {
        $seen=[];
        $articleModes = [];
        foreach ($rows as $entry) {
            if (($entry['kind'] ?? '') === 'raw') continue;
            $mode = ($entry['kind'] ?? '') === 'article' ? 'article' : 'size';
            if (isset($articleModes[$entry['code']]) && $articleModes[$entry['code']] !== $mode) throw ValidationException::withMessages(['rows' => 'Do not mix article totals and size counts for the same article.']);
            $articleModes[$entry['code']] = $mode;
        }
        foreach ($rows as &$row) {
            if (($row['kind']??'finished') === 'raw') {
                $material=DB::table('materials')->where('code',$row['code'])->lockForUpdate()->first();
                if (!$material) throw ValidationException::withMessages(['rows'=>'Unknown material: '.$row['code']]);
                $key='raw:'.$material->id.':'.$row['size'];
                if (isset($seen[$key])) throw ValidationException::withMessages(['rows'=>'Duplicate material batch: '.$key]);
                $seen[$key]=true;
                $stock=DB::table('stock_balances')->where('material_id',$material->id)->where('batch_number',$row['size'])->lockForUpdate()->first();
                if ($stock && abs((float)$stock->unit_cost-(float)($row['unit_cost']??0))>0.0001) throw ValidationException::withMessages(['rows'=>'Keep the existing batch unit cost unchanged.']);
                $current=(float)($stock->quantity??0);
                if (abs($current-(float)$row['expected'])>0.0001) throw ValidationException::withMessages(['rows'=>'Material stock changed. Download a fresh template.']);
                if ((float)($row['unit_cost']??0)<=0) throw ValidationException::withMessages(['rows'=>'Enter a positive unit cost for material '.$row['code']]);
                $row['material_id']=$material->id;$row['name']=$material->name;$row['difference']=(float)$row['quantity']-$current;
                continue;
            }
            if ((float)$row['quantity'] != floor((float)$row['quantity'])) throw ValidationException::withMessages(['rows'=>'Article quantities must be whole pieces.']);
            $article=DB::table('articles')->where('code',$row['code'])->lockForUpdate()->first();
            if (!$article || $article->status !== 'active') throw ValidationException::withMessages(['rows'=>'Unknown or inactive article: '.$row['code']]);
            if (($row['kind'] ?? '') === 'article') {
                if (isset($seen['article:'.$article->id])) throw ValidationException::withMessages(['rows' => 'Keep one count per article.']);
                $seen['article:'.$article->id] = true;
                $stocks = DB::table('finished_goods_stock')->where('article_id', $article->id)->lockForUpdate()->get();
                $current = (float) $stocks->sum('quantity');
                if (abs($current - (float) $row['expected']) > 0.0001) throw ValidationException::withMessages(['rows' => 'Stock changed for '.$row['code'].'. Download a fresh template.']);
                $row['article_id'] = $article->id;
                $row['name'] = $article->name;
                $row['difference'] = (float) $row['quantity'] - $current;
                continue;
            }
            $key=$article->id.':'.$row['size'];
            if (isset($seen[$key])) throw ValidationException::withMessages(['rows'=>'Duplicate article / size: '.$key]);
            $seen[$key]=true;
            $valid=DB::table('article_set_items as i')->join('article_set_templates as t','t.id','=','i.set_template_id')
                ->where('t.article_id',$article->id)->where('i.size_label',$row['size'])->exists();
            if (!$valid) throw ValidationException::withMessages(['rows'=>'Invalid size for article '.$row['code']]);
            if (DB::table('finished_goods_stock')->where('article_id', $article->id)->where('size_label', '__ARTICLE_TOTAL__')->exists()) throw ValidationException::withMessages(['rows' => 'This article uses total stock. Download the new Article code, Category, Stock template.']);
            $stock=DB::table('finished_goods_stock')->where('article_id',$article->id)->where('size_label',$row['size'])->lockForUpdate()->first();
            $current=(float)($stock->quantity??0);
            if (abs($current-(float)$row['expected'])>0.0001) throw ValidationException::withMessages(['rows'=>'Stock changed for '.$row['code'].' size '.$row['size'].'. Download a fresh template.']);
            $row['article_id']=$article->id;
            $row['name']=$article->name;
            $row['difference']=(float)$row['quantity']-$current;
        }
        return $rows;
    }

    public function apply(Request $request)
    {
        $data=$this->validated($request);
        $meta=$request->validate(['import_key'=>'required|uuid','reason'=>'required|string|min:3|max:255']);
        abort_if(strlen(trim($meta['reason']))<3,422,'Enter a reason for the stock update.');
        return DB::transaction(function () use ($data,$meta) {
            $hash=hash('sha256',json_encode([$data,$meta['reason']]));
            $old=DB::table('stock_import_batches')->where('import_key',$meta['import_key'])->lockForUpdate()->first();
            if ($old) {
                abort_unless($old->payload_hash===$hash,422,'This update reference has already been used.');
                return response()->json(['message'=>'Stock update already applied.']);
            }
            $rows=$this->resolve($data['rows']);
            foreach ($rows as $row) {
                if (($row['kind']??'finished')==='raw') {
                    if ($row['difference']!=0) (new StockAdjustmentController())->store(new Request([
                        'material_id'=>$row['material_id'],'batch_number'=>$row['size'],'adjustment_date'=>date('Y-m-d'),
                        'adjustment_type'=>$row['difference']>0?'increase':'decrease','quantity'=>abs($row['difference']),
                        'unit_cost'=>$row['unit_cost'],'reason'=>$meta['reason']]),app(\App\Services\Accounting\PostingService::class));
                    continue;
                }
                if (($row['kind'] ?? '') === 'article') {
                    (new FinishedGoodsInventoryService())->setArticleCount($row['article_id'], (float) $row['quantity'], date('Y-m-d'));
                    continue;
                }
                if ($row['difference']!=0) (new FinishedGoodsInventoryService())->adjust($row['article_id'],$row['size'],abs($row['difference']),$row['difference']>0?'increase':'decrease',date('Y-m-d'));
            }
            DB::table('stock_import_batches')->insert(['import_key'=>$meta['import_key'],'payload_hash'=>$hash,'rows'=>count($rows),'created_at'=>now()]);
            DB::table('audit_logs')->insert(['event'=>'inventory.count_updated','entity_type'=>'stock_import','entity_id'=>0,
                'payload'=>json_encode(['reason'=>$meta['reason'],'rows'=>$rows]),'created_at'=>now()]);
            return response()->json(['message'=>count($rows).' stock counts updated successfully.']);
        });
    }
}
