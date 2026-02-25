param(
    [int]$MaxIterations = 15,
    [int]$DelaySeconds = 10,
    [switch]$Monitor
)

$LogFile = Join-Path $PSScriptRoot "ralph-fix-chart.log"
$ProjectDir = $PSScriptRoot

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    if ($Monitor) { Write-Host $logEntry }
}

Write-Log "=== RALPH FIX CHART INICIADO ==="
Write-Log "Directorio: $ProjectDir"

# CAMBIAR AL DIRECTORIO DEL PROYECTO
Set-Location $ProjectDir

# PROMPT PARA GLM-5
$prompt = @"
Eres un agente de desarrollo autonomo. Tu trabajo es fixear el crash del grafico de velas MT5.

== PASO 1: CAMBIAR AL DIRECTORIO DEL PROYECTO ==
EJECUTA: cd C:\Users\guill\Projects\trading-bot-saas

== PASO 2: LEER ARCHIVOS OBLIGATORIOS ==
EJECUTA ESTOS COMANDOS:
- Read .ralph/PROMPT-FIX-CHART.md
- Read components/simple-candle-chart.tsx
- Read app/(dashboard)/backtester/page.tsx (buscar TradeChartWrapper)

== PASO 3: IDENTIFICAR PROBLEMAS ==
Busca TODOS los posibles puntos de fallo:
- Accesos a trade.* sin null checks
- Operaciones con NaN
- Fechas invalidas
- Canvas con dimensiones 0

== PASO 4: IMPLEMENTAR FIXES ==
Segun el orden en PROMPT-FIX-CHART.md, implementa cada fix:
- Fix 1: Validacion defensiva
- Fix 2: Validar datos antes de generar ticks
- Fix 3: Proteger renderizado del canvas
- Fix 4: Proteger TradeChartWrapper

== PASO 5: COMMIT ==
Despues de cada fix:
- git add <archivos>
- git commit -m "fix: descripcion"

== PASO 6: VERIFICAR ==
Despues de cada commit:
- npx tsc --noEmit

== REGLAS ==
- Siempre usar try-catch
- Siempre validar antes de acceder a propiedades
- Siempre proporcionar fallback
- Un fix = un commit
- Mensajes en espanol

== COMPLETADO ==
Cuando el grafico funcione, responde: RALPH_CHART_FIX_COMPLETE
"@

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Log "--- Iteracion $i de $MaxIterations ---"
    try {
        $cmd = 'cd /d C:\Users\guill\Projects\trading-bot-saas && set "CLAUDECODE=" && claude -p "' + $prompt.Replace('"', '""') + '" --model glm-5 --allowedTools "Bash,Read,Edit,Write,Glob,Grep" --dangerously-skip-permissions'
        $output = & cmd /c $cmd 2>&1 | Out-String
        Write-Log "Output (800 chars): $($output.Substring(0, [Math]::Min(800, $output.Length)))"
        if ($output -match "RALPH_CHART_FIX_COMPLETE") {
            Write-Log "=== RALPH_CHART_FIX_COMPLETE ==="
            break
        }
    } catch {
        Write-Log "ERROR: $_"
    }
    if ($i -lt $MaxIterations) {
        Write-Log "Esperando ${DelaySeconds}s..."
        Start-Sleep -Seconds $DelaySeconds
    }
}
Write-Log "=== RALPH FIX CHART FINALIZADO ==="
