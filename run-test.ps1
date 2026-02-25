$ErrorActionPreference = 'Continue'
$VerbosePreference = 'Continue'

$json = Get-Content -Raw 'C:\Users\guill\Projects\trading-bot-saas\test-backtest.json'
Write-Host '=== BACKTEST CON 20 SENALES ===' -ForegroundColor Green

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$response = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.execute' -Method POST -Body $json -ContentType 'application/json' -TimeoutSec 90
$sw.Stop()

Write-Host "Tiempo: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Yellow
$r = $response.result.data.json
Write-Host "FromCache: $($r.fromCache)"
Write-Host "Trades: $($r.results.totalTrades)"
Write-Host "Profit: $($r.results.totalProfit)"
Write-Host "WinRate: $($r.results.winRate)%"
Write-Host "MaxDD: $($r.results.maxDrawdown)"
