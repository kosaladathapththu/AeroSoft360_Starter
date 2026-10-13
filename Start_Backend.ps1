$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'backend')
$php = 'D:\Software\Xammp\php\php.exe'

if (-not (Test-Path -LiteralPath $php)) {
    throw "XAMPP PHP was not found at $php"
}

& $php artisan serve --host=127.0.0.1 --port=8000
