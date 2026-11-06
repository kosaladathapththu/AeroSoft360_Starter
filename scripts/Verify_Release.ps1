param([string]$PhpPath = 'D:\Software\Xammp\php\php.exe')
$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repository
if (-not (Test-Path -LiteralPath $PhpPath)) {
    $installedPhp = Get-Command php -ErrorAction SilentlyContinue
    if (-not $installedPhp) { throw 'PHP was not found. Pass -PhpPath with the installed PHP executable.' }
    $PhpPath = $installedPhp.Source
}
# Explicitly reviewed fixtures. Each uses its own SQLite memory connection.
$fixtures = @(
    'verify_chart_and_cash_flow.php', 'verify_collection_payment.php',
    'verify_connected_workflows.php', 'verify_customer_openings.php',
    'verify_customer_po_export.php', 'verify_customer_profile.php',
    'verify_dashboard.php', 'verify_database_backup.php', 'verify_global_search.php',
    'verify_invoice_bill.php', 'verify_manual_sales_order.php', 'verify_password_reset.php',
    'verify_payment_vouchers.php', 'verify_receivables_import.php',
    'verify_receivable_actions.php', 'verify_sales_order_review.php', 'verify_sales_returns.php',
    'verify_account_hierarchy.php', 'verify_fixed_rates.php', 'verify_purchasing_lineup.php'
)
$dependencies = @{
    'verify_account_hierarchy.php' = 'verify_chart_and_cash_flow.php'
    'verify_fixed_rates.php' = 'verify_manual_sales_order.php'
    'verify_purchasing_lineup.php' = 'verify_connected_workflows.php'
}
$logDirectory = Join-Path $repository 'tmp/release-review'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$failures = @()
foreach ($fixture in $fixtures) {
    $isolationFile = if ($dependencies.ContainsKey($fixture)) { $dependencies[$fixture] } else { $fixture }
    $source = Get-Content -LiteralPath (Join-Path 'backend/tests' $isolationFile) -Raw
    if (-not ($source.Contains(':memory:') -and $source.Contains('purge('))) {
        throw "Isolation guard failed for $fixture. No test was run."
    }
    $logPath = Join-Path $logDirectory ($fixture + '.log')
    $output = & $PhpPath (Join-Path 'backend/tests' $fixture) 2>&1
    $testExitCode = $LASTEXITCODE
    $output | Set-Content -LiteralPath $logPath
    $text = $output -join "`n"
    if ($testExitCode -ne 0 -or $text -match '(?m)^In .+ line \d+:|Fatal error|Uncaught|FAIL:') {
        $failures += $fixture
        Write-Output "FAIL $fixture (see $logPath)"
    } else { Write-Output "PASS $fixture" }
}
& npm.cmd --prefix frontend test
if ($LASTEXITCODE -ne 0) { $failures += 'frontend tests' }
& npm.cmd --prefix frontend run build
if ($LASTEXITCODE -ne 0) { $failures += 'frontend production build' }
if ($failures.Count) { throw ('Release verification failed: ' + ($failures -join ', ')) }
Write-Output 'PASS: 20 isolated backend suites, 9 frontend suites and production build.'
