$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$phpCandidates = @(
    'D:\laragon\bin\php\php-8.5.4-nts-Win32-vs17-x64\php.exe',
    'D:\Software\Xammp\php\php.exe'
)
$phpRuntime = $phpCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $phpRuntime) { throw 'PHP was not found. Update the PHP path in Start_Local.ps1.' }
$nodeRuntime = (Get-Command node.exe -ErrorAction Stop).Source
$logDirectory = Join-Path $projectRoot 'tmp'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
function Test-LocalPort([int] $portNumber) {
    $connection = New-Object System.Net.Sockets.TcpClient
    try { $connection.Connect('127.0.0.1', $portNumber); return $true }
    catch { return $false }
    finally { $connection.Dispose() }
}
if (-not (Test-LocalPort 3306)) {
    throw 'Start MySQL using XAMPP or Laragon, then run this script again.'
}
if (-not (Test-LocalPort 8000)) {
    Start-Process -FilePath $phpRuntime -ArgumentList '-d', 'error_reporting=8191', 'artisan', 'serve', '--host=127.0.0.1', '--port=8000' `
        -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDirectory 'backend-local.out.log') `
        -RedirectStandardError (Join-Path $logDirectory 'backend-local.err.log') | Out-Null
}
if (-not (Test-LocalPort 5173)) {
    Start-Process -FilePath $nodeRuntime -ArgumentList 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort' `
        -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logDirectory 'frontend-local.out.log') `
        -RedirectStandardError (Join-Path $logDirectory 'frontend-local.err.log') | Out-Null
}
Write-Host 'Open http://127.0.0.1:5173 in your browser. Startup logs are in the tmp folder.'
