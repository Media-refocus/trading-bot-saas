#!/usr/bin/env python3
"""
Trading Bot - Cliente para SaaS
===============================

Bot que se ejecuta en el VPS del cliente y:
1. Se conecta a MT5 localmente
2. Lee configuracion del SaaS via API
3. Recibe señales del SaaS
4. Ejecuta operaciones segun la estrategia configurada
5. Sincroniza estado con el dashboard

SEGURIDAD:
- Las credenciales de MT5 nunca salen del VPS
- Solo se envian datos de operativa (no dinero)
"""

import os
import sys
import json
import time
import logging
import threading
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib

import requests
import MetaTrader5 as mt5

# ============================================
# CONFIGURACION Y CONSTANTES
# ============================================

VERSION = "1.0.0"
CONFIG_FILE = Path(__file__).parent / "config.json"
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'bot.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('TradingBot')


class BotStatus(Enum):
    OFFLINE = "OFFLINE"
    ONLINE = "ONLINE"
    PAUSED = "PAUSED"
    ERROR = "ERROR"


class PositionSide(Enum):
    BUY = "BUY"
    SELL = "SELL"


class SignalType(Enum):
    ENTRY = "ENTRY"
    CLOSE = "CLOSE"
    UNKNOWN = "UNKNOWN"


@dataclass
class BotConfig:
    """Configuracion del bot leida del SaaS"""
    # Identificacion
    tenant_id: str = ""
    api_key: str = ""

    # Trading
    symbol: str = "XAUUSD"
    magic_number: int = 20250101

    # Parametros de entrada
    entry_lot: float = 0.1
    entry_num_orders: int = 1

    # Grid / Promedios
    grid_step_pips: int = 10
    grid_lot: float = 0.1
    grid_max_levels: int = 4
    grid_num_orders: int = 1
    grid_tolerance_pips: int = 1

    # Take Profit / Stop Loss
    take_profit_pips: int = 20
    stop_loss_pips: Optional[int] = None
    use_stop_loss: bool = False
    use_trailing_sl: bool = True
    trailing_sl_percent: int = 50

    # Restricciones
    restriction_type: Optional[str] = None  # "RIESGO", "SIN_PROMEDIOS", "SOLO_1_PROMEDIO"
    max_levels: int = 4

    # Protecciones
    daily_loss_limit_percent: Optional[float] = None

    # Control
    active: bool = True
    config_version: int = 0


@dataclass
class Position:
    """Posicion abierta en MT5"""
    ticket: int
    symbol: str
    side: PositionSide
    volume: float
    open_price: float
    open_time: datetime
    sl: float = 0.0
    tp: float = 0.0
    profit: float = 0.0
    level: int = 0
    signal_id: Optional[str] = None


@dataclass
class Signal:
    """Senal recibida del SaaS"""
    id: str
    type: SignalType
    side: PositionSide
    price: Optional[float]
    symbol: str
    restriction_type: Optional[str] = None
    max_levels: int = 4
    timestamp: datetime = None


# ============================================
# CLIENTE SaaS
# ============================================

