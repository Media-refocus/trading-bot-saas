# Test de backtest MIENTRAS se cargan los ticks
Write-Host "=== TEST BACKTEST (durante precarga) ===" -ForegroundColor Green

# Usar puerto 3009 (el que está activo)
$BaseUrl = "http://localhost:3009"

# Ver estado del cache
Write-Host "`n1. Estado del cache:" -ForegroundColor Yellow
$cache = Invoke-RestMethod -Uri "$BaseUrl/api/trpc/backtester.getCacheStatus" -TimeoutSec 10
$s = $cache.result.data.json
Write-Host "   isLoaded: $($s.isLoaded)"
Write-Host "   totalDays: $($s.totalDays)"
Write-Host "   cachedDays: $($s.cachedDays)"
Write-Host "   totalTicks: $($s.totalTicks)"
Write-Host "   memoryMB: $($s.memoryMB)MB"

# Ejecutar backtest con ticks reales (las señales que estén en cache)
Write-Host "`n2. Backtest con ticks reales:" -ForegroundColor Yellow
$body = @{
    json = @{
        config = @{
            strategyName = "GRID_8"
            lotajeBase = 0.03
            numOrders = 1
            pipsDistance = 8
            maxLevels = 35
            takeProfitPips = 8
            useStopLoss = $false
            signalsSource = "signals_simple.csv"
            useRealPrices = $true
        }
    }
} | ConvertTo-Json -Depth 10

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/trpc/backtester.execute" -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 120
    $sw.Stop()
    $r = $response.result.data.json
    Write-Host "   Tiempo: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Cyan
    Write-Host "   FromCache: $($r.fromCache)"
    Write-Host "   Trades: $($r.results.totalTrades)"
    Write-Host "   Profit: $([math]::Round($r.results.totalProfit, 2))"
    Write-Host "   MaxDD: $([math]::Round($r.results.maxDrawdown, 2))"
} catch {
    $sw.Stop()
    Write-Host "   Error despues de $($sw.ElapsedMilliseconds)ms: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== FIN ===" -ForegroundColor Green
