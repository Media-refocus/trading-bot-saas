# ============================================
# Script de Deploy - Trading Bot SaaS
# ============================================
# Uso: powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 [-SkipSchema]

param(
    [switch]$SkipSchema,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot

Write-Host "=== Trading Bot SaaS - Deploy Script ===" -ForegroundColor Cyan
Write-Host "Directorio: $ProjectDir"
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "$ProjectDir\package.json")) {
    Write-Host "ERROR: No encuentro package.json" -ForegroundColor Red
    exit 1
}

Set-Location $ProjectDir

# Paso 1: Cambiar schema a PostgreSQL
if (-not $SkipSchema) {
    Write-Host "[1/6] Cambiando schema a PostgreSQL..." -ForegroundColor Yellow

    if (Test-Path "prisma\schema.postgresql.prisma") {
        Copy-Item "prisma\schema.postgresql.prisma" "prisma\schema.prisma" -Force
        Write-Host "  Schema cambiado a PostgreSQL" -ForegroundColor Green
    } else {
        Write-Host "  ADVERTENCIA: No existe schema.postgresql.prisma" -ForegroundColor Red
    }
} else {
    Write-Host "[1/6] Skip cambio de schema" -ForegroundColor Gray
}

# Paso 2: Verificar variables de entorno
Write-Host "[2/6] Verificando variables de entorno..." -ForegroundColor Yellow

$envExample = Get-Content ".env.production.example" -ErrorAction SilentlyContinue
$requiredVars = @("DATABASE_URL", "AUTH_SECRET", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL", "CREDENTIALS_ENCRYPTION_KEY")

Write-Host "  Variables requeridas:" -ForegroundColor Gray
foreach ($var in $requiredVars) {
    Write-Host "    - $var" -ForegroundColor Gray
}

# Paso 3: Generar cliente Prisma
Write-Host "[3/6] Generando cliente Prisma..." -ForegroundColor Yellow

if (-not $DryRun) {
    npx prisma generate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR al generar Prisma client" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Prisma client generado" -ForegroundColor Green
} else {
    Write-Host "  [DRY RUN] npx prisma generate" -ForegroundColor Gray
}

# Paso 4: Build de Next.js
Write-Host "[4/6] Build de Next.js..." -ForegroundColor Yellow

if (-not $DryRun) {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR en el build" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Build completado" -ForegroundColor Green
} else {
    Write-Host "  [DRY RUN] npm run build" -ForegroundColor Gray
}

# Paso 5: Deploy a Vercel
Write-Host "[5/6] Deploy a Vercel..." -ForegroundColor Yellow

if (-not $DryRun) {
    vercel --prod
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR en el deploy" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Deploy completado!" -ForegroundColor Green
} else {
    Write-Host "  [DRY RUN] vercel --prod" -ForegroundColor Gray
}

# Paso 6: Recordatorio de migraciones
Write-Host "[6/6] Migraciones de DB..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  IMPORTANTE: Ejecuta las migraciones manualmente:" -ForegroundColor Cyan
Write-Host "  1. vercel env pull .env.production.local" -ForegroundColor White
Write-Host "  2. npx prisma migrate deploy" -ForegroundColor White
Write-Host ""

Write-Host "=== Deploy completado! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Verifica que la app funciona: https://tu-dominio.vercel.app"
Write-Host "  2. Crea un usuario de prueba"
Write-Host "  3. Configura Stripe cuando tengas la cuenta"
Write-Host ""
