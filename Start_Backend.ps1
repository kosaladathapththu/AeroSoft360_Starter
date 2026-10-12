$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$phpExe = Join-Path $projectRoot '.runtime\php-8.5.11\php.exe'
$artisan = Join-Path $projectRoot 'backend\artisan'

if (-not (Test-Path -LiteralPath $phpExe)) {
    throw "Portable PHP was not found at $phpExe"
}

if (-not (Test-Path -LiteralPath $artisan)) {
    throw "Laravel artisan was not found at $artisan"
}

Set-Location -LiteralPath (Join-Path $projectRoot 'backend')
& $phpExe artisan serve --host=127.0.0.1 --port=8000
