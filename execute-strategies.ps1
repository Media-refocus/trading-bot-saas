param(
    [int]$StartFrom = 1,
    [int]$EndAt = 30
)

$ResultsDir = Join-Path $PSScriptRoot "backtest_results"
$LogFile = Join-Path $PSScriptRoot "strategies-execution.log"

# Asegurar que existe el directorio
if (-not (Test-Path $ResultsDir)) {
    New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    Write-Host $logEntry
}

# Definir las 30 estrategias
$Strategies = @(
    # GRUPO 1: Grid Básico
    @{Num=1; Name="GRID_8"; Grupo="GRID_BASICO"; Config=@{pipsDistance=8; maxLevels=35; takeProfitPips=8; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},
    @{Num=2; Name="GRID_10"; Grupo="GRID_BASICO"; Config=@{pipsDistance=10; maxLevels=30; takeProfitPips=10; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},
    @{Num=3; Name="GRID_12"; Grupo="GRID_BASICO"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},
    @{Num=4; Name="GRID_15"; Grupo="GRID_BASICO"; Config=@{pipsDistance=15; maxLevels=20; takeProfitPips=15; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},
    @{Num=5; Name="GRID_20"; Grupo="GRID_BASICO"; Config=@{pipsDistance=20; maxLevels=15; takeProfitPips=20; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},

    # GRUPO 2: Grid con Stop Loss
    @{Num=6; Name="GRID_SL_50"; Grupo="GRID_SL"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$true; stopLossPips=50}},
    @{Num=7; Name="GRID_SL_100"; Grupo="GRID_SL"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$true; stopLossPips=100}},
    @{Num=8; Name="GRID_SL_200"; Grupo="GRID_SL"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$true; stopLossPips=200}},
    @{Num=9; Name="GRID_SL_DINAMICO"; Grupo="GRID_SL"; Config=@{pipsDistance=10; maxLevels=30; takeProfitPips=10; lotajeBase=0.02; numOrders=1; useStopLoss=$true; stopLossPips=150}},
    @{Num=10; Name="GRID_TRAILING"; Grupo="GRID_SL"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=0; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},

    # GRUPO 3: Multi-Order
    @{Num=11; Name="MULTI_2"; Grupo="MULTI_ORDER"; Config=@{pipsDistance=12; maxLevels=20; takeProfitPips=12; lotajeBase=0.02; numOrders=2; useStopLoss=$false; stopLossPips=0}},
    @{Num=12; Name="MULTI_3"; Grupo="MULTI_ORDER"; Config=@{pipsDistance=12; maxLevels=15; takeProfitPips=12; lotajeBase=0.015; numOrders=3; useStopLoss=$false; stopLossPips=0}},
    @{Num=13; Name="MULTI_2_TIGHT"; Grupo="MULTI_ORDER"; Config=@{pipsDistance=8; maxLevels=25; takeProfitPips=8; lotajeBase=0.02; numOrders=2; useStopLoss=$false; stopLossPips=0}},
    @{Num=14; Name="MULTI_3_TIGHT"; Grupo="MULTI_ORDER"; Config=@{pipsDistance=8; maxLevels=20; takeProfitPips=8; lotajeBase=0.015; numOrders=3; useStopLoss=$false; stopLossPips=0}},

    # GRUPO 4: Scalping
    @{Num=15; Name="SCALP_5"; Grupo="SCALPING"; Config=@{pipsDistance=5; maxLevels=40; takeProfitPips=5; lotajeBase=0.03; numOrders=1; useStopLoss=$true; stopLossPips=30}},
    @{Num=16; Name="SCALP_8"; Grupo="SCALPING"; Config=@{pipsDistance=8; maxLevels=35; takeProfitPips=8; lotajeBase=0.03; numOrders=1; useStopLoss=$true; stopLossPips=40}},
    @{Num=17; Name="SCALP_AGRESIVO"; Grupo="SCALPING"; Config=@{pipsDistance=5; maxLevels=50; takeProfitPips=5; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},

    # GRUPO 5: Swing
    @{Num=18; Name="SWING_20"; Grupo="SWING"; Config=@{pipsDistance=15; maxLevels=20; takeProfitPips=20; lotajeBase=0.03; numOrders=1; useStopLoss=$true; stopLossPips=100}},
    @{Num=19; Name="SWING_30"; Grupo="SWING"; Config=@{pipsDistance=20; maxLevels=15; takeProfitPips=30; lotajeBase=0.03; numOrders=1; useStopLoss=$true; stopLossPips=150}},
    @{Num=20; Name="SWING_50"; Grupo="SWING"; Config=@{pipsDistance=25; maxLevels=12; takeProfitPips=50; lotajeBase=0.03; numOrders=1; useStopLoss=$true; stopLossPips=200}},

    # GRUPO 6: Promedios Inteligentes (usar config base por ahora)
    @{Num=21; Name="SMART_CLOSE_BASE"; Grupo="SMART"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},
    @{Num=22; Name="SMART_COMPENSATE"; Grupo="SMART"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},
    @{Num=23; Name="SMART_REENTRY"; Grupo="SMART"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},
    @{Num=24; Name="SMART_DYNAMIC_DIST"; Grupo="SMART"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},
    @{Num=25; Name="SMART_RISK_MGMT"; Grupo="SMART"; Config=@{pipsDistance=12; maxLevels=25; takeProfitPips=12; lotajeBase=0.03; numOrders=1; useStopLoss=$false; stopLossPips=0}},

    # GRUPO 7: Conservadoras
    @{Num=26; Name="CONSERV_5"; Grupo="CONSERVADOR"; Config=@{pipsDistance=15; maxLevels=10; takeProfitPips=20; lotajeBase=0.02; numOrders=1; useStopLoss=$true; stopLossPips=50}},
    @{Num=27; Name="CONSERV_10"; Grupo="CONSERVADOR"; Config=@{pipsDistance=20; maxLevels=8; takeProfitPips=25; lotajeBase=0.02; numOrders=1; useStopLoss=$true; stopLossPips=60}},
    @{Num=28; Name="CONSERV_PROM"; Grupo="CONSERVADOR"; Config=@{pipsDistance=15; maxLevels=5; takeProfitPips=30; lotajeBase=0.025; numOrders=1; useStopLoss=$true; stopLossPips=40}},

    # GRUPO 8: Agresivas
    @{Num=29; Name="AGRESIVO_1"; Grupo="AGRESIVO"; Config=@{pipsDistance=8; maxLevels=40; takeProfitPips=8; lotajeBase=0.04; numOrders=1; useStopLoss=$false; stopLossPips=0}},
    @{Num=30; Name="AGRESIVO_2"; Grupo="AGRESIVO"; Config=@{pipsDistance=10; maxLevels=35; takeProfitPips=10; lotajeBase=0.05; numOrders=1; useStopLoss=$true; stopLossPips=200}}
)

$AllResults = @()

Write-Log "=== INICIANDO EJECUCION DE ESTRATEGIAS $StartFrom a $EndAt ==="

foreach ($Strategy in $Strategies | Where-Object { $_.Num -ge $StartFrom -and $_.Num -le $EndAt }) {
    Write-Log "Ejecutando estrategia $($Strategy.Num): $($Strategy.Name)"

    $RequestBody = @{
        "0" = @{
            json = @{
                config = @{
                    strategyName = $Strategy.Name
                    lotajeBase = $Strategy.Config.lotajeBase
                    numOrders = $Strategy.Config.numOrders
                    pipsDistance = $Strategy.Config.pipsDistance
                    maxLevels = $Strategy.Config.maxLevels
                    takeProfitPips = $Strategy.Config.takeProfitPips
                    useStopLoss = $Strategy.Config.useStopLoss
                    stopLossPips = $Strategy.Config.stopLossPips
                    signalsSource = "signals_parsed.csv"
                    useRealPrices = $true
                }
                signalLimit = 50
            }
        }
    }

    $JsonBody = $RequestBody | ConvertTo-Json -Depth 10

    try {
        $Response = Invoke-RestMethod -Uri "http://localhost:3000/api/trpc/backtester.execute?batch=1" `
            -Method POST `
            -ContentType "application/json" `
            -Body $JsonBody `
            -TimeoutSec 600

        $Result = $Response[0].result.data.json

        $ResultObject = @{
            strategyName = $Strategy.Name
            grupo = $Strategy.Grupo
            num = $Strategy.Num
            config = $Strategy.Config
            results = $Result.results
            timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
        }

        $AllResults += $ResultObject

        # Guardar resultado individual
        $FileName = "estrategia_$($Strategy.Num.ToString('00'))_$($Strategy.Name).json"
        $FilePath = Join-Path $ResultsDir $FileName
        $ResultObject | ConvertTo-Json -Depth 10 | Out-File -FilePath $FilePath -Encoding UTF8

        Write-Log "  OK - Trades: $($Result.results.totalTrades), Profit: `$$([math]::Round($Result.results.totalProfit, 2)), WinRate: $([math]::Round($Result.results.winRate * 100, 1))%"

    } catch {
        Write-Log "  ERROR: $_"
    }

    # Pequeña pausa entre requests
    Start-Sleep -Milliseconds 500
}

# Guardar comparación general
$ComparisonFile = Join-Path $ResultsDir "strategies_comparison.json"
$AllResults | ConvertTo-Json -Depth 10 | Out-File -FilePath $ComparisonFile -Encoding UTF8
Write-Log "Guardado: strategies_comparison.json"

Write-Log "=== EJECUCION COMPLETADA ==="
Write-Log "Total estrategias ejecutadas: $($AllResults.Count)"

# Generar ranking por profit
$RankedByProfit = $AllResults | Sort-Object { $_.results.totalProfit } -Descending
$ProfitRanking = "# Ranking por Profit`n`n| Pos | Estrategia | Grupo | Profit | Trades | Win Rate | Max DD |`n|-----|-----------|-------|--------|--------|----------|--------|`n"
$Pos = 1
foreach ($R in $RankedByProfit) {
    $ProfitRanking += "| $Pos | $($R.strategyName) | $($R.grupo) | `$$([math]::Round($R.results.totalProfit, 2)) | $($R.results.totalTrades) | $([math]::Round($R.results.winRate * 100, 1))% | `$$([math]::Round($R.results.maxDrawdown, 2)) |`n"
    $Pos++
}
$ProfitRanking | Out-File -FilePath (Join-Path $ResultsDir "ranking_profit.md") -Encoding UTF8
Write-Log "Guardado: ranking_profit.md"

# Generar ranking por win rate
$RankedByWinRate = $AllResults | Sort-Object { $_.results.winRate } -Descending
$WinRateRanking = "# Ranking por Win Rate`n`n| Pos | Estrategia | Grupo | Win Rate | Profit | Trades | Max DD |`n|-----|-----------|-------|----------|--------|--------|--------|`n"
$Pos = 1
foreach ($R in $RankedByWinRate) {
    $WinRateRanking += "| $Pos | $($R.strategyName) | $($R.grupo) | $([math]::Round($R.results.winRate * 100, 1))% | `$$([math]::Round($R.results.totalProfit, 2)) | $($R.results.totalTrades) | `$$([math]::Round($R.results.maxDrawdown, 2)) |`n"
    $Pos++
}
$WinRateRanking | Out-File -FilePath (Join-Path $ResultsDir "ranking_winrate.md") -Encoding UTF8
Write-Log "Guardado: ranking_winrate.md"

# Generar ranking por drawdown (menor es mejor)
$RankedByDD = $AllResults | Sort-Object { $_.results.maxDrawdown }
$DDRanking = "# Ranking por Drawdown (menor es mejor)`n`n| Pos | Estrategia | Grupo | Max DD | Profit | Win Rate | Trades |`n|-----|-----------|-------|--------|--------|----------|--------|`n"
$Pos = 1
foreach ($R in $RankedByDD) {
    $DDRanking += "| $Pos | $($R.strategyName) | $($R.grupo) | `$$([math]::Round($R.results.maxDrawdown, 2)) | `$$([math]::Round($R.results.totalProfit, 2)) | $([math]::Round($R.results.winRate * 100, 1))% | $($R.results.totalTrades) |`n"
    $Pos++
}
$DDRanking | Out-File -FilePath (Join-Path $ResultsDir "ranking_drawdown.md") -Encoding UTF8
Write-Log "Guardado: ranking_drawdown.md"

# Identificar mejor estrategia general (score combinado)
$ScoredResults = $AllResults | ForEach-Object {
    $ProfitScore = if ($_.results.totalProfit -gt 0) { 50 } elseif ($_.results.totalProfit -gt -500) { 25 } else { 0 }
    $WinRateScore = $_.results.winRate * 30
    $DDScore = if ($_.results.maxDrawdown -lt 500) { 20 } elseif ($_.results.maxDrawdown -lt 1000) { 10 } else { 0 }
    $_ | Add-Member -NotePropertyName "Score" -NotePropertyValue ($ProfitScore + $WinRateScore + $DDScore) -PassThru
}
$BestStrategy = $ScoredResults | Sort-Object { $_.Score } -Descending | Select-Object -First 1

$BestReport = "# Mejor Estrategia`n`n"
$BestReport += "## $($BestStrategy.strategyName) (Grupo: $($BestStrategy.grupo))`n`n"
$BestReport += "### Configuracion`n"
$BestReport += "- pipsDistance: $($BestStrategy.config.pipsDistance)`n"
$BestReport += "- maxLevels: $($BestStrategy.config.maxLevels)`n"
$BestReport += "- takeProfitPips: $($BestStrategy.config.takeProfitPips)`n"
$BestReport += "- lotajeBase: $($BestStrategy.config.lotajeBase)`n"
$BestReport += "- numOrders: $($BestStrategy.config.numOrders)`n"
$BestReport += "- useStopLoss: $($BestStrategy.config.useStopLoss)`n"
if ($BestStrategy.config.useStopLoss) {
    $BestReport += "- stopLossPips: $($BestStrategy.config.stopLossPips)`n"
}
$BestReport += "`n### Resultados`n"
$BestReport += "- **Profit Total:** `$$([math]::Round($BestStrategy.results.totalProfit, 2))`n"
$BestReport += "- **Profit en Pips:** $([math]::Round($BestStrategy.results.totalProfitPips, 1))`n"
$BestReport += "- **Total Trades:** $($BestStrategy.results.totalTrades)`n"
$BestReport += "- **Win Rate:** $([math]::Round($BestStrategy.results.winRate * 100, 1))%`n"
$BestReport += "- **Max Drawdown:** `$$([math]::Round($BestStrategy.results.maxDrawdown, 2))`n"
$BestReport += "- **Profit Factor:** $([math]::Round($BestStrategy.results.profitFactor, 2))`n"
$BestReport += "`n### Score: $([math]::Round($BestStrategy.Score, 1))/100`n"

$BestReport | Out-File -FilePath (Join-Path $ResultsDir "MEJOR_ESTRATEGIA.md") -Encoding UTF8
Write-Log "Guardado: MEJOR_ESTRATEGIA.md"

# Analisis por grupo
$GroupAnalysis = "# Analisis por Grupo`n`n"
$Groups = $AllResults | Group-Object grupo
foreach ($G in $Groups | Sort-Object Name) {
    $AvgProfit = ($G.Group | Measure-Object { $_.results.totalProfit } -Average).Average
    $AvgWinRate = ($G.Group | Measure-Object { $_.results.winRate } -Average).Average
    $AvgDD = ($G.Group | Measure-Object { $_.results.maxDrawdown } -Average).Average

    $GroupAnalysis += "## $($G.Name)`n"
    $GroupAnalysis += "- Estrategias: $($G.Count)`n"
    $GroupAnalysis += "- Profit Promedio: `$$([math]::Round($AvgProfit, 2))`n"
    $GroupAnalysis += "- Win Rate Promedio: $([math]::Round($AvgWinRate * 100, 1))%`n"
    $GroupAnalysis += "- Drawdown Promedio: `$$([math]::Round($AvgDD, 2))`n"
    $GroupAnalysis += "- Estrategias:`n"
    foreach ($S in $G.Group) {
        $GroupAnalysis += "  - $($S.strategyName): `$$([math]::Round($S.results.totalProfit, 2))`n"
    }
    $GroupAnalysis += "`n"
}
$GroupAnalysis | Out-File -FilePath (Join-Path $ResultsDir "analisis_por_grupo.md") -Encoding UTF8
Write-Log "Guardado: analisis_por_grupo.md"

# Recomendaciones por perfil de riesgo
$Recommendations = "# Recomendaciones por Perfil de Riesgo`n`n"

$Conservatives = $AllResults | Where-Object { $_.grupo -eq "CONSERVADOR" -or $_.results.maxDrawdown -lt 500 } | Sort-Object { $_.results.totalProfit } -Descending | Select-Object -First 3
$Recommendations += "## Perfil Conservador`n"
$Recommendations += "Busca bajo drawdown y ganancias estables.`n`n"
foreach ($S in $Conservatives) {
    $Recommendations += "- **$($S.strategyName)**: Profit `$$([math]::Round($S.results.totalProfit, 2)), Max DD `$$([math]::Round($S.results.maxDrawdown, 2))`n"
}

$Balanced = $AllResults | Where-Object { $_.results.maxDrawdown -ge 500 -and $_.results.maxDrawdown -lt 1500 -and $_.results.totalProfit -gt 0 } | Sort-Object { $_.results.totalProfit } -Descending | Select-Object -First 3
$Recommendations += "`n## Perfil Balanceado`n"
$Recommendations += "Equilibrio entre riesgo y retorno.`n`n"
foreach ($S in $Balanced) {
    $Recommendations += "- **$($S.strategyName)**: Profit `$$([math]::Round($S.results.totalProfit, 2)), Max DD `$$([math]::Round($S.results.maxDrawdown, 2))`n"
}

$Aggressive = $AllResults | Where-Object { $_.grupo -eq "AGRESIVO" -or $_.results.totalProfit -gt 1000 } | Sort-Object { $_.results.totalProfit } -Descending | Select-Object -First 3
$Recommendations += "`n## Perfil Agresivo`n"
$Recommendations += "Maximiza ganancias asumiendo mas riesgo.`n`n"
foreach ($S in $Aggressive) {
    $Recommendations += "- **$($S.strategyName)**: Profit `$$([math]::Round($S.results.totalProfit, 2)), Max DD `$$([math]::Round($S.results.maxDrawdown, 2))`n"
}

$Recommendations | Out-File -FilePath (Join-Path $ResultsDir "recomendaciones.md") -Encoding UTF8
Write-Log "Guardado: recomendaciones.md"

Write-Log "=== TODOS LOS ARCHIVOS GENERADOS ==="