class SaasClient:
    """Cliente para comunicarse con el SaaS"""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })

    def get_config(self) -> Optional[Dict]:
        """Obtener configuracion del bot desde el SaaS"""
        try:
            response = self.session.get(
                f"{self.base_url}/api/bot/config",
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                logger.error("API Key invalida o suscripcion inactiva")
                return None
            else:
                logger.error(f"Error obteniendo config: {response.status_code}")
                return None
        except requests.RequestException as e:
            logger.error(f"Error conectando con SaaS: {e}")
            return None

    def send_heartbeat(self, data: Dict) -> bool:
        """Enviar heartbeat al SaaS"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/bot/heartbeat",
                json=data,
                timeout=10
            )
            return response.status_code == 200
        except requests.RequestException as e:
            logger.error(f"Error enviando heartbeat: {e}")
            return False

    def get_pending_signals(self) -> List[Dict]:
        """Obtener senales pendientes de procesar"""
        try:
            response = self.session.get(
                f"{self.base_url}/api/bot/signals/pending",
                timeout=10
            )
            if response.status_code == 200:
                return response.json().get("signals", [])
            return []
        except requests.RequestException as e:
            logger.error(f"Error obteniendo senales: {e}")
            return []

    def acknowledge_signal(self, signal_id: str, status: str, error: str = None) -> bool:
        """Confirmar procesamiento de senal"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/bot/signals/{signal_id}/ack",
                json={"status": status, "error": error},
                timeout=10
            )
            return response.status_code == 200
        except requests.RequestException as e:
            logger.error(f"Error confirmando senal: {e}")
            return False

    def report_trade(self, trade_data: Dict) -> bool:
        """Reportar trade al SaaS"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/bot/trade",
                json=trade_data,
                timeout=10
            )
            return response.status_code == 200
        except requests.RequestException as e:
            logger.error(f"Error reportando trade: {e}")
            return False

    def check_kill_switch(self) -> bool:
        """Verificar si el kill switch esta activado"""
        try:
            response = self.session.get(
                f"{self.base_url}/api/bot/status",
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("kill_switch", False)
        except requests.RequestException:
            pass
        return False

    def can_update_config(self) -> bool:
        """Verificar si es seguro actualizar la configuracion"""
        try:
            response = self.session.get(
                f"{self.base_url}/api/bot/can-update-config",
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("can_update", True)
        except requests.RequestException:
            pass
        return True


# ============================================
# CLIENTE MT5
# ============================================

class MT5Client:
    """Cliente para interactuar con MetaTrader 5"""

    def __init__(self):
        self.connected = False
        self.account_info = None

    def connect(self) -> bool:
        """Conectar con MT5"""
        if not mt5.initialize():
            logger.error(f"Error inicializando MT5: {mt5.last_error()}")
            return False

        self.account_info = mt5.account_info()
        if self.account_info is None:
            logger.error("No hay cuenta conectada en MT5")
            logger.info("Por favor, abre MT5 y conecta con tu cuenta")
            mt5.shutdown()
            return False

        self.connected = True
        logger.info(f"MT5 conectado: {self.account_info.login} @ {self.account_info.server}")
        logger.info(f"Balance: {self.account_info.balance} {self.account_info.currency}")
        return True

    def disconnect(self):
        """Desconectar de MT5"""
        mt5.shutdown()
        self.connected = False
        logger.info("MT5 desconectado")

    def get_account_info(self) -> Optional[Dict]:
        """Obtener informacion de la cuenta"""
        if not self.connected:
            return None

        info = mt5.account_info()
        if info:
            return {
                "login": info.login,
                "server": info.server,
                "balance": info.balance,
                "equity": info.equity,
                "margin": info.margin,
                "free_margin": info.margin_free,
                "currency": info.currency
            }
        return None

    def get_positions(self, symbol: str = None) -> List[Position]:
        """Obtener posiciones abiertas"""
        if not self.connected:
            return []

        if symbol:
            mt5_positions = mt5.positions_get(symbol=symbol)
        else:
            mt5_positions = mt5.positions_get()

        if mt5_positions is None:
            return []

        positions = []
        for pos in mt5_positions:
            positions.append(Position(
                ticket=pos.ticket,
                symbol=pos.symbol,
                side=PositionSide.BUY if pos.type == mt5.ORDER_TYPE_BUY else PositionSide.SELL,
                volume=pos.volume,
                open_price=pos.price_open,
                open_time=datetime.fromtimestamp(pos.time, tz=timezone.utc),
                sl=pos.sl,
                tp=pos.tp,
                profit=pos.profit,
            ))

        return positions

    def get_symbol_info(self, symbol: str) -> Optional[Dict]:
        """Obtener informacion del simbolo"""
        info = mt5.symbol_info(symbol)
        if info:
            return {
                "bid": info.bid,
                "ask": info.ask,
                "point": info.point,
                "digits": info.digits,
                "spread": info.spread,
                "trade_contract_size": info.trade_contract_size,
                "volume_min": info.volume_min,
                "volume_max": info.volume_max,
                "volume_step": info.volume_step
            }
        return None

    def place_market_order(self, symbol: str, side: PositionSide, volume: float,
                          sl: float = 0.0, tp: float = 0.0,
                          magic: int = 0, comment: str = "") -> Optional[int]:
        """Colocar orden a mercado"""
        if not self.connected:
            return None

        # Verificar simbolo
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            logger.error(f"Simbolo {symbol} no encontrado")
            return None

        # Obtener precio actual
        if side == PositionSide.BUY:
            price = symbol_info.ask
            order_type = mt5.ORDER_TYPE_BUY
        else:
            price = symbol_info.bid
            order_type = mt5.ORDER_TYPE_SELL

        # Crear request
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "price": price,
            "sl": sl,
            "tp": tp,
            "magic": magic,
            "comment": comment or "TradingBot",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        # Enviar orden
        result = mt5.order_send(request)

        if result is None:
            logger.error(f"Error enviando orden: {mt5.last_error()}")
            return None

        if result.retcode != mt5.TRADE_RETCODE_DONE:
            logger.error(f"Orden rechazada: {result.retcode} - {result.comment}")
            return None

        logger.info(f"Orden ejecutada: {side.value} {volume} {symbol} @ {price}")
        return result.order

    def close_position(self, ticket: int) -> bool:
        """Cerrar posicion"""
        if not self.connected:
            return False

        position = mt5.positions_get(ticket=ticket)
        if position is None or len(position) == 0:
            logger.error(f"Posicion {ticket} no encontrada")
            return False

        pos = position[0]

        # Determinar tipo de orden de cierre
        if pos.type == mt5.ORDER_TYPE_BUY:
            order_type = mt5.ORDER_TYPE_SELL
            price = mt5.symbol_info_tick(pos.symbol).bid
        else:
            order_type = mt5.ORDER_TYPE_BUY
            price = mt5.symbol_info_tick(pos.symbol).ask

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": pos.volume,
            "type": order_type,
            "position": ticket,
            "price": price,
            "comment": "TradingBot Close",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)

        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            logger.error(f"Error cerrando posicion {ticket}: {result.comment if result else mt5.last_error()}")
            return False

        logger.info(f"Posicion {ticket} cerrada")
        return True

    def close_all_positions(self, symbol: str = None) -> int:
        """Cerrar todas las posiciones (kill switch)"""
        positions = self.get_positions(symbol)
        closed = 0
        for pos in positions:
            if self.close_position(pos.ticket):
                closed += 1
        return closed

    def modify_position(self, ticket: int, sl: float = None, tp: float = None) -> bool:
        """Modificar SL/TP de posicion"""
        if not self.connected:
            return False

        position = mt5.positions_get(ticket=ticket)
        if position is None or len(position) == 0:
            return False

        pos = position[0]

        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": pos.symbol,
            "position": ticket,
            "sl": sl if sl is not None else pos.sl,
            "tp": tp if tp is not None else pos.tp,
        }

        result = mt5.order_send(request)
        return result is not None and result.retcode == mt5.TRADE_RETCODE_DONE


# ============================================
# GESTOR DE POSICIONES
# ============================================

class PositionManager:
    """Gestiona las posiciones del bot"""

    def __init__(self, mt5_client: MT5Client, config: BotConfig):
        self.mt5 = mt5_client
        self.config = config
        self.open_positions: Dict[str, List[Position]] = {}  # signal_id -> positions
        self.daily_start_balance: float = 0.0
        self.daily_loss: float = 0.0
        self.daily_loss_reset: datetime = None

    def update_config(self, config: BotConfig, force: bool = False):
        """Actualizar configuracion (solo si no hay posiciones abiertas)"""
        if not force and self.has_open_positions():
            logger.warning("No se puede actualizar config con posiciones abiertas")
            return False

        self.config = config
        logger.info(f"Configuracion actualizada: version {config.config_version}")
        return True

    def has_open_positions(self) -> bool:
        """Verificar si hay posiciones abiertas"""
        positions = self.mt5.get_positions(self.config.symbol)
        return len(positions) > 0

    def check_daily_loss_limit(self) -> bool:
        """Verificar si se ha alcanzado el limite de perdida diaria"""
        if self.config.daily_loss_limit_percent is None:
            return False

        # Resetear contador si es nuevo dia
        now = datetime.now(timezone.utc)
        if self.daily_loss_reset is None or self.daily_loss_reset.date() != now.date():
            account = self.mt5.get_account_info()
            if account:
                self.daily_start_balance = account["balance"]
                self.daily_loss = 0.0
                self.daily_loss_reset = now
                logger.info(f"Daily loss counter reseteado. Balance inicio: {self.daily_start_balance}")

        # Calcular perdida actual
        account = self.mt5.get_account_info()
        if account:
            current_loss = self.daily_start_balance - account["equity"]
            if current_loss > 0:
                loss_percent = (current_loss / self.daily_start_balance) * 100
                if loss_percent >= self.config.daily_loss_limit_percent:
                    logger.warning(f"DAILY LOSS LIMIT ALCANZADO: {loss_percent:.2f}% >= {self.config.daily_loss_limit_percent}%")
                    return True

        return False

    def calculate_pips(self, price1: float, price2: float, symbol_info: Dict) -> float:
        """Calcular diferencia en pips"""
        point = symbol_info["point"]
        digits = symbol_info["digits"]

        # Para XAUUSD (2 decimales), 1 pip = 0.01
        if digits == 2:
            pip_value = 0.01
        elif digits == 3:
            pip_value = 0.001
        elif digits == 5:
            pip_value = 0.00001
        else:
            pip_value = point * 10

        return abs(price1 - price2) / pip_value

    def calculate_level(self, entry_price: float, current_price: float,
                       side: PositionSide, symbol_info: Dict) -> int:
        """Calcular nivel actual basado en distancia del precio"""
        pips_distance = self.calculate_pips(entry_price, current_price, symbol_info)

        if side == PositionSide.BUY:
            # Para BUY, niveles hacia abajo
            if current_price < entry_price:
                level = int(pips_distance / self.config.grid_step_pips) + 1
                return min(level, self.config.grid_max_levels)
        else:
            # Para SELL, niveles hacia arriba
            if current_price > entry_price:
                level = int(pips_distance / self.config.grid_step_pips) + 1
                return min(level, self.config.grid_max_levels)

        return 0

    def should_open_average(self, entry_price: float, current_price: float,
                           side: PositionSide, current_level: int, symbol_info: Dict) -> bool:
        """Determinar si se debe abrir un promedio"""
        # Verificar restricciones
        if self.config.restriction_type == "SIN_PROMEDIOS":
            return False

        if self.config.restriction_type == "SOLO_1_PROMEDIO" and current_level >= 1:
            return False

        if current_level >= self.config.grid_max_levels:
            return False

        # Verificar distancia
        pips_distance = self.calculate_pips(entry_price, current_price, symbol_info)
        expected_level = int(pips_distance / self.config.grid_step_pips) + 1

        # Tolerancia de 1 pip
        tolerance = self.config.grid_tolerance_pips
        exact_distance = pips_distance % self.config.grid_step_pips

        if exact_distance <= tolerance or exact_distance >= (self.config.grid_step_pips - tolerance):
            return expected_level > current_level

        return False

    def calculate_sl_tp(self, entry_price: float, side: PositionSide, symbol_info: Dict) -> tuple:
        """Calcular Stop Loss y Take Profit"""
        point = symbol_info["point"]
        digits = symbol_info["digits"]

        # Para XAUUSD (2 decimales), 1 pip = 0.01
        if digits == 2:
            pip_value = 0.01
        elif digits == 3:
            pip_value = 0.001
        elif digits == 5:
            pip_value = 0.00001
        else:
            pip_value = point * 10

        sl = 0.0
        tp = 0.0

        # Take Profit
        if self.config.take_profit_pips > 0:
            tp_distance = self.config.take_profit_pips * pip_value
            if side == PositionSide.BUY:
                tp = entry_price + tp_distance
            else:
                tp = entry_price - tp_distance

        # Stop Loss
        if self.config.use_stop_loss and self.config.stop_loss_pips:
            sl_distance = self.config.stop_loss_pips * pip_value
            if side == PositionSide.BUY:
                sl = entry_price - sl_distance
            else:
                sl = entry_price + sl_distance

        # Normalizar
        sl = round(sl, digits) if sl > 0 else 0.0
        tp = round(tp, digits) if tp > 0 else 0.0

        return sl, tp


# ============================================
# BOT PRINCIPAL
# ============================================

class TradingBot:
    """Bot de trading principal"""

    def __init__(self, api_key: str, saas_url: str):
        self.api_key = api_key
        self.saas_url = saas_url

        # Componentes
        self.saas = SaasClient(saas_url, api_key)
        self.mt5 = MT5Client()
        self.position_manager: Optional[PositionManager] = None

        # Estado
        self.config: Optional[BotConfig] = None
        self.status = BotStatus.OFFLINE
        self.running = False

        # Timing
        self.last_heartbeat = 0
        self.last_config_refresh = 0
        self.last_signal_check = 0
        self.heartbeat_interval = 30
        self.config_refresh_interval = 300  # 5 min
        self.signal_check_interval = 5

        # Hilos
        self.heartbeat_thread: Optional[threading.Thread] = None
        self.signal_thread: Optional[threading.Thread] = None

    def load_config(self) -> bool:
        """Cargar configuracion desde el SaaS"""
        config_data = self.saas.get_config()
        if config_data is None:
            return False

        try:
            self.config = BotConfig(
                tenant_id=config_data.get("tenantId", ""),
                api_key=self.api_key,
                symbol=config_data.get("symbol", "XAUUSD"),
                magic_number=config_data.get("magicNumber", 20250101),
                entry_lot=config_data.get("entryLot", 0.1),
                entry_num_orders=config_data.get("entryNumOrders", 1),
                grid_step_pips=config_data.get("gridStepPips", 10),
                grid_lot=config_data.get("gridLot", 0.1),
                grid_max_levels=config_data.get("gridMaxLevels", 4),
                grid_num_orders=config_data.get("gridNumOrders", 1),
                grid_tolerance_pips=config_data.get("gridTolerancePips", 1),
                take_profit_pips=config_data.get("takeProfitPips", 20),
                stop_loss_pips=config_data.get("stopLossPips"),
                use_stop_loss=config_data.get("useStopLoss", False),
                use_trailing_sl=config_data.get("useTrailingSL", True),
                trailing_sl_percent=config_data.get("trailingSLPercent", 50),
                restriction_type=config_data.get("restrictionType"),
                max_levels=config_data.get("maxLevels", 4),
                daily_loss_limit_percent=config_data.get("dailyLossLimitPercent"),
                active=config_data.get("active", True),
                config_version=config_data.get("configVersion", 0),
            )

            # Inicializar position manager
            self.position_manager = PositionManager(self.mt5, self.config)

            logger.info(f"Configuracion cargada: {self.config.symbol}, TP={self.config.take_profit_pips} pips")
            return True

        except Exception as e:
            logger.error(f"Error parseando configuracion: {e}")
            return False

    def connect_mt5(self) -> bool:
        """Conectar con MT5"""
        if not self.mt5.connect():
            return False

        # Verificar simbolo
        symbol_info = self.mt5.get_symbol_info(self.config.symbol)
        if symbol_info is None:
            logger.error(f"Simbolo {self.config.symbol} no disponible en MT5")
            return False

        logger.info(f"Simbolo {self.config.symbol} disponible: bid={symbol_info['bid']}, ask={symbol_info['ask']}")
        return True

    def send_heartbeat(self):
        """Enviar heartbeat al SaaS"""
        account_info = self.mt5.get_account_info()
        positions = self.mt5.get_positions(self.config.symbol) if self.config else []

        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": self.status.value,
            "mt5_connected": self.mt5.connected,
            "telegram_connected": False,  # TODO: implementar
            "open_positions": len(positions),
            "balance": account_info["balance"] if account_info else 0,
            "equity": account_info["equity"] if account_info else 0,
            "margin": account_info["margin"] if account_info else 0,
            "config_version": self.config.config_version if self.config else 0,
        }

        if self.saas.send_heartbeat(payload):
            logger.debug("Heartbeat enviado OK")
        else:
            logger.warning("Heartbeat fallido")

    def check_kill_switch(self) -> bool:
        """Verificar kill switch"""
        if self.saas.check_kill_switch():
            logger.warning("KILL SWITCH ACTIVADO!")
            self.handle_kill_switch()
            return True
        return False

    def handle_kill_switch(self):
        """Manejar activacion del kill switch"""
        logger.warning("Cerrando todas las posiciones...")
        closed = self.mt5.close_all_positions(self.config.symbol)
        logger.warning(f"Kill switch completado: {closed} posiciones cerradas")
        self.status = BotStatus.PAUSED
        self.running = False

    def process_signal(self, signal_data: Dict):
        """Procesar una senal del SaaS"""
        try:
            signal = Signal(
                id=signal_data["id"],
                type=SignalType(signal_data.get("type", "ENTRY")),
                side=PositionSide(signal_data["side"]),
                price=signal_data.get("price"),
                symbol=signal_data.get("symbol", self.config.symbol),
                restriction_type=signal_data.get("restrictionType"),
                max_levels=signal_data.get("maxLevels", 4),
                timestamp=datetime.fromisoformat(signal_data["timestamp"]) if signal_data.get("timestamp") else None,
            )
        except Exception as e:
            logger.error(f"Error parseando senal: {e}")
            return

        logger.info(f"Procesando senal: {signal.type.value} {signal.side.value} {signal.symbol} @ {signal.price}")

        # Verificar daily loss limit
        if self.position_manager.check_daily_loss_limit():
            logger.warning("Daily loss limit alcanzado, ignorando senal")
            self.saas.acknowledge_signal(signal.id, "REJECTED", "Daily loss limit reached")
            return

        if signal.type == SignalType.ENTRY:
            self.process_entry_signal(signal)
        elif signal.type == SignalType.CLOSE:
            self.process_close_signal(signal)

    def process_entry_signal(self, signal: Signal):
        """Procesar senal de entrada"""
        symbol_info = self.mt5.get_symbol_info(signal.symbol)
        if symbol_info is None:
            logger.error(f"No se pudo obtener info de {signal.symbol}")
            self.saas.acknowledge_signal(signal.id, "FAILED", f"Symbol {signal.symbol} not found")
            return

        # Precio de entrada
        if signal.price:
            entry_price = signal.price
        else:
            entry_price = symbol_info["ask"] if signal.side == PositionSide.BUY else symbol_info["bid"]

        # Calcular SL/TP
        sl, tp = self.position_manager.calculate_sl_tp(entry_price, signal.side, symbol_info)

        # Colocar orden
        ticket = self.mt5.place_market_order(
            symbol=signal.symbol,
            side=signal.side,
            volume=self.config.entry_lot,
            sl=sl,
            tp=tp,
            magic=self.config.magic_number,
            comment=f"TB-{signal.id[:8]}"
        )

        if ticket:
            logger.info(f"Entrada ejecutada: ticket {ticket}")
            self.saas.acknowledge_signal(signal.id, "EXECUTED")

            # Reportar trade
            self.saas.report_trade({
                "signalId": signal.id,
                "mt5Ticket": ticket,
                "side": signal.side.value,
                "symbol": signal.symbol,
                "openPrice": entry_price,
                "lotSize": self.config.entry_lot,
                "level": 0,
                "status": "OPEN"
            })
        else:
            logger.error(f"Error ejecutando entrada para senal {signal.id}")
            self.saas.acknowledge_signal(signal.id, "FAILED", "Order execution failed")

    def process_close_signal(self, signal: Signal):
        """Procesar senal de cierre"""
        positions = self.mt5.get_positions(signal.symbol)

        if not positions:
            logger.info(f"No hay posiciones para cerrar")
            self.saas.acknowledge_signal(signal.id, "EXECUTED", "No positions to close")
            return

        # Cerrar todas las posiciones del simbolo
        closed = self.mt5.close_all_positions(signal.symbol)
        logger.info(f"Cerradas {closed} posiciones")
        self.saas.acknowledge_signal(signal.id, "EXECUTED", f"Closed {closed} positions")

    def check_pending_signals(self):
        """Verificar senales pendientes"""
        signals = self.saas.get_pending_signals()

        for signal_data in signals:
            self.process_signal(signal_data)

    def monitor_positions(self):
        """Monitorear posiciones abiertas para promedios y TP/SL"""
        if not self.config or not self.config.active:
            return

        positions = self.mt5.get_positions(self.config.symbol)
        if not positions:
            return

        symbol_info = self.mt5.get_symbol_info(self.config.symbol)
        if symbol_info is None:
            return

        current_price = symbol_info["bid"]  # Usar bid como referencia

        for pos in positions:
            # Solo procesar posiciones de nuestro magic number
            # TODO: obtener magic de la posicion de MT5

            # Verificar Take Profit
            if pos.tp > 0:
                if pos.side == PositionSide.BUY and current_price >= pos.tp:
                    logger.info(f"TP alcanzado para posicion {pos.ticket}")
                    self.mt5.close_position(pos.ticket)
                    continue
                elif pos.side == PositionSide.SELL and current_price <= pos.tp:
                    logger.info(f"TP alcanzado para posicion {pos.ticket}")
                    self.mt5.close_position(pos.ticket)
                    continue

            # Verificar Stop Loss
            if pos.sl > 0:
                if pos.side == PositionSide.BUY and current_price <= pos.sl:
                    logger.info(f"SL alcanzado para posicion {pos.ticket}")
                    self.mt5.close_position(pos.ticket)
                    continue
                elif pos.side == PositionSide.SELL and current_price >= pos.sl:
                    logger.info(f"SL alcanzado para posicion {pos.ticket}")
                    self.mt5.close_position(pos.ticket)
                    continue

    def run(self):
        """Loop principal del bot"""
        logger.info("=" * 60)
        logger.info(f"TRADING BOT v{VERSION}")
        logger.info("=" * 60)

        # Cargar configuracion
        if not self.load_config():
            logger.error("No se pudo cargar configuracion. Deteniendo.")
            return

        # Conectar MT5
        if not self.connect_mt5():
            logger.error("No se pudo conectar MT5. Deteniendo.")
            return

        self.status = BotStatus.ONLINE
        self.running = True

        logger.info("Bot iniciado correctamente")
        logger.info(f"Heartbeat cada {self.heartbeat_interval}s")
        logger.info(f"Config refresh cada {self.config_refresh_interval}s")

        # Loop principal
        try:
            while self.running:
                current_time = time.time()

                # Verificar kill switch
                if self.check_kill_switch():
                    break

                # Enviar heartbeat
                if current_time - self.last_heartbeat >= self.heartbeat_interval:
                    self.send_heartbeat()
                    self.last_heartbeat = current_time

                # Refrescar configuracion
                if current_time - self.last_config_refresh >= self.config_refresh_interval:
                    if not self.position_manager.has_open_positions():
                        self.load_config()
                    else:
                        logger.debug("Saltando config refresh (posiciones abiertas)")
                    self.last_config_refresh = current_time

                # Verificar senales pendientes
                if current_time - self.last_signal_check >= self.signal_check_interval:
                    self.check_pending_signals()
                    self.last_signal_check = current_time

                # Monitorear posiciones
                self.monitor_positions()

                # Verificar daily loss limit
                if self.position_manager.check_daily_loss_limit():
                    logger.warning("Daily loss limit alcanzado, pausando bot")
                    self.status = BotStatus.PAUSED
                    # TODO: enviar notificacion al SaaS

                time.sleep(1)

        except KeyboardInterrupt:
            logger.info("Interrupcion de usuario")
        except Exception as e:
            logger.error(f"Error en loop principal: {e}", exc_info=True)
            self.status = BotStatus.ERROR
        finally:
            self.shutdown()

    def shutdown(self):
        """Apagar bot limpiamente"""
        logger.info("Apagando bot...")
        self.running = False
        self.status = BotStatus.OFFLINE
        self.send_heartbeat()  # Enviar ultimo heartbeat offline
        self.mt5.disconnect()
        logger.info("Bot apagado")


# ============================================
# PUNTO DE ENTRADA
# ============================================

def main():
    parser = argparse.ArgumentParser(description="Trading Bot Cliente")
    parser.add_argument("--api-key", required=True, help="API Key del SaaS")
    parser.add_argument("--url", default="https://tu-saas.com", help="URL del SaaS")
    parser.add_argument("--config", default=None, help="Ruta al archivo de configuracion")
    args = parser.parse_args()

    # Crear y ejecutar bot
    bot = TradingBot(api_key=args.api_key, saas_url=args.url)
    bot.run()


if __name__ == "__main__":
    main()
