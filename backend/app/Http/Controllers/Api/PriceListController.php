<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;

final class PriceListController extends Controller
{
    public function preview(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:10240']]);
        $upload = $request->file('file');
        $sheet = IOFactory::load($upload->getRealPath())->getSheet(0);
        $rows = $sheet->toArray(null, true, true, true);
        $header = array_shift($rows) ?: [];
        $columns = $this->columns($header);
        $required = ['article', 'category', 'item_code', 'size', 'colours', 'production_cost', 'selling_price'];
        $missing = array_values(array_filter($required, fn (string $column) => !isset($columns[$column])));
        $valid = 0;
        $skipped = 0;
        $duplicates = 0;
        $warnings = [];
        $seen = [];
        $sample = [];
        if (!$missing) {
            foreach ($rows as $index => $row) {
                if (!array_filter($row, fn ($value) => $value !== null && trim((string) $value) !== '')) continue;
                $line = $index + 2;
                $article = $this->cleanCode($row[$columns['article']] ?? null);
                $price = $this->number($row[$columns['selling_price']] ?? null);
                if ($article === '' || $price === null || $price < 0) {
                    $skipped++;
                    if (count($warnings) < 50) $warnings[] = "Row {$line}: skipped because article or selling price is missing/invalid.";
                    continue;
                }
                $itemCode = $this->cleanCode($row[$columns['item_code']] ?? null) ?: $article;
                $size = $this->cleanCode($row[$columns['size']] ?? null) ?: 'STANDARD';
                $key = Str::upper($article.'|'.$size);
                if (isset($seen[$key])) {
                    $duplicates++;
                    if (count($warnings) < 50) $warnings[] = "Row {$line}: duplicate article/size {$article} / {$size}; the last row will update the first.";
                }
                $seen[$key] = true;
                $valid++;
                if (count($sample) < 10) $sample[] = [
                    'row'=>$line, 'article'=>$article, 'category'=>trim((string) ($row[$columns['category']] ?? '')),
                    'item_code'=>$itemCode, 'size'=>$size, 'colours'=>trim((string) ($row[$columns['colours']] ?? '')),
                    'production_cost'=>$this->number($row[$columns['production_cost']] ?? null), 'selling_price'=>$price,
                ];
            }
        }
        return response()->json([
            'file_name'=>$upload->getClientOriginalName(), 'sheet_name'=>$sheet->getTitle(),
            'can_import'=>count($missing) === 0 && $valid > 0,
            'missing_columns'=>$missing, 'valid_rows'=>$valid, 'skipped_rows'=>$skipped,
            'duplicate_rows'=>$duplicates, 'warnings'=>$warnings, 'sample'=>$sample,
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $this->ensurePriceSchema();
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:10240']]);
        $upload = $request->file('file');
        $sheet = IOFactory::load($upload->getRealPath())->getSheet(0);
        $rows = $sheet->toArray(null, true, true, true);
        $header = array_shift($rows) ?: [];
        $columns = $this->columns($header);
        foreach (['article', 'category', 'item_code', 'size', 'selling_price'] as $required) {
            abort_unless(isset($columns[$required]), 422, "Missing required price-list column: {$required}.");
        }

        $stats = ['rows_read'=>0, 'articles_created'=>0, 'articles_updated'=>0, 'items_created'=>0, 'items_updated'=>0, 'rows_skipped'=>0];
        $warnings = [];
        $seen = [];
        $articleOrigins = [];

        DB::transaction(function () use ($rows, $columns, $upload, $sheet, &$stats, &$warnings, &$seen, &$articleOrigins): void {
            foreach ($rows as $index => $row) {
                if (!array_filter($row, fn ($value) => $value !== null && trim((string) $value) !== '')) continue;
                $stats['rows_read']++;
                $line = $index + 2;
                $articleCode = $this->cleanCode($row[$columns['article']] ?? null);
                $price = $this->number($row[$columns['selling_price']] ?? null);
                if ($articleCode === '' || $price === null) {
                    $stats['rows_skipped']++;
                    if (count($warnings) < 30) $warnings[] = "Row {$line}: missing article or selling price.";
                    continue;
                }

                $category = trim((string) ($row[$columns['category']] ?? '')) ?: 'UNCATEGORIZED';
                $itemCode = $this->cleanCode($row[$columns['item_code']] ?? null) ?: $articleCode;
                $size = $this->cleanCode($row[$columns['size']] ?? null) ?: 'STANDARD';
                $colours = trim((string) ($row[$columns['colours']] ?? '')) ?: null;
                $cost = $this->number($row[$columns['production_cost']] ?? null);
                $key = Str::upper($articleCode.'|'.$size);
                if (isset($seen[$key])) {
                    if (abs($seen[$key] - $price) > 0.001 && count($warnings) < 30) $warnings[] = "Row {$line}: duplicate {$itemCode} has a different price; the last price was used.";
                }
                $seen[$key] = $price;

                $article = DB::table('articles')->where('code', $articleCode)->first();
                if (!$article) {
                    $articleId = DB::table('articles')->insertGetId([
                        'code'=>$articleCode, 'name'=>$articleCode, 'category'=>$category, 'set_name'=>'Price List',
                        'pieces_per_set'=>1, 'selling_price'=>$price, 'commission_rate'=>0, 'status'=>'active',
                        'created_at'=>now(), 'updated_at'=>now(),
                    ]);
                    if (!isset($articleOrigins[$articleCode])) {
                        $articleOrigins[$articleCode] = 'created';
                        $stats['articles_created']++;
                    }
                } else {
                    $articleId = $article->id;
                    DB::table('articles')->where('id', $articleId)->update([
                        'category'=>$category === 'UNCATEGORIZED' ? $article->category : $category,
                        'selling_price'=>$price, 'status'=>'active', 'updated_at'=>now(),
                    ]);
                    if (!isset($articleOrigins[$articleCode])) {
                        $articleOrigins[$articleCode] = 'updated';
                        $stats['articles_updated']++;
                    }
                }

                $set = DB::table('article_set_templates')->where('article_id', $articleId)->where('name', 'Price List')->first();
                $setId = $set?->id ?: DB::table('article_set_templates')->insertGetId([
                    'article_id'=>$articleId, 'name'=>'Price List', 'status'=>'active', 'created_at'=>now(), 'updated_at'=>now(),
                ]);
                $item = DB::table('article_set_items')->where('set_template_id', $setId)->where('size_label', $size)->first();
                $values = [
                    'item_code'=>$itemCode, 'colours'=>$colours, 'production_cost'=>$cost, 'quantity'=>1,
                    'unit_price'=>$price, 'price_source'=>$upload->getClientOriginalName(), 'source_row'=>$line, 'price_updated_at'=>now(),
                    'sort_order'=>is_numeric($size) ? (int) $size : 999, 'updated_at'=>now(),
                ];
                if ($item) {
                    DB::table('article_set_items')->where('id', $item->id)->update($values);
                    $stats['items_updated']++;
                } else {
                    DB::table('article_set_items')->insert($values + ['set_template_id'=>$setId, 'size_label'=>$size, 'created_at'=>now()]);
                    $stats['items_created']++;
                }
            }

            DB::table('price_list_imports')->insert($stats + [
                'file_name'=>$upload->getClientOriginalName(), 'sheet_name'=>$sheet->getTitle(),
                'warnings'=>json_encode($warnings), 'created_at'=>now(), 'updated_at'=>now(),
            ]);
        });

        return response()->json(['message'=>'Price list imported. New transactions now use these prices.', 'summary'=>$stats, 'warnings'=>$warnings]);
    }

    private function ensurePriceSchema(): void
    {
        $missing = array_values(array_filter(
            ['item_code', 'colours', 'production_cost', 'price_source', 'source_row', 'price_updated_at'],
            fn (string $column) => !Schema::hasColumn('article_set_items', $column),
        ));
        if ($missing) {
            Schema::table('article_set_items', function (Blueprint $table) use ($missing): void {
                if (in_array('item_code', $missing, true)) $table->string('item_code', 60)->nullable();
                if (in_array('colours', $missing, true)) $table->string('colours', 255)->nullable();
                if (in_array('production_cost', $missing, true)) $table->decimal('production_cost', 18, 2)->nullable();
                if (in_array('price_source', $missing, true)) $table->string('price_source', 120)->nullable();
                if (in_array('source_row', $missing, true)) $table->unsignedInteger('source_row')->nullable();
                if (in_array('price_updated_at', $missing, true)) $table->timestamp('price_updated_at')->nullable();
            });
        }
        if (!Schema::hasTable('price_list_imports')) {
            Schema::create('price_list_imports', function (Blueprint $table): void {
                $table->id();
                $table->string('file_name');
                $table->string('sheet_name')->nullable();
                $table->unsignedInteger('rows_read')->default(0);
                $table->unsignedInteger('articles_created')->default(0);
                $table->unsignedInteger('articles_updated')->default(0);
                $table->unsignedInteger('items_created')->default(0);
                $table->unsignedInteger('items_updated')->default(0);
                $table->unsignedInteger('rows_skipped')->default(0);
                $table->json('warnings')->nullable();
                $table->timestamps();
            });
        }
    }

    private function columns(array $header): array
    {
        $aliases = ['article'=>'article', 'category'=>'category', 'item code'=>'item_code', 'size'=>'size', 'colours'=>'colours', 'colors'=>'colours', 'production cost'=>'production_cost', 'selling price'=>'selling_price'];
        $found = [];
        foreach ($header as $letter => $value) {
            $name = Str::lower(trim(preg_replace('/\s+/', ' ', (string) $value)));
            if (isset($aliases[$name])) $found[$aliases[$name]] = $letter;
        }
        return $found;
    }

    private function cleanCode(mixed $value): string
    {
        $text = trim((string) $value);
        return preg_match('/^\d+\.0$/', $text) ? substr($text, 0, -2) : $text;
    }

    private function number(mixed $value): ?float
    {
        if ($value === null || trim((string) $value) === '') return null;
        $clean = str_replace([',', 'LKR', 'Rs.', 'Rs'], '', (string) $value);
        return is_numeric(trim($clean)) ? round((float) $clean, 2) : null;
    }
}
