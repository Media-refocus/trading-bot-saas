# Bot de Trading Operativo

Bot Python que se conecta al SaaS para obtener configuración, reportar estado y ejecutar trades en MetaTrader 5.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `bot_operativo.py` | Bot principal con integración SaaS |
| `saas_client.py` | Cliente HTTP para comunicar con el SaaS |
| `requirements.txt` | Dependencias Python |

## Instalación

```bash
# Crear entorno virtual
python -m venv venv
.\venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt
```

## Configuración

### Opción 1: Variables de entorno

```bash
# Windows PowerShell
$env:TRADING_BOT_API_KEY="tb_tu_api_key_aqui"
$env:TRADING_BOT_SAAS_URL="https://tu-saas.com"

# Linux/Mac
export TRADING_BOT_API_KEY="tb_tu_api_key_aqui"
export TRADING_BOT_SAAS_URL="https://tu-saas.com"
```

### Opción 2: Argumentos

```bash
python bot_operativo.py --api-key tb_xxx --saas-url https://tu-saas.com
```

## Ejecución

```bash
# Con variables de entorno
python bot_operativo.py

# Con argumentos
python bot_operativo.py --api-key tb_xxx --saas-url https://tu-saas.com --bot-version 1.0.0
```

## Flujo de datos

```
┌─────────────────┐
│   Dashboard     │ ◄── Usuario configura bot
│   (SaaS)        │
└────────┬────────┘
         │
         ▼ GET /api/bot/config
┌─────────────────┐
│   Bot Python    │ ◄── Obtiene configuración
│   (VPS Cliente) │
└────────┬────────┘
         │
         ├──► Telegram: Escucha señales
         ├──► MT5: Ejecuta trades
         │
         ▼ POST /api/bot/heartbeat (cada 30s)
┌─────────────────┐
│   Dashboard     │ ◄── Usuario ve estado en vivo
│   (SaaS)        │
└─────────────────┘
```

## Diferencias con el bot original

| Característica | Original | Con SaaS |
|---------------|----------|----------|
| Configuración | YAML local | SaaS (API) |
| Estado | JSON local | SaaS + JSON local |
| Monitoring | Logs locales | Dashboard en vivo |
| Control | Manual | Remoto desde dashboard |
| Historial | No persiste | En base de datos SaaS |

## Logs

Los logs se guardan en `logs/bot_{login}.log`:

```bash
# Ver logs en tiempo real
Get-Content logs\bot_123456.log -Wait  # Windows PowerShell
tail -f logs/bot_123456.log            # Linux/Mac
```

## Troubleshooting

### Error: "API key requerida"

```bash
# Verificar variable de entorno
echo $env:TRADING_BOT_API_KEY  # Windows
echo $TRADING_BOT_API_KEY      # Linux/Mac
```

### Error: "MT5 init error"

1. Verificar que MT5 está instalado
2. Verificar credenciales en el dashboard
3. Verificar que el servidor broker está correcto

### Error: "Telegram no configurado"

Configurar Telegram en el dashboard:
1. API ID y API Hash de my.telegram.org
2. Canales a escuchar (ID y access_hash)

## Comandos remotos

El dashboard puede enviar estos comandos:

| Comando | Acción |
|---------|--------|
| `PAUSE` | Deja de operar (no ejecuta nuevas señales) |
| `RESUME` | Reanuda operación normal |
| `CLOSE_ALL` | Cierra todas las posiciones abiertas |
| `UPDATE_CONFIG` | Recarga configuración desde SaaS |
