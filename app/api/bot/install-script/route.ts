import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/bot/install-script?platform=windows|linux
 * Genera un script de instalacion personalizado con la API key del usuario
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform") || "windows";

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: { include: { botConfigs: true } } },
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const botConfig = user.tenant.botConfigs[0];
    if (!botConfig) {
      return NextResponse.json(
        { error: "Primero debes generar una API key" },
        { status: 400 }
      );
    }

    // Obtener el hostname del SaaS
    const saasUrl = process.env.NEXTAUTH_URL || "https://tu-saas.com";
    const host = new URL(saasUrl).host;

    if (platform === "windows") {
      return generateWindowsScript(host);
    } else if (platform === "linux") {
      return generateLinuxScript(host);
    } else {
      return NextResponse.json({ error: "Plataforma no soportada" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error generando script:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

function generateWindowsScript(host: string): NextResponse {
  const date = new Date().toISOString();

  const script = `# Trading Bot SaaS - Instalador Windows (Personalizado)
# =======================================
# Descargado desde: ${host}
# Fecha: ${date}
#
# IMPORTANTE: Reemplaza TU_API_KEY_AQUI con tu API key real
# Puedes ver tu API key en: https://${host}/setup

param(
    [Parameter(Mandatory=$false)]
    [string]$ApiKey = "TU_API_KEY_AQUI",

    [string]$SaasUrl = "https://${host}",

    [string]$InstallPath = "C:\\TradingBot",

    [string]$Mt5Path = "",

    [switch]$SkipMt5Check,

    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step { param($msg) Write-Host "\\n> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "[X] $msg" -ForegroundColor Red }

if ($ApiKey -eq "TU_API_KEY_AQUI") {
    Write-Error "Debes proporcionar tu API key."
    Write-Host "Opciones:" -ForegroundColor Yellow
    Write-Host "  1. Ejecuta: .\\install.ps1 -ApiKey 'tb_tu_api_key_aqui'" -ForegroundColor Gray
    Write-Host "  2. Edita este archivo y reemplaza TU_API_KEY_AQUI" -ForegroundColor Gray
    Write-Host "\\nConsigue tu API key en: https://${host}/setup" -ForegroundColor Cyan
    exit 1
}

Write-Host "========================================" -ForegroundColor White
Write-Host "   TRADING BOT SAAS - Instalador" -ForegroundColor White
Write-Host "========================================" -ForegroundColor White
Write-Host "  SaaS: ${host}" -ForegroundColor Gray
Write-Host "  Directorio: $InstallPath" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor White

Write-Step "Verificando sistema..."
if (-not [Environment]::Is64BitOperatingSystem) {
    Write-Error "Se requiere sistema de 64 bits"
    exit 1
}
Write-Success "Sistema de 64 bits"

Write-Step "Creando directorio..."
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}
Write-Success "Directorio creado: $InstallPath"

Write-Step "Descargando bot..."
$botUrl = "https://raw.githubusercontent.com/Media-refocus/trading-saas/main/bot-saas/trading_bot_saas.py"
$requirementsUrl = "https://raw.githubusercontent.com/Media-refocus/trading-saas/main/bot-saas/requirements.txt"

try {
    Invoke-WebRequest -Uri $botUrl -OutFile "$InstallPath\\trading_bot_saas.py" -UseBasicParsing
    Invoke-WebRequest -Uri $requirementsUrl -OutFile "$InstallPath\\requirements.txt" -UseBasicParsing
    Write-Success "Bot descargado"
} catch {
    Write-Error "Error descargando bot: $_"
    exit 1
}

Write-Step "Creando entorno Python..."
$venvPath = "$InstallPath\\venv"
if (-not (Test-Path $venvPath)) {
    python -m venv $venvPath
}
Write-Success "Entorno virtual creado"

Write-Step "Instalando dependencias..."
& "$venvPath\\Scripts\\pip.exe" install -r "$InstallPath\\requirements.txt" --quiet
Write-Success "Dependencias instaladas"

Write-Step "Creando configuracion..."
$envContent = @”
# Trading Bot SaaS - Configuracion
# Completa con tus credenciales MT5

MT5_LOGIN=
MT5_PASSWORD=
MT5_SERVER=
MT5_PATH=

# API del SaaS (NO MODIFICAR)
SAAS_URL=$SaasUrl
API_KEY=$ApiKey
“@
$envPath = "$InstallPath\\.env"
$envContent | Out-File -FilePath $envPath -Encoding UTF8
Write-Success "Archivo .env creado”

Write-Step "Creando scripts de inicio..."
$startBat = "@echo off
cd /d $InstallPath
call venv\\Scripts\\activate.bat
python trading_bot_saas.py"
$startBat | Out-File -FilePath "$InstallPath\\iniciar-bot.bat" -Encoding ASCII
Write-Success "Scripts creados"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   INSTALACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Directorio: $InstallPath"
Write-Host ""
Write-Host "PROXIMOS PASOS:"
Write-Host ""
Write-Host "1. Edita el archivo .env con tus credenciales MT5"
Write-Host "2. Ejecuta iniciar-bot.bat para iniciar el bot"
Write-Host "3. Verifica en https://${host}/setup que esta conectado"
Write-Host ""
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"install-trading-bot.ps1\"",
    },
  });
}

function generateLinuxScript(host: string): NextResponse {
  const date = new Date().toISOString();

  const script = `#!/bin/bash
# Trading Bot SaaS - Instalador Linux (Personalizado)
# =======================================
# Descargado desde: ${host}
# Fecha: ${date}
#
# IMPORTANTE: Ejecuta con tu API key como argumento
# ./install.sh tb_tu_api_key_aqui

set -e

API_KEY="\${1:-}"
SAAS_URL="https://${host}"
INSTALL_DIR="/opt/trading-bot"
SERVICE_USER="trading"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

log_info() { echo -e "\${GREEN}[INFO]\${NC} $1"; }
log_warn() { echo -e "\${YELLOW}[WARN]\${NC} $1"; }
log_error() { echo -e "\${RED}[ERROR]\${NC} $1"; }

if [ -z "$API_KEY" ]; then
    log_error "Debes proporcionar tu API key."
    echo "Uso: ./install.sh tb_tu_api_key_aqui"
    echo "Consigue tu API key en: https://${host}/setup"
    exit 1
fi

echo "========================================"
echo "   TRADING BOT SAAS - Instalador"
echo "========================================"
echo "  SaaS: ${host}"
echo "  Directorio: $INSTALL_DIR"
echo "========================================"

if [ "$EUID" -ne 0 ]; then
    log_error "Ejecuta como root: sudo ./install.sh"
    exit 1
fi

log_info "Creando usuario del servicio..."
if ! id -u $SERVICE_USER >/dev/null 2>&1; then
    useradd -r -s /bin/false $SERVICE_USER
fi

log_info "Creando directorio..."
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

log_info "Descargando bot..."
BOT_URL="https://raw.githubusercontent.com/Media-refocus/trading-saas/main/bot-saas/trading_bot_saas.py"
REQUIREMENTS_URL="https://raw.githubusercontent.com/Media-refocus/trading-saas/main/bot-saas/requirements.txt"

curl -sSL $BOT_URL -o trading_bot_saas.py
curl -sSL $REQUIREMENTS_URL -o requirements.txt

log_info "Instalando dependencias..."
python3 -m venv venv
./venv/bin/pip install -q -r requirements.txt

log_info "Creando configuracion..."
cat > .env << EOF
# Trading Bot SaaS - Configuracion
MT5_LOGIN=
MT5_PASSWORD=
MT5_SERVER=

SAAS_URL=$SAAS_URL
API_KEY=$API_KEY
EOF

log_info "Creando servicio systemd..."
cat > /etc/systemd/system/trading-bot.service << EOF
[Unit]
Description=Trading Bot SaaS
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/venv/bin/python trading_bot_saas.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
chmod 600 $INSTALL_DIR/.env

systemctl daemon-reload
systemctl enable trading-bot

echo ""
echo -e "\${GREEN}========================================\${NC}"
echo -e "\${GREEN}   INSTALACION COMPLETADA\${NC}"
echo -e "\${GREEN}========================================\${NC}"
echo ""
echo "Directorio: $INSTALL_DIR"
echo ""
echo "PROXIMOS PASOS:"
echo "1. Edita $INSTALL_DIR/.env con tus credenciales MT5"
echo "2. sudo systemctl start trading-bot"
echo "3. sudo systemctl status trading-bot"
echo "4. Verifica en https://${host}/setup que esta conectado"
echo ""
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"install-trading-bot.sh\"",
    },
  });
}
