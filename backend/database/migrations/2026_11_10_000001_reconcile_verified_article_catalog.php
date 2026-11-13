<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        // Production Pricing: first category per distinct article code; never import stock or prices.
        $catalog = json_decode('[{"code":"9009","category":"SLIPPON"},{"code":"9247","category":"SLIPPON"},{"code":"9249","category":"SLIPPON"},{"code":"9250","category":"SANDLE"},{"code":"9251","category":"SANDLE"},{"code":"9257","category":"SLIPPON"},{"code":"9259","category":"SLIPPON"},{"code":"9260","category":"SANDLE"},{"code":"9261","category":"SLIPPON"},{"code":"9264","category":"SLIPPON"},{"code":"9265","category":"SANDLE"},{"code":"9266","category":"SLIPPON"},{"code":"9267","category":"SLIPPON"},{"code":"9268","category":"SANDLE"},{"code":"9269","category":"SLIPPON"},{"code":"9270","category":"SLIPPON"},{"code":"9272","category":"SANDLE"},{"code":"9273","category":"SLIPPON"},{"code":"9274","category":"SLIPPON"},{"code":"9275","category":"SLIPPON"},{"code":"9278","category":"SLIPPON"},{"code":"9279","category":"SLIPPON"},{"code":"9280","category":"SLIPPON"},{"code":"9281","category":"SLIPPON"},{"code":"9282","category":"SLIPPON"},{"code":"9283","category":"SLIPPON"},{"code":"9284","category":"SLIPPON"},{"code":"9285","category":"SLIPPON"},{"code":"9286","category":"SLIPPON"},{"code":"9287","category":"SLIPPON/SANDLE"},{"code":"9290","category":"SLIPPON"},{"code":"9291","category":"SLIPPON"},{"code":"9292","category":"SLIPPON"},{"code":"9293","category":"SLIPPON"},{"code":"9294","category":"SLIPPON"},{"code":"9296","category":"SANDLE"},{"code":"9297","category":"SLIPPON"},{"code":"9298","category":"SLIPPON"},{"code":"9299","category":"SLIPPON"},{"code":"9300","category":"SLIPPON"},{"code":"9301","category":"SLIPPON"},{"code":"9302","category":"SLIPPON"},{"code":"9303","category":"SLIPPON"},{"code":"9304","category":"SLIPPON"},{"code":"9305","category":"SLIPPON"},{"code":"9306","category":"SLIPPON"},{"code":"9307","category":"SLIPPON"},{"code":"9308","category":"SLIPPON"},{"code":"9309","category":"SLIPPON"},{"code":"9311","category":"SLIPPON"},{"code":"9312","category":"SLIPPON"},{"code":"9313","category":"SANDLE"},{"code":"9316","category":"SLIPPON"},{"code":"9317","category":"SLIPPON"},{"code":"9318","category":"SLIPPON"},{"code":"9319","category":"SANDLE/SLIPPON"},{"code":"9320","category":"SLIPPON"},{"code":"9321","category":"SLIPPON"},{"code":"9322","category":"SLIPPON"},{"code":"9324","category":"SLIPPON"},{"code":"9325","category":"SLIPPON"},{"code":"9326","category":"SLIPPON"},{"code":"9327","category":"SLIPPON"},{"code":"9329","category":"SLIPPON"},{"code":"9330","category":"SLIPPON"},{"code":"9331","category":"SLIPPON"},{"code":"9332","category":"SLIPPON"},{"code":"9333","category":"SLIPPON"},{"code":"9334","category":"SLIPPON"},{"code":"9335","category":"SLIPPON"},{"code":"9336","category":"SLIPPON"},{"code":"9337","category":"SLIPPON"},{"code":"9338","category":"SLIPPON"},{"code":"9339","category":"SLIPPON"},{"code":"9340","category":"SLIPPON"},{"code":"9341","category":"SLIPPON"},{"code":"9342","category":"SANDLE"},{"code":"2000","category":"SANDLE"},{"code":"2005","category":"SANDLE"},{"code":"2006","category":"SANDLE"},{"code":"2007","category":"SLIPPON"},{"code":"2008","category":"SANDLE"},{"code":"2009","category":"SLIPPON"},{"code":"2010(S)","category":"SANDLE"},{"code":"2010(L)","category":"SANDLE"},{"code":"2011(S)","category":"SANDLE"},{"code":"2011(L)","category":"SANDLE"},{"code":"2012","category":"SANDLE"},{"code":"2013(S)","category":"SANDLE"},{"code":"2013(L)","category":"SANDLE"},{"code":"2014(S)","category":"SLIPPON"},{"code":"2014(L)","category":"SLIPPON"},{"code":"2015","category":"SANDLE"},{"code":"2016(S)","category":"SLIPPON"},{"code":"2016(L)","category":"SLIPPON"},{"code":"2017(S)","category":"SANDLE"},{"code":"2017(L)","category":"SANDLE"},{"code":"2019","category":"SLIPPON"},{"code":"2020(S)","category":"SANDLE"},{"code":"2020(L)","category":"SANDLE"},{"code":"2021","category":"SANDLE"},{"code":"2022","category":"SLIPPON"},{"code":"2023","category":"SLIPPON"},{"code":"2024","category":"SLIPPON"},{"code":"2025","category":"SLIPPON"},{"code":"2026","category":"SLIPPON"},{"code":"2027","category":"SLIPPON"},{"code":"2028","category":"SANDLE"},{"code":"2029","category":"SANDLE"},{"code":"2030","category":"SANDLE"},{"code":"2031","category":"SANDLE"},{"code":"2032","category":"SANDLE"},{"code":"2033","category":"SANDLE"},{"code":"1052","category":"SLIPPON"},{"code":"1053","category":"SLIPPON"},{"code":"1059","category":"SANDLE"},{"code":"1060","category":"SLIPPON"},{"code":"1055","category":"SANDLE"},{"code":"1061","category":"SLIPPON"},{"code":"1062","category":"SLIPPON"},{"code":"1065","category":"SLIPPON"},{"code":"1066","category":"SLIPPON"},{"code":"1058","category":"SANDLE"},{"code":"1067","category":"SANDLE"},{"code":"1068","category":"SANDLE"},{"code":"1079","category":"SLIPPON"},{"code":"1080","category":"SLIPPON"},{"code":"1081","category":"SLIPPON"},{"code":"1083","category":"SLIPPON"},{"code":"1084","category":"SLIPPON"},{"code":"1088","category":"SLIPPON"},{"code":"1086","category":"SANDLE"},{"code":"1089","category":"SLIPPON"},{"code":"1090","category":"SLIPPON"},{"code":"1091","category":"SLIPPON"},{"code":"1092","category":"SLIPPON"},{"code":"1093","category":"SLIPPON"},{"code":"1094","category":"SLIPPON"},{"code":"1095","category":"SLIPPON"},{"code":"1096","category":"SLIPPON"},{"code":"1097","category":"SLIPPON"},{"code":"1098","category":"SLIPPON"},{"code":"1099","category":"SLIPPON"},{"code":"2301","category":"SHOE"},{"code":"2302","category":"SHOE"},{"code":"2303","category":"SHOE"},{"code":"2304","category":"SHOE"},{"code":"2305","category":"SHOE"},{"code":"2306","category":"SHOE"},{"code":"2307","category":"SHOE"},{"code":"2308","category":"SHOE"},{"code":"2309","category":"SHOE"},{"code":"2310","category":"SHOE"},{"code":"2311","category":"SHOE"},{"code":"2312","category":"SHOE"},{"code":"2313","category":"SHOE"},{"code":"2314","category":"SHOE"},{"code":"2315","category":"SHOE"},{"code":"2317","category":"SHOE"},{"code":"2401","category":"SHOE"},{"code":"2403","category":"SHOE"},{"code":"2408","category":"SHOE"},{"code":"2402","category":"SHOE"},{"code":"2405","category":"SHOE"},{"code":"2406","category":"SHOE"},{"code":"2318","category":"SHOE"},{"code":"2410","category":"SHOE"},{"code":"2411","category":"SHOE"},{"code":"2412","category":"SHOE"},{"code":"2413","category":"SHOE"},{"code":"2501","category":"COAT SHOE"},{"code":"2623","category":"SHOE"},{"code":"2620","category":"SHOE"},{"code":"2621","category":"SHOE"},{"code":"2624","category":"SHOE"},{"code":"2660","category":"SHOE"},{"code":"2661","category":"SHOE"},{"code":"2662","category":"SHOE"},{"code":"2664","category":"SHOE"},{"code":"2663","category":"SHOE"},{"code":"2665","category":"SHOE"},{"code":"2610","category":"SHOE"},{"code":"2414","category":"SHOE"},{"code":"2666","category":"SHOE"},{"code":"5050","category":"SHOE"},{"code":"5051","category":"SHOE"},{"code":"5052","category":"SHOE"},{"code":"5053","category":"SHOE"},{"code":"5054","category":"SHOE"},{"code":"5055","category":"SHOE"},{"code":"5056","category":"SHOE"},{"code":"5057","category":"SHOE"},{"code":"5058","category":"SHOE"},{"code":"2315(S)","category":"SHOE"},{"code":"2315(L)","category":"SHOE"}]', true, 512, JSON_THROW_ON_ERROR);
        DB::transaction(function () use ($catalog): void {
            foreach ($catalog as $entry) {
                $name = Str::title(Str::lower($entry['category']));
                if ($name === 'Slippon') $name = 'Slipon';
                DB::table('articles')->where('code', $entry['code'])->update([
                    'name' => $name, 'category' => $entry['category'], 'updated_at' => now(),
                ]);
            }
            $tables = Schema::getConnection()->getDriverName() === 'sqlite'
                ? array_map(fn ($row) => $row->name, DB::select("SELECT name FROM sqlite_master WHERE type = 'table'"))
                : array_map(fn ($row) => array_values((array) $row)[0], DB::select('SHOW TABLES'));
            foreach (DB::table('articles')->whereRaw('UPPER(category) = ?', ['UNCATEGORIZED'])->get() as $article) {
                $referenced = false;
                foreach ($tables as $table) {
                    if (Schema::hasColumn($table, 'article_id') && DB::table($table)->where('article_id', $article->id)->exists()) {
                        $referenced = true;
                        break;
                    }
                }
                if ($referenced) {
                    // Preserve financial/stock history if the live database has acquired links.
                    DB::table('articles')->where('id', $article->id)->update(['category' => '', 'status' => 'inactive', 'updated_at' => now()]);
                } else {
                    DB::table('articles')->where('id', $article->id)->delete();
                }
            }
            DB::table('catalog_terms')->where('kind', 'category')->whereRaw('UPPER(name) = ?', ['UNCATEGORIZED'])->delete();
        });
    }

    public function down(): void
    {
        // Do not recreate obsolete catalogue entries or undo verified names.
    }
};
