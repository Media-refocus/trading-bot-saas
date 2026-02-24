# Trading Bot SaaS

Bot de operativa que se conecta al SaaS para recibir señales.

## Instalación

```bash
# 1. Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o
venv\Scripts\activate  # Windows

# 2. Instalar dependencias
pip install -r requirements.txt
```

## Configuración

### Modo SaaS (recomendado)

El bot se autentica con el SaaS y recibe configuración automáticamente.

```bash
# Variables de entorno
export MT5_LOGIN=12345678
export MT5_PASSWORD="tu_password"
export MT5_SERVER="VTMarkets-Live"
export MT5_PATH="C:/Program Files/VTMarkets/MetaTrader5/terminal64.exe"

# Ejecutar
python trading_bot_saas.py --api-key tb_tu_api_key --saas-url https://tu-saas.com
```

### Modo Legacy (YAML)

El bot lee configuración de un archivo YAML local (como el bot original).

```bash
python trading_bot_saas.py --config copiador.yml
```

## Argumentos

| Argumento | Descripción |
|-----------|-------------|
| `--api-key` | API key del SaaS |
| `--saas-url` | URL del SaaS (default: http://localhost:3000) |
| `--config` | Archivo YAML de configuración (modo legacy) |
| `--mt5-login` | Login de MT5 (sobrescribe YAML/env) |
| `--mt5-password` | Password de MT5 |
| `--mt5-server` | Servidor de MT5 |
| `--mt5-path` | Ruta al ejecutable de MT5 |
| `--symbol` | Símbolo a operar (default: XAUUSD) |

## Flujo de operación

```
1. Bot se autentica con el SaaS usando API key
2. Recibe configuración (lotaje, niveles, trailing SL)
3. Consulta señales pendientes cada 2 segundos
4. Ejecuta señales (BUY/SELL/CLOSE_RANGE)
5. Gestiona grid de promedios
6. Envía heartbeat cada 30 segundos con estado
```

## Logs

Los logs se guardan en `logs/bot_{login}.log`

## Fallback

Si el SaaS no responde:
- El bot continúa operando con la última configuración conocida
- Mantiene las posiciones abiertas
- Reintenta conexión periódicamente

## Ejemplo de uso con VPS

```bash
# En el VPS del cliente
cd /opt/trading-bot
source venv/bin/activate

# Crear servicio systemd
sudo cat > /etc/systemd/system/trading-bot.service << EOF
[Unit]
Description=Trading Bot SaaS
After=network.target

[Service]
Type=simple
User=trading
WorkingDirectory=/opt/trading-bot
Environment="MT5_LOGIN=12345678"
Environment="MT5_PASSWORD=secret"
Environment="MT5_SERVER=VTMarkets-Live"
ExecStart=/opt/trading-bot/venv/bin/python trading_bot_saas.py --api-key tb_xxx --saas-url https://saas.com
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable trading-bot
sudo systemctl start trading-bot
```

## Seguridad

- La API key **nunca** se guarda en archivos
- Credenciales MT5 se pasan por variables de entorno
- El bot no expone ningún puerto
- Comunicación con SaaS por HTTPS
