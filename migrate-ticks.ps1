# Migración de ticks con memoria aumentada
$env:NODE_OPTIONS = "--max-old-space-size=8192"
Set-Location "C:\Users\guill\Projects\trading-bot-saas"
npx tsx scripts/migrate-ticks-to-sqlite.ts
