# Ejecutar 30 estrategias con ticks sintéticos (RAPIDO)
# Tiempo estimado: 2-3 minutos para todas las estrategias

$ResultsDir = "backtest_results_fast"
$LogFile = "backtests-fast.log"
$BaseUrl = "http://localhost:3000"
$SignalFile = "signals_simple.csv"

# Crear directorio de resultados
if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir | Out-Null
}

# Inicializar log
"" | Out-File $LogFile

# 30 Estrategias a probar
$Strategies = @(
    @{Num=1;  Name="GRID_8";       Config=@{strategyName="GRID_8";       pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=2;  Name="GRID_10";      Config=@{strategyName="GRID_10";      pipsDistance=10; maxLevels=30; takeProfitPips=10; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=3;  Name="GRID_12";      Config=@{strategyName="GRID_12";      pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=4;  Name="GRID_15";      Config=@{strategyName="GRID_15";      pipsDistance=15; maxLevels=20; takeProfitPips=15; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=5;  Name="GRID_20";      Config=@{strategyName="GRID_20";      pipsDistance=20; maxLevels=15; takeProfitPips=20; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=6;  Name="GRID_SL_50";   Config=@{strategyName="GRID_SL_50";   pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$true;  stopLossPips=50;  signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=7;  Name="GRID_SL_100";  Config=@{strategyName="GRID_SL_100";  pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$true;  stopLossPips=100; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=8;  Name="GRID_SL_200";  Config=@{strategyName="GRID_SL_200";  pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$true;  stopLossPips=200; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=9;  Name="MULTI_2";      Config=@{strategyName="MULTI_2";      pipsDistance=10; maxLevels=25; takeProfitPips=10; lotajeBase=0.02; numOrders=2; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=10; Name="MULTI_3";      Config=@{strategyName="MULTI_3";      pipsDistance=12; maxLevels=20; takeProfitPips=12; lotajeBase=0.02; numOrders=3; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=11; Name="SCALP_5";      Config=@{strategyName="SCALP_5";      pipsDistance=5;  maxLevels=45; takeProfitPips=5;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=12; Name="SCALP_8";      Config=@{strategyName="SCALP_8";      pipsDistance=8;  maxLevels=35; takeProfitPips=8;  lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=13; Name="SWING_20";     Config=@{strategyName="SWING_20";     pipsDistance=20; maxLevels=15; takeProfitPips=20; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=14; Name="SWING_30";     Config=@{strategyName="SWING_30";     pipsDistance=30; maxLevels=12; takeProfitPips=30; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}},
    @{Num=15; Name="SWING_50";     Config=@{strategyName="SWING_50";     pipsDistance=50; maxLevels=10; takeProfitPips=50; lotajeBase=0.03; numOrders=1; useStopLoss=$false; signalsSource=$SignalFile; useRealPrices=$false}}
)

function Log-Write {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    Write-Host $logEntry
}

function Run-Backtest {
    param(
        [int]$StrategyNum,
        [string]$StrategyName,
        [hashtable]$Config
    )

    $body = @{
        json = @{
            config = $Config
        }
    } | ConvertTo-Json -Depth 10

    $url = "$BaseUrl/api/trpc/backtester.execute"

    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60

        $results = $response.result.data.json.results
        $fromCache = $response.result.data.json.fromCache
        $elapsedMs = $response.result.data.json.elapsedMs

        return @{
            Success = $true
            Trades = $results.totalTrades
            Profit = $results.totalProfit
            MaxDD = $results.maxDrawdown
            WinRate = $results.winRate
            Results = $results
            FromCache = $fromCache
            ElapsedMs = $elapsedMs
        }
    } catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Verificar servidor
Log-Write "Verificando servidor..."
try {
    $healthCheck = Invoke-RestMethod -Uri "$BaseUrl/api/trpc/backtester.getCacheStatus" -TimeoutSec 5
    Log-Write "Servidor listo"
} catch {
    Log-Write "ERROR: El servidor no esta corriendo. Ejecuta 'npm run dev' primero."
    exit 1
}

# Main
Log-Write "=== BACKTESTS RAPIDOS (388 senales, ticks sinteticos) ==="
Log-Write "Total estrategias: $($Strategies.Count)"

$allResults = @()
$successCount = 0
$errorCount = 0
$totalTime = 0

foreach ($strategy in $Strategies) {
    $num = $strategy.Num
    $name = $strategy.Name
    $config = $strategy.Config

    Log-Write "Ejecutando estrategia $num/$($Strategies.Count): $name"

    $result = Run-Backtest -StrategyNum $num -StrategyName $name -Config $config

    if ($result.Success) {
        $cacheLabel = if ($result.FromCache) { "(CACHE)" } else { "" }
        Log-Write "  OK $cacheLabel - Trades: $($result.Trades), Profit: `$$([math]::Round($result.Profit, 2)), Max DD: `$$([math]::Round($result.MaxDD, 2))"
        $successCount++
        $totalTime += $result.ElapsedMs

        $allResults += [PSCustomObject]@{
            Num = $num
            Name = $name
            Trades = $result.Trades
            Profit = $result.Profit
            MaxDD = $result.MaxDD
            WinRate = $result.WinRate
            ElapsedMs = $result.ElapsedMs
        }
    } else {
        Log-Write "  ERROR: $($result.Error)"
        $errorCount++
    }
}

# Ranking por profit
$ranking = $allResults | Sort-Object Profit -Descending

$rankingFile = "$ResultsDir/ranking_profit.md"
$rankingContent = "# Ranking por Profit (388 senales, ticks sinteticos)`n`n"
$rankingContent += "Tiempo total: $([math]::Round($totalTime / 1000, 2))s`n`n"
$rankingContent += "| Pos | Estrategia | Profit | Trades | Max DD | WinRate |`n"
$rankingContent += "|-----|-----------|--------|--------|--------|---------|`n"

$rank = 0
foreach ($r in $ranking) {
    $rank++
    $rankingContent += "| $rank | $($r.Name) | `$$([math]::Round($r.Profit, 2)) | $($r.Trades) | `$$([math]::Round($r.MaxDD, 2)) | $([math]::Round($r.WinRate, 1))% |`n"
}
$rankingContent | Out-File $rankingFile -Encoding UTF8

Log-Write "=== BACKTESTS COMPLETADOS ==="
Log-Write "Exitosos: $successCount"
Log-Write "Errores: $errorCount"
Log-Write "Tiempo total: $([math]::Round($totalTime / 1000, 2))s"
Log-Write "Ranking guardado en: $rankingFile"
