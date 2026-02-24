# Signal Ingestor - Telegram → SaaS

Escucha señales de Telegram y las envía al SaaS para distribución automática a todos los bots de clientes.

## Instalación

```bash
# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o
venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt
```

## Configuración

1. Copia `config.example.yml` a `ingestor.yml`
2. Configura tus credenciales de Telegram:
   - Obtén `api_id` y `api_hash` en https://my.telegram.org/apps
   - Añade los canales a escuchar (ID y access_hash)

```yaml
telegram:
  api_id: 12345678
  api_hash: "tu_api_hash"
  session: "ingestor_session"
  channels:
    - id: 2164511324
      access_hash: -4688926061597264256

saas:
  url: "http://localhost:3000"
  api_key: ""  # Opcional

options:
  dry_run: false
  log_signals: true
```

## Uso

```bash
# Primera vez (pedirá código de Telegram)
python telegram_to_saas.py --config ingestor.yml

# Siguientes veces
python telegram_to_saas.py --config ingestor.yml
```

## Tipos de señales soportadas

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| `ENTRY` | `BUY/SELL precio XAUUSD` | `BUY 2650.50 XAUUSD` |
| `CLOSE_RANGE` | `cerramos rango` | `Cerramos rango ✅` |
| Restricciones | `RIESGO`, `SIN PROMEDIOS` | `BUY 2650 RIESGO` |

## Formato de señal enviada al SaaS

```json
{
  "type": "ENTRY",
  "side": "BUY",
  "price": 2650.50,
  "symbol": "XAUUSD",
  "restriction": "RIESGO",
  "messageText": "BUY 2650.50 XAUUSD\nRIESGO"
}
```

## Flujo

```
1. Ingestor escucha canales de Telegram
2. Detecta señal (ENTRY/CLOSE_RANGE)
3. Parsea restricciones (RIESGO, SIN_PROMEDIOS)
4. Envía a POST /api/signals/ingest del SaaS
5. SaaS crea GlobalSignal + SignalDelivery para cada tenant activo
6. Bots de clientes consultan GET /api/bot/signals
7. Cada bot ejecuta la señal
```

## Monitoreo

El ingestor muestra estadísticas en tiempo real:
- Mensajes recibidos
- Señales parseadas
- Señales enviadas al SaaS
- Errores

## Modo Dry Run

Para probar sin enviar al SaaS:

```yaml
options:
  dry_run: true
```

## Logs

Los logs se muestran en consola. Para guardar:

```bash
python telegram_to_saas.py --config ingestor.yml 2>&1 | tee ingestor.log
```

## Obtener ID de canal

1. Usa @userinfobot en Telegram
2. Reenvía un mensaje del canal al bot
3. El bot te dará el ID del canal

Para access_hash (canales privados):
- Necesitas usar la API de Telegram
- O puedes omitirlo para canales públicos
