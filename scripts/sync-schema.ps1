# ============================================
# Sincronizador de Schemas Prisma
# ============================================
# Convierte schema.prisma (SQLite) a schema.postgresql.prisma
# Uso: powershell -ExecutionPolicy Bypass -File scripts/sync-schema.ps1

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot

Write-Host "=== Sincronizando schemas ===" -ForegroundColor Cyan

$sourceSchema = "$ProjectDir\prisma\schema.prisma"
$targetSchema = "$ProjectDir\prisma\schema.postgresql.prisma"

# Verificar que existe el source
if (-not (Test-Path $sourceSchema)) {
    Write-Host "ERROR: No existe $sourceSchema" -ForegroundColor Red
    exit 1
}

# Leer schema source
$content = Get-Content $sourceSchema -Raw

# Conversiones SQLite -> PostgreSQL
# 1. Cambiar provider
$content = $content -replace 'provider = "sqlite"', 'provider = "postgresql"'

# 2. Cambiar Float a Double (PostgreSQL usa Double para float8)
$content = $content -replace '\bFloat\b', 'Double'

# 3. Cambiar Int @id @default(autoincrement()) a BigInt para tablas grandes
# (TickData necesita BigInt)

# 4. Añadir índices si no existen (PostgreSQL se beneficia más de índices)

# Guardar backup
if (Test-Path $targetSchema) {
    $backup = "$targetSchema.backup"
    Copy-Item $targetSchema $backup -Force
    Write-Host "Backup creado: $backup" -ForegroundColor Gray
}

# Guardar nuevo schema
$content | Set-Content $targetSchema -Encoding UTF8

Write-Host "Schema sincronizado: $targetSchema" -ForegroundColor Green
Write-Host ""
Write-Host "NOTA: Revisa el schema generado para asegurarte de que es correcto" -ForegroundColor Yellow
Write-Host ""
