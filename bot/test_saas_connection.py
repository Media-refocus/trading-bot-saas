"""
test_saas_connection.py - Prueba la conexión del bot con el SaaS

Este script simula el comportamiento del bot sin necesidad de MT5:
- Obtiene configuración del SaaS
- Envía heartbeats periódicos
- Reporta señales de prueba
- Reporta trades de prueba

Uso:
    python test_saas_connection.py --api-key tb_xxx --url http://localhost:3000
"""

import argparse
import logging
import time
import random
from datetime import datetime

from saas_client import SaasClient

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("test_bot")


def parse_args():
    parser = argparse.ArgumentParser(description="Test de conexión bot-SaaS")
    parser.add_argument(
        "--api-key",
        required=True,
        help="API key del bot (generada en el dashboard)"
    )
    parser.add_argument(
        "--url",
        default="http://localhost:3000",
        help="URL del SaaS (default: http://localhost:3000)"
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=5,
        help="Número de iteraciones de heartbeat (default: 5)"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=5,
        help="Segundos entre heartbeats (default: 5)"
    )
    return parser.parse_args()


def test_connection(client: SaasClient):
    """Prueba la conexión básica obteniendo la configuración"""
    log.info("=" * 50)
    log.info("TEST 1: Obtener configuración")
    log.info("=" * 50)

    try:
        config = client.get_config(force_refresh=True)
        log.info(f"✅ Configuración obtenida:")
        log.info(f"   - Symbol: {config.symbol}")
        log.info(f"   - Magic Number: {config.magic_number}")
        log.info(f"   - Entry Lot: {config.entry_lot}")
        log.info(f"   - Grid Step: {config.grid_step_pips} pips")
        log.info(f"   - Grid Max Levels: {config.grid_max_levels}")
        log.info(f"   - Accounts: {len(config.accounts)}")

        for i, acc in enumerate(config.accounts):
            log.info(f"   - Account {i+1}: login={acc.get('login')}, server={acc.get('server')}")

        return config

    except Exception as e:
        log.error(f"❌ Error obteniendo configuración: {e}")
        raise


def test_heartbeat(client: SaasClient, iteration: int):
    """Prueba enviar un heartbeat"""
    log.info(f"\n{'='*50}")
    log.info(f"TEST 2.{iteration}: Enviar heartbeat")
    log.info(f"{'='*50}")

    try:
        # Simular datos de estado
        mt5_connected = True
        telegram_connected = random.choice([True, False])  # Simular
        open_positions = random.randint(0, 5)
        pending_orders = random.randint(0, 2)

        commands = client.send_heartbeat(
            mt5_connected=mt5_connected,
            telegram_connected=telegram_connected,
            open_positions=open_positions,
            pending_orders=pending_orders,
            uptime_seconds=iteration * 5,
        )

        log.info(f"✅ Heartbeat enviado:")
        log.info(f"   - MT5: {'🟢' if mt5_connected else '🔴'}")
        log.info(f"   - Telegram: {'🟢' if telegram_connected else '🔴'}")
        log.info(f"   - Posiciones: {open_positions}")
        log.info(f"   - Pendientes: {pending_orders}")

        if commands:
            log.info(f"   - Comandos recibidos: {[c.type for c in commands]}")
        else:
            log.info(f"   - Comandos: ninguno")

        return commands

    except Exception as e:
        log.error(f"❌ Error enviando heartbeat: {e}")
        return []


def test_signal(client: SaasClient):
    """Prueba reportar una señal"""
    log.info(f"\n{'='*50}")
    log.info("TEST 3: Reportar señal")
    log.info(f"{'='*50}")

    try:
        side = random.choice(["BUY", "SELL"])
        price = 2650 + random.uniform(-5, 5)

        signal_id = client.report_signal(
            side=side,
            symbol="XAUUSD",
            message_text=f"{side} XAUUSD @ {price:.2f}",
            price=price,
            channel_id="test_channel_123",
            channel_name="Test Signals",
        )

        if signal_id:
            log.info(f"✅ Señal reportada:")
            log.info(f"   - ID: {signal_id}")
            log.info(f"   - Side: {side}")
            log.info(f"   - Price: {price:.2f}")
            return signal_id
        else:
            log.warning("⚠️ Señal no registrada")
            return None

    except Exception as e:
        log.error(f"❌ Error reportando señal: {e}")
        return None


