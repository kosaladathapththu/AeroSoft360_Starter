$ErrorActionPreference = 'Stop'

$mysqlServer = 'D:\Software\Xammp\mysql\bin\mysqld.exe'
$configuration = 'D:\Software\Xammp\mysql\bin\my.ini'

if (-not (Test-Path -LiteralPath $mysqlServer)) {
    throw "XAMPP MariaDB was not found at $mysqlServer"
}

if (Get-NetTCPConnection -State Listen -LocalPort 3306 -ErrorAction SilentlyContinue) {
    Write-Host 'MariaDB is already running on port 3306.'
    exit 0
}

Start-Process -FilePath $mysqlServer -ArgumentList "--defaults-file=$configuration" -WorkingDirectory (Split-Path $mysqlServer) -WindowStyle Hidden
Write-Host 'MariaDB is starting on port 3306.'
