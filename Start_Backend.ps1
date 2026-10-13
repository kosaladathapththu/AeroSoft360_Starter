$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'backend')
php artisan serve --host=127.0.0.1 --port=8000
