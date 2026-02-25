# Test completo con ticks REALES
Write-Host "=== TEST COMPLETO CON TICKS REALES ===" -ForegroundColor Green

# Verificar servidor
Write-Host "`n1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.getCacheStatus' -TimeoutSec 5
    Write-Host "   Servidor OK" -ForegroundColor Green
} catch {
    Write-Host "   ERROR: Servidor no responde" -ForegroundColor Red
    exit 1
}

# Estado inicial del cache
Write-Host "`n2. Estado inicial del cache:" -ForegroundColor Yellow
$cache1 = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.getCacheStatus' -TimeoutSec 10
$s1 = $cache1.result.data.json
Write-Host "   isLoaded: $($s1.isLoaded)"
Write-Host "   totalDays: $($s1.totalDays)"

# Inicializar cache de ticks (puede tardar 1-2 minutos)
Write-Host "`n3. Inicializando cache de ticks (espera 2 min)..." -ForegroundColor Yellow
$initSw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $initResult = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.initCache' -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 180
    $initSw.Stop()
    $init = $initResult.result.data.json
    Write-Host "   Tiempo: $($initSw.ElapsedMilliseconds)ms" -ForegroundColor Cyan
    Write-Host "   isLoaded: $($init.isLoaded)"
    Write-Host "   totalDays: $($init.totalDays)"
    Write-Host "   totalTicks: $($init.totalTicks)"
} catch {
    $initSw.Stop()
    Write-Host "   TIMEOUT despues de $($initSw.ElapsedMilliseconds)ms" -ForegroundColor Red
    Write-Host "   El cache tarda mucho en inicializar"
}

# Estado final del cache
Write-Host "`n4. Estado final del cache:" -ForegroundColor Yellow
$cache2 = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.getCacheStatus' -TimeoutSec 10
$s2 = $cache2.result.data.json
Write-Host "   isLoaded: $($s2.isLoaded)"
Write-Host "   totalDays: $($s2.totalDays)"
Write-Host "   totalTicks: $($s2.totalTicks)"

# Si el cache está listo, ejecutar backtest con ticks reales
if ($s2.isLoaded) {
    Write-Host "`n5. Backtest con 5 señales y ticks REALES:" -ForegroundColor Yellow
    $body = @{
        json = @{
            config = @{
                strategyName = "GRID_8_REAL"
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
    $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.execute' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 120
    $sw.Stop()
    $r = $response.result.data.json
    Write-Host "   Tiempo: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Cyan
    Write-Host "   FromCache: $($r.fromCache)"
    Write-Host "   Trades: $($r.results.totalTrades)"
    Write-Host "   Profit: $([math]::Round($r.results.totalProfit, 2))"
    Write-Host "   MaxDD: $([math]::Round($r.results.maxDrawdown, 2))"
} else {
    Write-Host "`n5. Cache no listo - no se puede ejecutar backtest con ticks reales" -ForegroundColor Red
}

Write-Host "`n=== FIN ===" -ForegroundColor Green
