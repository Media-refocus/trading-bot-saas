#!/usr/bin/env python3
"""
Signal Ingestor - Telegram → SaaS
==================================

Escucha señales de Telegram y las envía al SaaS para distribución
a todos los bots de clientes.

Uso:
    python telegram_to_saas.py --config ingestor.yml
"""

from __future__ import annotations
import argparse
import asyncio
import json
import logging
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml
import requests
from telethon import TelegramClient, events
from telethon.tl.types import InputChannel

# ───────────────────────── logging ────────────────────────────────
FMT = "%(asctime)s | %(levelname)-8s | %(message)s"
DATEFMT = "%Y-%m-%d %H:%M:%S"

logging.basicConfig(level=logging.INFO, format=FMT, datefmt=DATEFMT)
log = logging.getLogger("ingestor")

for noisy in ("telethon", "asyncio"):
    logging.getLogger(noisy).setLevel(logging.WARNING)


# ───────────────────────── Config ─────────────────────────────────
class Config:
    def __init__(self, path: str):
        with open(path, "r", encoding="utf-8-sig") as f:
            data = yaml.safe_load(f)

        # Telegram
        self.telegram_api_id = data.get("telegram", {}).get("api_id")
        self.telegram_api_hash = data.get("telegram", {}).get("api_hash")
        self.telegram_session = data.get("telegram", {}).get("session", "ingestor")
        self.channels = data.get("telegram", {}).get("channels", [])

        # SaaS
        self.saas_url = data.get("saas", {}).get("url", "http://localhost:3000")
        self.saas_api_key = data.get("saas", {}).get("api_key", "")

        # Opciones
        self.dry_run = data.get("options", {}).get("dry_run", False)
        self.log_signals = data.get("options", {}).get("log_signals", True)


# ───────────────────────── Signal Parser ──────────────────────────
class SignalParser:
    """Parser de señales de Telegram"""

    # Patrones
    ENTRY_PATTERN = re.compile(
        r"\b(BUY|SELL)\b\s+(\d+(?:[.,]\d+)?)\s+(XAUUSD|GOLD|ORO)",
        re.IGNORECASE
    )
    CLOSE_PATTERN = re.compile(
        r"cerramos[\W_]*rango",
        re.IGNORECASE | re.UNICODE
    )
    RISK_PATTERN = re.compile(
        r"\b(RIESGO|SIN[\W_]*PROMEDIOS?|SOLO[\W_]*1[\W_]*PROMEDIO)\b",
        re.IGNORECASE
    )

    @staticmethod
    def strip_accents(txt: str) -> str:
        """Convierte 'cérramos' → 'cerramos'"""
        return "".join(
            c for c in unicodedata.normalize("NFD", txt)
            if unicodedata.category(c) != "Mn"
        )

    @classmethod
    def parse(cls, message: str) -> Optional[dict]:
        """Parsea un mensaje de Telegram y extrae la señal"""

        # Normalizar texto
        text_norm = cls.strip_accents(message.lower())

        # Detectar cierre de rango
        if cls.CLOSE_PATTERN.search(text_norm):
            return {
                "type": "CLOSE_RANGE",
                "side": None,
                "price": None,
                "symbol": "XAUUSD",
                "restriction": None,
                "messageText": message,
            }

        # Detectar entrada
        entry_match = cls.ENTRY_PATTERN.search(message)
        if entry_match:
            side = entry_match.group(1).upper()
            price_str = entry_match.group(2).replace(",", ".")
            try:
                price = float(price_str)
            except ValueError:
                price = None

            # Detectar restricciones
            restriction = None
            risk_match = cls.RISK_PATTERN.search(message)
            if risk_match:
                restriction = risk_match.group(1).upper().replace(" ", "_")
                # Normalizar
                if "SIN_PROMEDIO" in restriction:
                    restriction = "SIN_PROMEDIOS"
                elif "SOLO_1" in restriction:
                    restriction = "SOLO_1_PROMEDIO"
                elif "RIESGO" in restriction:
                    restriction = "RIESGO"

            return {
                "type": "ENTRY",
                "side": side,
                "price": price,
                "symbol": "XAUUSD",
                "restriction": restriction,
                "messageText": message,
            }

        return None


