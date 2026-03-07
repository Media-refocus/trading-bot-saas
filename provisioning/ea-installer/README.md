# Instalador del EA - Trading Bot SaaS

Esta carpeta contiene los instaladores plug & play del Expert Advisor (EA) para Trading Bot SaaS.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `install-ea.ps1` | Instalador para Windows VPS (PowerShell) |
| `install-ea.sh` | Instalador para Linux VPS (Bash) |

---

## Instalación Rápida

### Windows VPS

```powershell
# Abrir PowerShell como Administrador
# Descargar el script
Invoke-WebRequest -Uri "https://tu-saas.com/downloads/install-ea.ps1" -OutFile "install-ea.ps1"

# Ejecutar con tu API key
.\install-ea.ps1 -ApiKey "tb_tu_api_key_aqui"
```

### Linux VPS

```bash
# Descargar el script
curl -o install-ea.sh https://tu-saas.com/downloads/install-ea.sh
chmod +x install-ea.sh

# Ejecutar con tu API key
./install-ea.sh --api-key "tb_tu_api_key_aqui"
```

---

## Requisitos Previos

### Windows VPS

- Windows Server 2012 R2 o superior
- MetaTrader 4 o MetaTrader 5 instalado
- Cuenta de trading activa con tu broker
- API Key de Trading Bot SaaS (obtenida del dashboard)

### Linux VPS

- Distribución Linux moderna (Ubuntu 20.04+, CentOS 7+, Debian 10+)
- Wine instalado (para ejecutar MT4/MT5)
- MetaTrader 4 o MetaTrader 5 instalado via Wine
- Cuenta de trading activa con tu broker
- API Key de Trading Bot SaaS (obtenida del dashboard)

---

## Opciones del Instalador

### Windows (PowerShell)

```powershell
.\install-ea.ps1 -ApiKey "xxx"                    # Instalación básica
.\install-ea.ps1 -ApiKey "xxx" -Platform mt5      # Forzar MT5
.\install-ea.ps1 -ApiKey "xxx" -Platform mt4      # Forzar MT4
.\install-ea.ps1 -ApiKey "xxx" -StartTerminal     # Abrir MT al terminar
.\install-ea.ps1 -ApiKey "xxx" -BrokerPath "C:\Program Files\ICMarkets - MetaTrader 5"
```

| Parámetro | Descripción | Requerido |
|-----------|-------------|-----------|
| `-ApiKey` | API Key del dashboard TBS | **Sí** |
| `-Platform` | Plataforma: `mt4`, `mt5` o `auto` | No (default: auto) |
| `-SaasUrl` | URL del servidor SaaS | No |
| `-BrokerPath` | Ruta personalizada de MT4/MT5 | No |
| `-Force` | Forzar si el terminal está abierto | No |
| `-StartTerminal` | Abrir el terminal al terminar | No |

### Linux (Bash)

```bash
./install-ea.sh --api-key "xxx"                   # Instalación básica
./install-ea.sh --api-key "xxx" --platform mt5    # Forzar MT5
./install-ea.sh --api-key "xxx" --start           # Abrir MT al terminar
./install-ea.sh --api-key "xxx" --mt-path "~/.wine/drive_c/Program Files/MetaTrader 5"
```

| Parámetro | Descripción | Requerido |
|-----------|-------------|-----------|
| `--api-key` | API Key del dashboard TBS | **Sí** |
| `--platform` | Plataforma: `mt4`, `mt5` o `auto` | No (default: auto) |
| `--saas-url` | URL del servidor SaaS | No |
| `--mt-path` | Ruta personalizada de MT4/MT5 | No |
| `--force` | Forzar si el terminal está abierto | No |
| `--start` | Abrir el terminal al terminar | No |

---

## Pasos Post-Instalación

### 1. Configurar WebRequest (Solo la primera vez)

Después de instalar el EA, necesitas permitir que MetaTrader se conecte a internet:

1. Abre MetaTrader
2. Ve a **Herramientas → Opciones → Asesores Expertos**
3. Activa **"Permitir solicitudes Web para URL listadas"**
4. Añade la URL: `https://trading-bot-saas.vercel.app`
5. Click en **OK**

### 2. Cargar el EA

1. Abre el gráfico de **XAUUSD** (cualquier timeframe)
2. En el **Navegador** (panel izquierdo), expande **Asesores Expertos**
3. Arrastra **TBSSignalEA** al gráfico
4. En la ventana de configuración:
   - En la pestaña **Inputs**, introduce tu API Key
   - ApiKey = `tb_tu_api_key_aqui`
   - Click en **OK**

### 3. Activar AutoTrading

1. Click en el botón **AutoTrading** en la barra superior (debe quedar verde)
2. Sonrisa :) en la esquina superior derecha del gráfico indica que el EA está activo

---

## Verificar que el EA Funciona

### Indicadores de éxito:

- En la pestaña **Experts** del terminal, verás:
  ```
  TBS EA iniciado | Cuenta: 12345678 | Servidor: https://trading-bot-saas.vercel.app
  TBS EA | Conexión OK. Esperando señales...
  ```

- Cada 30 segundos verás:
  ```
  TBS EA | Heartbeat enviado OK
  ```

### Si hay errores:

| Error | Causa | Solución |
|-------|-------|----------|
| `401: API key inválida` | API key incorrecta o expirada | Verifica tu suscripción en el dashboard |
| `403: Cuenta no autorizada` | Número de cuenta no registrado | Añade tu cuenta MT en el dashboard |
| `No se puede conectar` | WebRequest no configurado | Configura la URL en Opciones |
| `WebRequest error` | URL no permitida | Añade la URL en Opciones |

---

## Flujo de Compra

1. **Cliente compra suscripción** → Stripe webhook procesa el pago
2. **Dashboard genera API Key** → Cliente ve su API key en `/settings`
3. **Cliente ejecuta instalador** → Script descarga EA con su API key
4. **EA se conecta al servidor** → Valida API key + cuenta MT
5. **Señales llegan automáticamente** → El EA ejecuta trades

---

## Soporte

- **Documentación:** https://trading-bot-saas.vercel.app/docs
- **Email:** soporte@refocus.agency
- **Web:** https://refocus.agency

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0.0 | 2026-03-07 | Versión inicial |