def test_trade(client: SaasClient, bot_account_id: str):
    """Prueba reportar un trade abierto y cerrado"""
    log.info(f"\n{'='*50}")
    log.info("TEST 4: Reportar trade")
    log.info(f"{'='*50}")

    mt5_ticket = random.randint(10000, 99999)
    side = random.choice(["BUY", "SELL"])
    open_price = 2650 + random.uniform(-5, 5)
    lot_size = 0.1

    # Abrir trade
    try:
        trade_id = client.report_trade_open(
            bot_account_id=bot_account_id,
            mt5_ticket=mt5_ticket,
            side=side,
            symbol="XAUUSD",
            level=0,
            open_price=open_price,
            lot_size=lot_size,
        )

        if trade_id:
            log.info(f"✅ Trade abierto:")
            log.info(f"   - ID: {trade_id}")
            log.info(f"   - Ticket: #{mt5_ticket}")
            log.info(f"   - Side: {side}")
            log.info(f"   - Price: {open_price:.2f}")
            log.info(f"   - Lot: {lot_size}")
        else:
            log.warning("⚠️ Trade no registrado")
            return

    except Exception as e:
        log.error(f"❌ Error reportando trade abierto: {e}")
        return

    # Esperar un poco
    time.sleep(2)

    # Cerrar trade
    try:
        # Simular resultado (más ganancias que pérdidas para que sea feliz :)
        profit_pips = random.uniform(-20, 30)
        close_price = open_price + (profit_pips * 0.1 if side == "BUY" else -profit_pips * 0.1)
        profit_money = profit_pips * lot_size * 10  # Aproximado para XAUUSD
        close_reason = random.choice(["TAKE_PROFIT", "STOP_LOSS", "MANUAL"])

        trade_id = client.report_trade_close(
            bot_account_id=bot_account_id,
            mt5_ticket=mt5_ticket,
            close_price=close_price,
            close_reason=close_reason,
            profit_pips=profit_pips,
            profit_money=profit_money,
        )

        if trade_id:
            emoji = "💰" if profit_money >= 0 else "📉"
            log.info(f"{emoji} Trade cerrado:")
            log.info(f"   - Price: {close_price:.2f}")
            log.info(f"   - Reason: {close_reason}")
            log.info(f"   - Pips: {profit_pips:.1f}")
            log.info(f"   - P&L: ${profit_money:.2f}")
        else:
            log.warning("⚠️ Trade no actualizado")

    except Exception as e:
        log.error(f"❌ Error reportando trade cerrado: {e}")


def main():
    args = parse_args()

    log.info("🤖 Iniciando test de conexión bot-SaaS")
    log.info(f"   API Key: {args.api_key[:10]}...")
    log.info(f"   URL: {args.url}")
    log.info(f"   Iteraciones: {args.iterations}")
    log.info("")

    # Crear cliente
    client = SaasClient(
        api_key=args.api_key,
        base_url=args.url,
        bot_version="1.0.0-test",
    )

    try:
        # Test 1: Obtener configuración
        config = test_connection(client)

        if not config.accounts:
            log.warning("⚠️ No hay cuentas configuradas. Creando cuenta de prueba...")
            bot_account_id = "test-account-id"
        else:
            bot_account_id = config.accounts[0]["id"]

        # Test 3: Reportar señal
        signal_id = test_signal(client)

        # Test 4: Reportar trade
        test_trade(client, bot_account_id)

        # Test 2: Heartbeats en loop
        log.info(f"\n🔄 Iniciando loop de heartbeats ({args.iterations} iteraciones)...")

        for i in range(1, args.iterations + 1):
            commands = test_heartbeat(client, i)

            # Procesar comandos
            for cmd in commands:
                if cmd.type == "PAUSE":
                    log.warning(f"⏸️ Comando PAUSE recibido: {cmd.reason}")
                elif cmd.type == "RESUME":
                    log.info(f"▶️ Comando RESUME recibido")
                elif cmd.type == "CLOSE_ALL":
                    log.warning(f"🔴 Comando CLOSE_ALL recibido: {cmd.reason}")

            if i < args.iterations:
                time.sleep(args.interval)

        log.info("\n" + "=" * 50)
        log.info("✅ TODOS LOS TESTS COMPLETADOS")
        log.info("=" * 50)

    except Exception as e:
        log.error(f"❌ Error en test: {e}")
        raise

    finally:
        client.close()


if __name__ == "__main__":
    main()
