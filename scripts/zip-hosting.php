<?php
// Archive only a build directory under this repository's output/hosting area.
if (PHP_SAPI !== 'cli') exit(1);
$base = realpath(__DIR__ . '/../output/hosting');
$root = realpath($argv[1] ?? '');
$archive = $argv[2] ?? '';
if (!$base || !$root || dirname($root) !== $base || realpath(dirname($archive)) !== $base || is_file($archive)) {
    fwrite(STDERR, "Refusing an invalid or existing archive target.\n"); exit(1);
}
$zip = new ZipArchive();
if ($zip->open($archive, ZipArchive::CREATE | ZipArchive::EXCL) !== true) exit(1);
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
$count = 0;
foreach ($files as $file) {
    if (!$file->isFile() || $file->isLink()) continue;
    $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($root) + 1));
    if (basename($relative) === '.env' || preg_match('/\.(sql|sqlite|log)$/i', $relative)) {
        $zip->close(); fwrite(STDERR, "Unexpected private data in staging package.\n"); exit(1);
    }
    $zip->addFile($file->getPathname(), $relative);
    $count++;
}
$zip->close();
echo "Archived $count files, including hidden Apache/environment template files.\n";
