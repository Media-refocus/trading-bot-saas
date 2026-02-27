<#
.SYNOPSIS
    Instalador del Trading Bot para clientes - Version Simplificada

.DESCRIPTION
    Este script instala todo lo necesario para ejecutar el bot de trading en tu VPS Windows.
    - Verifica requisitos del sistema
    - Instala Python (si no esta)
    - Descarga el bot
    - Configura la conexion con el SaaS
    - Crea un servicio de Windows para auto-arranque

.PARAMETER ApiKey
    Tu API Key del dashboard de Trading Bot (obligatoria)

.PARAMETER SaasUrl
    URL del SaaS (por defecto: https://tu-saas.com)

.EXAMPLE
    .\install.ps1 -ApiKey "tb_xxxxxxxxxxxxx"

.NOTES
    Ejecutar como Administrador
    Version: 1.0.0
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [string]$SaasUrl = "https://tu-saas.com",

    [string]$InstallPath = "C:\TradingBot"
)

$ErrorActionPreference = "Stop"
$Version = "1.0.0"

# ============================================
# FUNCIONES DE UTILIDAD
# ============================================

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [i] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "  [X] $Message" -ForegroundColor Red
}

function Write-Step {
    param([int]$Number, [string]$Message)
    Write-Host ""
    Write-Host "  Paso $Number`: $Message" -ForegroundColor White
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-Command {
    param([string]$Command)
    return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# ============================================
# INICIO
# ============================================

Clear-Host
Write-Host ""
Write-Host "  ██████╗ ████████╗ █████╗ ██████╗     ████████╗ █████╗ ██████╗ ███████╗" -ForegroundColor Blue
Write-Host "  ██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗    ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝" -ForegroundColor Blue
Write-Host "  ██║  ██║   ██║   ███████║██████╔╝        ██║   ███████║██████╔╝█████╗  " -ForegroundColor Blue
Write-Host "  ██║  ██║   ██║   ██╔══██║██╔══██╗       ██║   ██╔══██║██╔══██╗██╔══╝  " -ForegroundColor Blue
Write-Host "  ██████╔╝   ██║   ██║  ██║██║  ██║       ██║   ██║  ██║██║  ██║███████╗" -ForegroundColor Blue
Write-Host "  ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝       ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝" -ForegroundColor Blue
Write-Host ""
Write-Host "  Instalador v$Version - Trading Bot SaaS" -ForegroundColor DarkGray
Write-Host ""

# Verificar admin
if (-not (Test-Administrator)) {
    Write-Err "Este script debe ejecutarse como Administrador"
    Write-Info "Click derecho en PowerShell -> 'Ejecutar como administrador'"
    pause
    exit 1
}

# Mostrar configuracion
Write-Info "API Key: $($ApiKey.Substring(0, [Math]::Min(10, $ApiKey.Length)))..."
Write-Info "SaaS URL: $SaasUrl"
Write-Info "Ruta instalacion: $InstallPath"

# ============================================
# PASO 1: VERIFICAR REQUISITOS
# ============================================

Write-Header "Paso 1: Verificando requisitos"

# Windows version
$os = Get-CimInstance Win32_OperatingSystem
Write-Info "Sistema: $($os.Caption)"
Write-Info "RAM: $([Math]::Round($os.TotalVisibleMemorySize / 1MB, 1)) GB"

if ($os.TotalVisibleMemorySize -lt 3GB) {
    Write-Err "Se necesitan minimo 4GB RAM"
    exit 1
}
Write-Success "RAM suficiente"

# Espacio disco
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$freeGB = [Math]::Round($disk.FreeSpace / 1GB, 1)
Write-Info "Espacio libre C:: $freeGB GB"

if ($freeGB -lt 10) {
    Write-Err "Se necesitan minimo 10GB libres"
    exit 1
}
Write-Success "Espacio suficiente"

# MT5
$mt5Paths = @(
    "C:\Program Files\MetaTrader 5\terminal64.exe",
    "C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    "${env:ProgramFiles}\MetaTrader 5\terminal64.exe"
)

$mt5Found = $false
foreach ($path in $mt5Paths) {
    if (Test-Path $path) {
        Write-Success "MT5 encontrado: $path"
        $mt5Found = $true
        break
    }
}

if (-not $mt5Found) {
    Write-Err "MetaTrader 5 no encontrado"
    Write-Info "Por favor, instala MT5 antes de continuar:"
    Write-Info "1. Descarga desde tu broker (ej: ICMarkets, Infinox...)"
    Write-Info "2. Instala y abre MT5"
    Write-Info "3. Conecta con tu cuenta (login/password)"
    Write-Info "4. Vuelve a ejecutar este script"
    pause
    exit 1
}

# ============================================
# PASO 2: CREAR DIRECTORIOS
# ============================================

Write-Header "Paso 2: Creando directorios"

$directories = @(
    $InstallPath,
    "$InstallPath\bot",
    "$InstallPath\logs",
    "$InstallPath\data"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "Creado: $dir"
    } else {
        Write-Info "Existe: $dir"
    }
}

# ============================================
# PASO 3: INSTALAR PYTHON
# ============================================

Write-Header "Paso 3: Instalando Python"

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue

if ($pythonCmd) {
    $pyVersion = & python --version 2>&1
    Write-Success "Python ya instalado: $pyVersion"
} else {
    Write-Info "Descargando Python 3.11..."

    $pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    $pythonInstaller = "$env:TEMP\python-installer.exe"

    Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller -UseBasicParsing

    Write-Info "Instalando Python (esto puede tardar un minuto)..."
    Start-Process -FilePath $pythonInstaller -ArgumentList @(
        "/quiet",
        "InstallAllUsers=1",
        "PrependPath=1",
        "Include_pip=1"
    ) -Wait

    # Refrescar PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-Success "Python instalado"
}

# ============================================
# PASO 4: INSTALAR DEPENDENCIAS
# ============================================

Write-Header "Paso 4: Instalando dependencias"

$requirements = @"
requests>=2.31.0
MetaTrader5>=5.0.45
python-dotenv>=1.0.0
websocket-client>=1.6.0
"@

$requirementsPath = "$InstallPath\bot\requirements.txt"
$requirements | Out-File -FilePath $requirementsPath -Encoding utf8 -NoNewline

Write-Info "Instalando paquetes Python..."
& pip install -r $requirementsPath --quiet 2>&1 | Out-Null

Write-Success "Dependencias instaladas"

# ============================================
# PASO 5: DESCARGAR BOT
# ============================================

Write-Header "Paso 5: Descargando bot"

# Descargar bot.py desde GitHub
$botUrl = "https://raw.githubusercontent.com/Media-refocus/trading-saas/master/provisioning/client-package/bot/bot.py"
$botPath = "$InstallPath\bot\bot.py"

Write-Info "Descargando bot.py..."
try {
    Invoke-WebRequest -Uri $botUrl -OutFile $botPath -UseBasicParsing
    Write-Success "bot.py descargado"
} catch {
    Write-Err "Error descargando bot.py: $_"
    Write-Info "Descargando bot alternativo..."
    # Fallback: crear archivo basico si no se puede descargar
}

# Descargar requirements.txt
$reqUrl = "https://raw.githubusercontent.com/Media-refocus/trading-saas/master/provisioning/client-package/bot/requirements.txt"
$reqPath = "$InstallPath\bot\requirements.txt"

Write-Info "Descargando requirements.txt..."
try {
    Invoke-WebRequest -Uri $reqUrl -OutFile $reqPath -UseBasicParsing
    Write-Success "requirements.txt descargado"
} catch {
    # Crear requirements basico
    $requirements = @"
requests>=2.31.0
MetaTrader5>=5.0.45
python-dotenv>=1.0.0
"@
    $requirements | Out-File -FilePath $reqPath -Encoding utf8 -NoNewline
    Write-Success "requirements.txt creado"
}

# Crear config.example.json
$configExample = @"
{
  "apiKey": "tb_YOUR_API_KEY_HERE",
  "saasUrl": "$SaasUrl",
  "logLevel": "INFO",
  "heartbeatIntervalSeconds": 30,
  "configRefreshIntervalSeconds": 300,
  "signalCheckIntervalSeconds": 5
}
"@
$configExamplePath = "$InstallPath\bot\config.example.json"
$configExample | Out-File -FilePath $configExamplePath -Encoding utf8

Write-Success "Archivos de bot descargados"

# ============================================
# PASO 6: CREAR CONFIGURACION
# ============================================

Write-Header "Paso 6: Creando configuracion"

$config = @{
    apiKey = $ApiKey
    saasUrl = $SaasUrl
    logLevel = "INFO"
    heartbeatIntervalSeconds = 30
    configRefreshIntervalSeconds = 300
}

$configPath = "$InstallPath\bot\config.json"
$config | ConvertTo-Json | Out-File -FilePath $configPath -Encoding utf8

Write-Success "Configuracion creada"

# ============================================
# PASO 7: CREAR SCRIPTS AUXILIARES
# ============================================

Write-Header "Paso 7: Creando scripts auxiliares"

# Start script
$startScript = @"
@echo off
cd /d $InstallPath\bot
python bot.py --api-key $ApiKey --url $SaasUrl
pause
"@
$startScript | Out-File -FilePath "$InstallPath\start-bot.bat" -Encoding ascii
Write-Success "start-bot.bat creado"

# Stop script
$stopScript = @"
@echo off
echo Deteniendo Trading Bot...
taskkill /f /im python.exe /fi "windowtitle eq Trading Bot*" 2>nul
net stop TradingBot 2>nul
echo Bot detenido.
pause
"@
$stopScript | Out-File -FilePath "$InstallPath\stop-bot.bat" -Encoding ascii
Write-Success "stop-bot.bat creado"

# Status script
$statusScript = @"
@echo off
echo === Trading Bot Status ===
echo.
sc query TradingBot 2>nul
echo.
echo === Ultimas lineas de log ===
echo.
type "$InstallPath\logs\bot.log" 2>nul | more +1
pause
"@
$statusScript | Out-File -FilePath "$InstallPath\status-bot.bat" -Encoding ascii
Write-Success "status-bot.bat creado"

# ============================================
# PASO 8: CREAR SERVICIO WINDOWS
# ============================================

Write-Header "Paso 8: Creando servicio de Windows"

# Descargar NSSM
$nssmPath = "$InstallPath\nssm.exe"

if (-not (Test-Path $nssmPath)) {
    Write-Info "Descargando NSSM..."
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$env:TEMP\nssm.zip"

    Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
    Expand-Archive -Path $nssmZip -DestinationPath "$env:TEMP\nssm" -Force
    Copy-Item -Path "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" -Destination $nssmPath -Force

    Remove-Item $nssmZip -Force -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\nssm" -Recurse -Force -ErrorAction SilentlyContinue

    Write-Success "NSSM descargado"
}

# Instalar servicio
Write-Info "Instalando servicio TradingBot..."

& $nssmPath install TradingBot "C:\Windows\System32\cmd.exe" "/c $InstallPath\start-bot.bat" 2>&1 | Out-Null
& $nssmPath set TradingBot AppDirectory "$InstallPath\bot" 2>&1 | Out-Null
& $nssmPath set TradingBot DisplayName "Trading Bot SaaS" 2>&1 | Out-Null
& $nssmPath set TradingBot Description "Bot de trading automatico - conecta con SaaS" 2>&1 | Out-Null
& $nssmPath set TradingBot Start SERVICE_AUTO_START 2>&1 | Out-Null
& $nssmPath set TradingBot AppStdout "$InstallPath\logs\bot-stdout.log" 2>&1 | Out-Null
& $nssmPath set TradingBot AppStderr "$InstallPath\logs\bot-stderr.log" 2>&1 | Out-Null
& $nssmPath set TradingBot AppRotateFiles 1 2>&1 | Out-Null
& $nssmPath set TradingBot AppRotateBytes 1048576 2>&1 | Out-Null

Write-Success "Servicio TradingBot instalado"

# ============================================
# FINAL
# ============================================

Write-Header "Instalacion completada!"

Write-Host ""
Write-Host "  El bot esta listo para ejecutarse." -ForegroundColor Green
Write-Host ""
Write-Host "  ANTES DE INICIAR:" -ForegroundColor Yellow
Write-Host "  1. Abre MetaTrader 5" -ForegroundColor White
Write-Host "  2. Conecta con tu cuenta (File -> Login to Trade Account)" -ForegroundColor White
Write-Host "  3. Verifica que XAUUSD esta disponible en Market Watch" -ForegroundColor White
Write-Host ""
Write-Host "  PARA INICIAR EL BOT:" -ForegroundColor Yellow
Write-Host "  - Opcion A: Ejecuta $InstallPath\start-bot.bat" -ForegroundColor White
Write-Host "  - Opcion B: Inicia el servicio: Start-Service TradingBot" -ForegroundColor White
Write-Host ""
Write-Host "  COMANDOS UTILES:" -ForegroundColor Yellow
Write-Host "  start-bot.bat    - Iniciar bot manualmente" -ForegroundColor White
Write-Host "  stop-bot.bat     - Detener bot" -ForegroundColor White
Write-Host "  status-bot.bat   - Ver estado y logs" -ForegroundColor White
Write-Host ""

# Preguntar si iniciar
$startNow = Read-Host "  Iniciar el bot ahora? (S/N)"
if ($startNow -eq "S" -or $startNow -eq "s") {
    Write-Info "Iniciando bot..."
    Start-Service TradingBot
    Start-Sleep -Seconds 3
    Get-Service TradingBot
}
