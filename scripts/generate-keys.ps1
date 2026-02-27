# ============================================
# Generador de Keys para Produccion
# ============================================
# Ejecutar: powershell -ExecutionPolicy Bypass -File scripts/generate-keys.ps1

Write-Host "=== Generando keys para produccion ===" -ForegroundColor Cyan
Write-Host ""

# AUTH_SECRET (NextAuth)
$authSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
Write-Host "AUTH_SECRET (NextAuth secret):" -ForegroundColor Yellow
Write-Host $authSecret
Write-Host ""

# CREDENTIALS_ENCRYPTION_KEY (64 hex chars)
$encKey = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
Write-Host "CREDENTIALS_ENCRYPTION_KEY (AES-256):" -ForegroundColor Yellow
Write-Host $encKey
Write-Host ""

# BOT_API_KEY
$botKey = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
Write-Host "BOT_API_KEY (para el bot Python):" -ForegroundColor Yellow
Write-Host $botKey
Write-Host ""

Write-Host "=== Copia estas keys a Vercel Environment Variables ===" -ForegroundColor Green
Write-Host ""
Write-Host "Comandos para añadir a Vercel:" -ForegroundColor Cyan
Write-Host "  vercel env add AUTH_SECRET production"
Write-Host "  vercel env add CREDENTIALS_ENCRYPTION_KEY production"
Write-Host "  vercel env add BOT_API_KEY production"
Write-Host ""

# Guardar en archivo
$output = @"
# Keys generadas el $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

AUTH_SECRET="$authSecret"
CREDENTIALS_ENCRYPTION_KEY="$encKey"
BOT_API_KEY="$botKey"
"@

$keysFile = Join-Path $PSScriptRoot "..\generated-keys.txt"
$output | Out-File -FilePath $keysFile -Encoding UTF8

Write-Host "Keys guardadas en: $keysFile" -ForegroundColor Green
Write-Host "IMPORTANTE: No subas este archivo a Git!" -ForegroundColor Red
