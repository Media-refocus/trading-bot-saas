# Trading Bot SaaS - Script de inicio (Windows)
# ================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [string]$SaasUrl = "https://tu-saas.com",

    [Parameter(Mandatory=$true)]
    [string]$Mt5Login,

    [Parameter(Mandatory=$true)]
    [string]$Mt5Password,

    [Parameter(Mandatory=$true)]
    [string]$Mt5Server,

    [string]$Mt5Path = "",

    [string]$Symbol = "XAUUSD"
)

$ErrorActionPreference = "Stop"

# Directorio del script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Verificar Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python no está instalado o no está en PATH" -ForegroundColor Red
    exit 1
}

# Verificar entorno virtual
if (-not (Test-Path "venv\Scripts\activate.ps1")) {
    Write-Host "📦 Creando entorno virtual..." -ForegroundColor Yellow
    python -m venv venv
}

# Activar entorno virtual
& .\venv\Scripts\Activate.ps1

# Instalar dependencias
if (-not (pip show MetaTrader5 -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
    pip install -r requirements.txt
}

# Configurar variables de entorno
$env:MT5_LOGIN = $Mt5Login
$env:MT5_PASSWORD = $Mt5Password
$env:MT5_SERVER = $Mt5Server
if ($Mt5Path) {
    $env:MT5_PATH = $Mt5Path
}

# Ejecutar bot
Write-Host "🚀 Iniciando Trading Bot SaaS..." -ForegroundColor Green
Write-Host "   API Key: $($ApiKey.Substring(0,10))..." -ForegroundColor Gray
Write-Host "   SaaS URL: $SaasUrl" -ForegroundColor Gray
Write-Host "   MT5 Login: $Mt5Login" -ForegroundColor Gray
Write-Host "   MT5 Server: $Mt5Server" -ForegroundColor Gray
Write-Host "   Symbol: $Symbol" -ForegroundColor Gray
Write-Host ""

python trading_bot_saas.py `
    --api-key $ApiKey `
    --saas-url $SaasUrl `
    --symbol $Symbol
