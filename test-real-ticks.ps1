# Test con ticks REALES
Write-Host "=== TEST CON TICKS REALES ===" -ForegroundColor Green

# 1. Verificar estado del cache
Write-Host "`n1. Estado del cache:" -ForegroundColor Yellow
$cacheStatus = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.getCacheStatus' -TimeoutSec 10
$status = $cacheStatus.result.data.json
Write-Host "   Cache listo: $($status.isLoaded)"
Write-Host "   Dias indexados: $($status.totalDays)"
Write-Host "   Ticks en cache: $($status.totalTicks)"

# 2. Si no está listo, inicializar
if (-not $status.isLoaded) {
    Write-Host "`n2. Inicializando cache de ticks (esto tarda ~30s)..." -ForegroundColor Yellow
    $initResult = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.initCache' -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 120
    Write-Host "   Cache inicializado: $($initResult.result.data.json.totalDays) dias"
}

# 3. Ejecutar backtest con ticks reales (solo 5 señales para probar)
Write-Host "`n3. Backtest con 5 señales y ticks REALES..." -ForegroundColor Yellow
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
        signalLimit = 5
    }
} | ConvertTo-Json -Depth 10

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.execute' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 300
    $sw.Stop()
    $r = $response.result.data.json
    Write-Host "   Tiempo: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Cyan
    Write-Host "   FromCache: $($r.fromCache)"
    Write-Host "   Trades: $($r.results.totalTrades)"
    Write-Host "   Profit: $($r.results.totalProfit)"
    Write-Host "   MaxDD: $($r.results.maxDrawdown)"
} catch {
    $sw.Stop()
    Write-Host "   ERROR despues de $($sw.ElapsedMilliseconds)ms: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== FIN ===" -ForegroundColor Green
