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
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

final class PriceListController extends Controller
{
    public function preview(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:10240']]);
        $upload = $request->file('file');
        $sheet = IOFactory::load($upload->getRealPath())->getSheet(0);
        $rows = $this->sheetRows($sheet);
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
                $variant = $this->variantKey(
                    trim((string) ($row[$columns['category']] ?? '')),
                    trim((string) ($row[$columns['colours']] ?? '')),
                    $this->number($row[$columns['production_cost']] ?? null),
                    $price,
                );
                $key = Str::upper($article.'|'.$variant.'|'.$size);
                if (isset($seen[$key])) {
                    $duplicates++;
                    if (count($warnings) < 50) $warnings[] = "Row {$line}: exact duplicate variant/size {$article} / {$size}; the last row will update the first.";
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
            'duplicate_rows'=>$duplicates, 'variant_groups'=>count(array_unique(array_keys($seen))), 'warnings'=>$warnings, 'sample'=>$sample,
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $this->ensurePriceSchema();
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:10240']]);
        $upload = $request->file('file');
        $sheet = IOFactory::load($upload->getRealPath())->getSheet(0);
        $rows = $this->sheetRows($sheet);
        $header = array_shift($rows) ?: [];
        $columns = $this->columns($header);
        foreach (['article', 'category', 'item_code', 'size', 'selling_price'] as $required) {
            abort_unless(isset($columns[$required]), 422, "Missing required price-list column: {$required}.");
        }

        $stats = ['rows_read'=>0, 'articles_created'=>0, 'articles_updated'=>0, 'items_created'=>0, 'items_updated'=>0, 'rows_skipped'=>0];
        $warnings = [];
        $prepared = [];

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
            $colours = trim((string) ($row[$columns['colours']] ?? '')) ?: null;
            $cost = $this->number($row[$columns['production_cost']] ?? null);
            $variantKey = $this->variantKey($category, $colours, $cost, $price);
            $prepared[$articleCode][$variantKey][] = [
                'line'=>$line, 'category'=>$category,
                'item_code'=>$this->cleanCode($row[$columns['item_code']] ?? null) ?: $articleCode,
                'size'=>$this->cleanCode($row[$columns['size']] ?? null) ?: 'STANDARD',
                'colours'=>$colours, 'cost'=>$cost, 'price'=>$price,
            ];
        }

        DB::transaction(function () use ($prepared, $upload, $sheet, &$stats, &$warnings): void {
            foreach ($prepared as $articleKey => $variantGroups) {
                // PHP converts numeric-looking array keys to integers. Cast back to a
                // string so MySQL does not loosely match e.g. 2315 to 2315(S).
                $articleCode = (string) $articleKey;
                $firstRow = collect($variantGroups)->flatten(1)->first();
                $category = $firstRow['category'];
                $price = $firstRow['price'];

                $article = DB::table('articles')->where('code', $articleCode)->first();
                if (!$article) {
                    $articleId = DB::table('articles')->insertGetId([
                        'code'=>$articleCode, 'name'=>$articleCode, 'category'=>$category, 'set_name'=>'Price List',
                        'pieces_per_set'=>1, 'selling_price'=>$price, 'commission_rate'=>0, 'status'=>'active',
                        'created_at'=>now(), 'updated_at'=>now(),
                    ]);
                    $stats['articles_created']++;
                } else {
                    $articleId = $article->id;
                    DB::table('articles')->where('id', $articleId)->update([
                        'category'=>$category === 'UNCATEGORIZED' ? $article->category : $category,
                        'selling_price'=>$price, 'status'=>'active', 'updated_at'=>now(),
                    ]);
                    $stats['articles_updated']++;
                }

                $desiredSetIds = [];
                $multiple = count($variantGroups) > 1;
                foreach (array_values($variantGroups) as $groupIndex => $groupRows) {
                    $setName = $multiple ? 'Price List - Variant '.($groupIndex + 1) : 'Price List';
                    $set = DB::table('article_set_templates')->where('article_id', $articleId)->where('name', $setName)->first();
                    $setId = $set?->id ?: DB::table('article_set_templates')->insertGetId([
                        'article_id'=>$articleId, 'name'=>$setName, 'status'=>'active', 'created_at'=>now(), 'updated_at'=>now(),
                    ]);
                    DB::table('article_set_templates')->where('id', $setId)->update(['status'=>'active', 'updated_at'=>now()]);
                    $desiredSetIds[] = $setId;
                    $keptItemIds = [];
                    foreach ($groupRows as $itemRow) {
                        $item = DB::table('article_set_items')->where('set_template_id', $setId)->where('size_label', $itemRow['size'])->first();
                        $values = [
                            'item_code'=>$itemRow['item_code'], 'colours'=>$itemRow['colours'], 'production_cost'=>$itemRow['cost'], 'quantity'=>1,
                            'unit_price'=>$itemRow['price'], 'price_source'=>$upload->getClientOriginalName(), 'source_row'=>$itemRow['line'], 'price_updated_at'=>now(),
                            'sort_order'=>is_numeric($itemRow['size']) ? (int) $itemRow['size'] : 999, 'updated_at'=>now(),
                        ];
                        if ($item) {
                            DB::table('article_set_items')->where('id', $item->id)->update($values);
                            $keptItemIds[] = $item->id;
                            $stats['items_updated']++;
                        } else {
                            $keptItemIds[] = DB::table('article_set_items')->insertGetId($values + ['set_template_id'=>$setId, 'size_label'=>$itemRow['size'], 'created_at'=>now()]);
                            $stats['items_created']++;
                        }
                    }
                    $staleItems = DB::table('article_set_items')->where('set_template_id', $setId)->whereNotIn('id', $keptItemIds)->get();
                    foreach ($staleItems as $staleItem) {
                        if (!DB::table('customer_po_lines')->where('set_item_id', $staleItem->id)->exists()) {
                            DB::table('article_set_items')->where('id', $staleItem->id)->delete();
                        }
                    }
                }

                $staleSets = DB::table('article_set_templates')->where('article_id', $articleId)->where('name', 'like', 'Price List%')->whereNotIn('id', $desiredSetIds)->get();
                foreach ($staleSets as $staleSet) {
                    if (DB::table('customer_po_lines')->where('set_template_id', $staleSet->id)->exists()) {
                        DB::table('article_set_templates')->where('id', $staleSet->id)->update(['status'=>'inactive', 'updated_at'=>now()]);
                    } else {
                        DB::table('article_set_templates')->where('id', $staleSet->id)->delete();
                    }
                }
            }

            $activeCodes = array_map('strval', array_keys($prepared));
            $obsoleteArticles = DB::table('articles as a')
                ->join('article_set_templates as s', 's.article_id', '=', 'a.id')
                ->join('article_set_items as i', 'i.set_template_id', '=', 's.id')
                ->whereNotNull('i.price_source')
                ->whereNotIn('a.code', $activeCodes)
                ->select('a.id')
                ->distinct()
                ->get();
            foreach ($obsoleteArticles as $obsoleteArticle) {
                DB::table('articles')->where('id', $obsoleteArticle->id)->update(['status'=>'inactive', 'updated_at'=>now()]);
                foreach (DB::table('article_set_templates')->where('article_id', $obsoleteArticle->id)->where('name', 'like', 'Price List%')->get() as $obsoleteSet) {
                    if (DB::table('customer_po_lines')->where('set_template_id', $obsoleteSet->id)->exists()) {
                        DB::table('article_set_templates')->where('id', $obsoleteSet->id)->update(['status'=>'inactive', 'updated_at'=>now()]);
                    } else {
                        DB::table('article_set_templates')->where('id', $obsoleteSet->id)->delete();
                    }
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

    private function sheetRows(Worksheet $sheet): array
    {
        $rows = [];
        foreach ($sheet->getRowIterator() as $row) {
            $values = [];
            foreach ($row->getCellIterator('A', $sheet->getHighestColumn()) as $cell) {
                $values[$cell->getColumn()] = $cell->isFormula()
                    ? $cell->getOldCalculatedValue()
                    : $cell->getValue();
            }
            $rows[] = $values;
        }
        return $rows;
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

    private function variantKey(string $category, ?string $colours, ?float $cost, float $price): string
    {
        return Str::upper(trim($category).'|'.trim((string) $colours).'|'.($cost ?? '').'|'.$price);
    }
}
