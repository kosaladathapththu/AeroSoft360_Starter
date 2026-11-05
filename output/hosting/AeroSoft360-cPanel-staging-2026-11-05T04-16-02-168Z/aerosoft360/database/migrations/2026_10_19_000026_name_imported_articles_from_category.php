<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        $articleIds = DB::table("article_set_items as items")
            ->join("article_set_templates as sets", "sets.id", "=", "items.set_template_id")
            ->whereNotNull("items.source_row")
            ->distinct()
            ->pluck("sets.article_id");

        DB::table("articles")
            ->whereIn("id", $articleIds)
            ->orderBy("id")
            ->each(function (object $article): void {
                if (!$article->category || strtoupper($article->category) === "UNCATEGORIZED") {
                    return;
                }

                $name = Str::title(Str::lower($article->category));
                if (strcasecmp($name, "Slippon") === 0) {
                    $name = "Slipon";
                }

                DB::table("articles")
                    ->where("id", $article->id)
                    ->update([
                        "name" => $name,
                        "updated_at" => now(),
                    ]);
            });
    }

    public function down(): void
    {
        // Imported article codes remain available if a previous display name is needed.
    }
};
