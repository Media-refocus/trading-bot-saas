"""
saas_client.py - Cliente HTTP para comunicar el bot con el SaaS

Permite:
- Obtener configuración del SaaS
- Enviar heartbeats periódicos
- Reportar señales de Telegram
- Reportar trades ejecutados
- Recibir comandos del dashboard
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
import json

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Logger para este módulo
log = logging.getLogger("saas_client")


# ==================== DATA CLASSES ====================

@dataclass
class BotConfig:
    """Configuración del bot obtenida del SaaS"""
    # General
    bot_id: str
    symbol: str
    magic_number: int

    # Entry
    entry_lot: float
    entry_num_orders: int

    # Grid
    grid_step_pips: int
    grid_lot: float
    grid_max_levels: int
    grid_num_orders: int
    grid_tolerance_pips: int

    # Entry optional (debe ir después de los obligatorios)
    entry_trailing: Optional[dict] = None  # {activate, step, back, buffer}

    # Restrictions
    restriction_type: Optional[str] = None
    max_levels: int = 4

    # Accounts
    accounts: list[dict] = field(default_factory=list)  # [{id, login, password, server, ...}]

    # Telegram
    telegram: Optional[dict] = None  # {apiId, apiHash, session, channels}

    # Polling config
    heartbeat_interval_seconds: int = 30
    config_refresh_interval_seconds: int = 300


@dataclass
class BotCommand:
    """Comando recibido del SaaS"""
    type: str  # PAUSE, RESUME, CLOSE_ALL, UPDATE_CONFIG, RESTART
    reason: Optional[str] = None


# ==================== SAAS CLIENT ====================

class SaasClient:
    """
    Cliente HTTP para comunicar el bot con el SaaS.

    Uso:
        client = SaasClient(
            api_key="tb_xxx",
            base_url="https://tu-saas.com"
        )

        # Obtener configuración
        config = client.get_config()

        # Enviar heartbeat
        client.send_heartbeat(
            mt5_connected=True,
            telegram_connected=True,
            open_positions=3
        )

        # Reportar señal
        client.report_signal(
            side="BUY",
            symbol="XAUUSD",
            message="BUY XAUUSD 2650.50"
        )

        # Reportar trade
        client.report_trade_open(
            bot_account_id="abc",
            mt5_ticket=12345,
            side="BUY",
            symbol="XAUUSD",
            level=0,
            open_price=2650.50,
            lot_size=0.1
        )
    """

    def __init__(
        self,
        api_key: str,
        base_url: str,
        bot_version: str = "1.0.0",
        timeout_seconds: int = 10,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.bot_version = bot_version
        self.timeout = timeout_seconds

        # Configurar sesión HTTP con reintentos
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Headers por defecto
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "X-Bot-Version": bot_version,
            "Content-Type": "application/json",
        })

        # Cache de configuración
        self._config: Optional[BotConfig] = None
        self._config_fetched_at: Optional[float] = None

        # Estado
        self._is_paused = False
        self._last_error: Optional[str] = None

        log.info(f"SaasClient inicializado para {base_url}")

    # ==================== HTTP HELPERS ====================

    def _get(self, endpoint: str) -> dict:
        """GET request al SaaS"""
        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self._last_error = str(e)
            log.error(f"GET {endpoint} falló: {e}")
            raise

    def _post(self, endpoint: str, data: dict) -> dict:
        """POST request al SaaS"""
        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.post(url, json=data, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self._last_error = str(e)
            log.error(f"POST {endpoint} falló: {e}")
            raise

    # ==================== CONFIG ====================

    def get_config(self, force_refresh: bool = False) -> BotConfig:
        """
        Obtiene la configuración del bot desde el SaaS.
        Usa cache si es reciente (menos de config_refresh_interval_seconds).
        """
        now = time.time()

        if (
            not force_refresh
            and self._config
            and self._config_fetched_at
            and now - self._config_fetched_at < (self._config.heartbeat_interval_seconds if self._config else 300)
        ):
            return self._config

        log.info("Obteniendo configuración del SaaS...")
        data = self._get("/api/bot/config")

        # Parsear respuesta
        self._config = BotConfig(
            bot_id=data.get("botId", ""),
            symbol=data.get("symbol", "XAUUSD"),
            magic_number=data.get("magicNumber", 20250101),
            entry_lot=data.get("entry", {}).get("lot", 0.1),
            entry_num_orders=data.get("entry", {}).get("numOrders", 1),
            entry_trailing=data.get("entry", {}).get("trailing"),
            grid_step_pips=data.get("grid", {}).get("stepPips", 10),
            grid_lot=data.get("grid", {}).get("lot", 0.1),
            grid_max_levels=data.get("grid", {}).get("maxLevels", 4),
            grid_num_orders=data.get("grid", {}).get("numOrders", 1),
            grid_tolerance_pips=data.get("grid", {}).get("tolerancePips", 1),
            restriction_type=data.get("restrictions", {}).get("type"),
            max_levels=data.get("restrictions", {}).get("maxLevels", 4),
            accounts=data.get("accounts", []),
            telegram=data.get("telegram"),
            heartbeat_interval_seconds=data.get("heartbeatIntervalSeconds", 30),
            config_refresh_interval_seconds=data.get("configRefreshIntervalSeconds", 300),
        )

        self._config_fetched_at = now
        log.info(f"Configuración obtenida: {self._config.symbol}, {len(self._config.accounts)} cuentas")

        return self._config

    # ==================== HEARTBEAT ====================

    def send_heartbeat(
        self,
        mt5_connected: bool,
        telegram_connected: bool,
        open_positions: int = 0,
        pending_orders: int = 0,
        uptime_seconds: Optional[int] = None,
        memory_mb: Optional[float] = None,
        cpu_percent: Optional[float] = None,
        accounts: Optional[list[dict]] = None,
    ) -> list[BotCommand]:
        """
        Envía un heartbeat al SaaS y recibe comandos pendientes.

        Args:
            mt5_connected: Si MT5 está conectado
            telegram_connected: Si Telegram está conectado
            open_positions: Número de posiciones abiertas
            pending_orders: Número de órdenes pendientes
            uptime_seconds: Tiempo de actividad del bot
            memory_mb: Uso de memoria en MB
            cpu_percent: Uso de CPU en %
            accounts: Lista de cuentas con balance/equity

        Returns:
            Lista de comandos pendientes del dashboard
        """
        data = {
            "timestamp": datetime.utcnow().isoformat(),
            "version": self.bot_version,
            "mt5Connected": mt5_connected,
            "telegramConnected": telegram_connected,
            "openPositions": open_positions,
            "pendingOrders": pending_orders,
            "uptimeSeconds": uptime_seconds,
        }

        if memory_mb is not None or cpu_percent is not None:
            data["metrics"] = {}
            if memory_mb is not None:
                data["metrics"]["memoryMB"] = memory_mb
            if cpu_percent is not None:
                data["metrics"]["cpuPercent"] = cpu_percent

        if accounts:
            data["accounts"] = accounts

        try:
            response = self._post("/api/bot/heartbeat", data)

            # Parsear comandos
            commands = []
            for cmd in response.get("commands", []):
                commands.append(BotCommand(
                    type=cmd.get("type", ""),
                    reason=cmd.get("reason"),
                ))

            if commands:
                log.info(f"Comandos recibidos: {[c.type for c in commands]}")

            return commands

        except Exception as e:
            log.error(f"Error enviando heartbeat: {e}")
            return []

    # ==================== SIGNAL ====================

    def report_signal(
        self,
        side: str,
        symbol: str,
        message_text: str,
        price: Optional[float] = None,
        channel_id: Optional[str] = None,
        channel_name: Optional[str] = None,
        message_id: Optional[str] = None,
        is_close_signal: bool = False,
    ) -> Optional[str]:
        """
        Reporta una señal detectada de Telegram.

        Returns:
            signal_id si se registró correctamente, None si hubo error
        """
        data = {
            "side": side,
            "symbol": symbol,
            "messageText": message_text,
            "isCloseSignal": is_close_signal,
            "receivedAt": datetime.utcnow().isoformat(),
        }

        if price is not None:
            data["price"] = price
        if channel_id:
            data["channelId"] = channel_id
        if channel_name:
            data["channelName"] = channel_name
        if message_id:
            data["messageId"] = message_id

        try:
            response = self._post("/api/bot/signal", data)
            signal_id = response.get("signalId")
            action = response.get("action", "UNKNOWN")

            log.info(f"Señal reportada: {side} {symbol} -> {action} (id={signal_id})")

            return signal_id

        except Exception as e:
            log.error(f"Error reportando señal: {e}")
            return None

    # ==================== TRADE ====================

    def report_trade_open(
        self,
        bot_account_id: str,
        mt5_ticket: int,
        side: str,
        symbol: str,
        level: int,
        open_price: float,
        lot_size: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        virtual_sl: Optional[float] = None,
        signal_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        Reporta un trade abierto.

        Returns:
            trade_id si se registró correctamente
        """
        data = {
            "action": "OPEN",
            "botAccountId": bot_account_id,
            "mt5Ticket": mt5_ticket,
            "side": side,
            "symbol": symbol,
            "level": level,
            "openPrice": open_price,
            "lotSize": lot_size,
            "openedAt": datetime.utcnow().isoformat(),
        }

        if stop_loss is not None:
            data["stopLoss"] = stop_loss
        if take_profit is not None:
            data["takeProfit"] = take_profit
        if virtual_sl is not None:
            data["virtualSL"] = virtual_sl
        if signal_id:
            data["signalId"] = signal_id

        try:
            response = self._post("/api/bot/trade", data)
            trade_id = response.get("tradeId")

            log.info(f"Trade abierto reportado: #{mt5_ticket} {side} {symbol} @ {open_price}")

            return trade_id

        except Exception as e:
            log.error(f"Error reportando trade abierto: {e}")
            return None

    def report_trade_close(
        self,
        bot_account_id: str,
        mt5_ticket: int,
        close_price: float,
        close_reason: str,
        profit_pips: float,
        profit_money: float,
        commission: Optional[float] = None,
        swap: Optional[float] = None,
    ) -> Optional[str]:
        """
        Reporta un trade cerrado.

        Args:
            close_reason: TAKE_PROFIT, STOP_LOSS, MANUAL, GRID_STEP, VIRTUAL_SL

        Returns:
            trade_id si se actualizó correctamente
        """
        data = {
            "action": "CLOSE",
            "botAccountId": bot_account_id,
            "mt5Ticket": mt5_ticket,
            "closePrice": close_price,
            "closeReason": close_reason,
            "profitPips": profit_pips,
            "profitMoney": profit_money,
            "closedAt": datetime.utcnow().isoformat(),
        }

        if commission is not None:
            data["commission"] = commission
        if swap is not None:
            data["swap"] = swap

        try:
            response = self._post("/api/bot/trade", data)
            trade_id = response.get("tradeId")

            result_emoji = "💰" if profit_money >= 0 else "📉"
            log.info(f"{result_emoji} Trade cerrado: #{mt5_ticket} @ {close_price} -> {profit_money:.2f}")

            return trade_id

        except Exception as e:
            log.error(f"Error reportando trade cerrado: {e}")
            return None

    def report_trade_update(
        self,
        bot_account_id: str,
        mt5_ticket: int,
        current_price: float,
        unrealized_pl: float,
        unrealized_pips: float,
        stop_loss: Optional[float] = None,
        virtual_sl: Optional[float] = None,
    ) -> bool:
        """
        Reporta actualización de posición en vivo.
        """
        data = {
            "action": "UPDATE",
            "botAccountId": bot_account_id,
            "mt5Ticket": mt5_ticket,
            "currentPrice": current_price,
            "unrealizedPL": unrealized_pl,
            "unrealizedPips": unrealized_pips,
        }

        if stop_loss is not None:
            data["stopLoss"] = stop_loss
        if virtual_sl is not None:
            data["virtualSL"] = virtual_sl

        try:
            self._post("/api/bot/trade", data)
            return True

        except Exception as e:
            log.error(f"Error actualizando trade: {e}")
            return False

    # ==================== ERROR ====================

    def report_error(
        self,
        error_type: str,
        message: str,
        stack: Optional[str] = None,
        context: Optional[dict] = None,
        is_fatal: bool = False,
    ) -> str:
        """
        Reporta un error al SaaS.

        Args:
            error_type: MT5_ERROR, TELEGRAM_ERROR, TRADE_ERROR, SYSTEM_ERROR

        Returns:
            Acción recomendada: CONTINUE, PAUSE, RESTART
        """
        data = {
            "type": error_type,
            "message": message,
            "isFatal": is_fatal,
        }

        if stack:
            data["stack"] = stack
        if context:
            data["context"] = context

        try:
            response = self._post("/api/bot/error", data)
            return response.get("action", "CONTINUE")

        except Exception as e:
            log.error(f"Error reportando error: {e}")
            return "CONTINUE"

    # ==================== STATUS ====================

    @property
    def is_paused(self) -> bool:
        """Si el bot debe estar pausado"""
        return self._is_paused

    def set_paused(self, paused: bool, reason: str = ""):
        """Cambia el estado de pausa"""
        self._is_paused = paused
        status = "PAUSADO" if paused else "ACTIVO"
        log.info(f"Bot {status}" + (f" - {reason}" if reason else ""))

    @property
    def last_error(self) -> Optional[str]:
        """Último error ocurrido"""
        return self._last_error

    def close(self):
        """Cierra la sesión HTTP"""
        self.session.close()
        log.info("SaasClient cerrado")