# ───────────────────────── SaaS Client ────────────────────────────
class SaaSClient:
    """Cliente para enviar señales al SaaS"""

    def __init__(self, config: Config):
        self.url = config.saas_url.rstrip("/")
        self.api_key = config.saas_api_key
        self.session = requests.Session()
        if self.api_key:
            self.session.headers.update({
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            })

    def send_signal(self, signal: dict) -> bool:
        """Envía una señal al SaaS"""
        try:
            resp = self.session.post(
                f"{self.url}/api/signals/ingest",
                json=signal,
                timeout=10
            )

            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    log.info(f"✅ Señal enviada al SaaS: {signal['type']} {signal.get('side', '')}")
                    return True
                else:
                    log.error(f"❌ Error del SaaS: {data.get('error')}")
            else:
                log.error(f"❌ Error HTTP {resp.status_code}: {resp.text[:200]}")

        except Exception as e:
            log.error(f"❌ Error enviando señal: {e}")

        return False


# ───────────────────────── Ingestor ────────────────────────────────
class Ingestor:
    """Ingestor principal"""

    def __init__(self, config: Config):
        self.config = config
        self.parser = SignalParser()
        self.saas = SaaSClient(config) if not config.dry_run else None

        # Telegram client
        self.client = TelegramClient(
            config.telegram_session,
            config.telegram_api_id,
            config.telegram_api_hash
        )

        # Estadísticas
        self.stats = {
            "messages_received": 0,
            "signals_parsed": 0,
            "signals_sent": 0,
            "errors": 0,
        }

    async def on_message(self, event):
        """Manejador de mensajes de Telegram"""
        try:
            message = event.message.message
            if not message:
                return

            self.stats["messages_received"] += 1

            # Parsear señal
            signal = self.parser.parse(message)
            if not signal:
                return  # No es una señal, ignorar

            self.stats["signals_parsed"] += 1

            # Log
            if self.config.log_signals:
                log.info(f"📩 Señal detectada: {signal['type']} {signal.get('side', '')} | {signal.get('restriction', '-')}")
                log.info(f"   Mensaje: {message[:100]}...")

            # Enviar al SaaS
            if self.saas:
                if self.saas.send_signal(signal):
                    self.stats["signals_sent"] += 1
                else:
                    self.stats["errors"] += 1
            else:
                log.info(f"🔄 DRY RUN - Señal no enviada")

        except Exception as e:
            log.error(f"Error procesando mensaje: {e}")
            self.stats["errors"] += 1

    async def run(self):
        """Ejecuta el ingestor"""
        log.info("=" * 60)
        log.info("🚀 Signal Ingestor iniciando...")
        log.info(f"   SaaS URL: {self.config.saas_url}")
        log.info(f"   Canales: {len(self.config.channels)}")
        log.info(f"   Dry run: {self.config.dry_run}")
        log.info("=" * 60)

        # Conectar a Telegram
        await self.client.start()
        log.info("✅ Conectado a Telegram")

        # Suscribirse a canales
        for channel in self.config.channels:
            channel_id = channel.get("id")
            access_hash = channel.get("access_hash")

            if access_hash:
                entity = InputChannel(channel_id, access_hash)
            else:
                entity = channel_id

            self.client.add_event_handler(
                self.on_message,
                events.NewMessage(chats=[entity])
            )
            log.info(f"📢 Escuchando canal: {channel_id}")

        # Mantener corriendo
        log.info("🎧 Escuchando señales... (Ctrl+C para detener)")
        await self.client.run_until_disconnected()

    async def stop(self):
        """Detiene el ingestor"""
        log.info("⏹️ Deteniendo ingestor...")
        log.info(f"   Estadísticas: {self.stats}")
        await self.client.disconnect()


# ───────────────────────── API Endpoint para señales ───────────────
# Este endpoint debe crearse en el SaaS para recibir señales del ingestor


# ───────────────────────── Main ────────────────────────────────────
async def main():
    parser = argparse.ArgumentParser(description="Signal Ingestor")
    parser.add_argument("--config", required=True, help="Archivo de configuración YAML")
    args = parser.parse_args()

    if not Path(args.config).exists():
        log.error(f"❌ Archivo de configuración no encontrado: {args.config}")
        sys.exit(1)

    config = Config(args.config)

    if not config.telegram_api_id or not config.telegram_api_hash:
        log.error("❌ Faltan credenciales de Telegram (api_id, api_hash)")
        sys.exit(1)

    ingestor = Ingestor(config)

    try:
        await ingestor.run()
    except KeyboardInterrupt:
        await ingestor.stop()


if __name__ == "__main__":
    asyncio.run(main())
