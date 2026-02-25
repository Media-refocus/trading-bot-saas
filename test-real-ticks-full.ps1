# Test con TODAS las señales y ticks REALES
Write-Host "=== BACKTEST COMPLETO CON TICKS REALES ===" -ForegroundColor Green

# Inicializar cache
Write-Host "`n1. Inicializando cache..." -ForegroundColor Yellow
$init = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.initCache' -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 30
Write-Host "   Cache listo: $($init.result.data.json.isLoaded)"
Write-Host "   Dias: $($init.result.data.json.totalDays)"

# Backtest con TODAS las señales (388)
Write-Host "`n2. Backtest con 388 señales y ticks REALES..." -ForegroundColor Yellow
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
$response = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.execute' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 600
$sw.Stop()

$r = $response.result.data.json
Write-Host "   Tiempo: $($sw.ElapsedMilliseconds)ms" -ForegroundColor Cyan
Write-Host "   FromCache: $($r.fromCache)"
Write-Host "   Trades: $($r.results.totalTrades)"
Write-Host "   Profit: $([math]::Round($r.results.totalProfit, 2))"
Write-Host "   MaxDD: $([math]::Round($r.results.maxDrawdown, 2))"
Write-Host "   WinRate: $([math]::Round($r.results.winRate, 1))%"

# Segunda ejecución (debería usar cache de resultados)
Write-Host "`n3. Segunda ejecucion (cache de resultados)..." -ForegroundColor Yellow
$sw2 = [System.Diagnostics.Stopwatch]::StartNew()
$response2 = Invoke-RestMethod -Uri 'http://localhost:3000/api/trpc/backtester.execute' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 60
$sw2.Stop()
Write-Host "   Tiempo: $($sw2.ElapsedMilliseconds)ms" -ForegroundColor Cyan
Write-Host "   FromCache: $($response2.result.data.json.fromCache)"

Write-Host "`n=== FIN ===" -ForegroundColor Green
