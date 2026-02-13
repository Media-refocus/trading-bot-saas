#!/usr/bin/env python3
"""
Parser de señales de Telegram
==============================

Extrae señales estructuradas de los mensajes raw de Telegram.
Convierte el formato libre a señales BUY/SELL con rangos.

Uso:
    python scripts/parse_telegram_signals.py

Input:  docs/telegram_raw_messages.csv
Output: signals_parsed.csv
"""

import csv
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

INPUT_FILE = Path(__file__).parent.parent / "docs" / "telegram_raw_messages.csv"
OUTPUT_FILE = Path(__file__).parent.parent / "signals_parsed.csv"


@dataclass
class Signal:
    timestamp: datetime
    kind: str  # range_open, range_close
    side: Optional[str]  # BUY, SELL
    price_hint: Optional[float]
    range_id: str
    message_id: int
    confidence: float
    raw_text: str


def parse_price(text: str, pattern: str) -> Optional[float]:
    """Extrae un precio del texto usando un patrón."""
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1).replace(",", "."))
        except ValueError:
            pass
    return None


def detect_signal_type(text: str) -> tuple[Optional[str], Optional[float], bool]:
    """
    Detecta si el mensaje es una señal de entrada o salida.

    Returns:
        (side, price, is_close)
        - side: "BUY" o "SELL" si es entrada
        - price: precio si se encuentra
        - is_close: True si es mensaje de cierre
    """
    text_upper = text.upper()

    # Detectar cierre
    close_patterns = [
        r"CERRAMOS",
        r"CERRAR",
        r"CLOSE",
        r"SL\s*\(?",
        r"STOP\s*LOSS",
        r"TOCAN\s*SL",
        r"BREAKEVEN",
        r"BE\s*$",
    ]
    for pattern in close_patterns:
        if re.search(pattern, text_upper):
            return None, None, True

    # Detectar entrada BUY
    if re.search(r"(XAUUSD|ORO|GOLD)?\s*(BUY|COMPRA|LARGO|LONG)", text_upper):
        # Buscar precio
        price = None

        # Patrones de precio
        price_patterns = [
            r"ENTRADA?\s*:?\s*(\d{4}[.,]\d)",
            r"@\s*(\d{4}[.,]\d)",
            r"PRICE?\s*:?\s*(\d{4}[.,]\d)",
            r"(\d{4}[.,]\d{1,2})\b",
        ]
        for pattern in price_patterns:
            price = parse_price(text, pattern)
            if price:
                break

        return "BUY", price, False

    # Detectar entrada SELL
    if re.search(r"(XAUUSD|ORO|GOLD)?\s*(SELL|VENTA|CORTO|SHORT)", text_upper):
        # Buscar precio
        price = None
        price_patterns = [
            r"ENTRADA?\s*:?\s*(\d{4}[.,]\d)",
            r"@\s*(\d{4}[.,]\d)",
            r"PRICE?\s*:?\s*(\d{4}[.,]\d)",
            r"(\d{4}[.,]\d{1,2})\b",
        ]
        for pattern in price_patterns:
            price = parse_price(text, pattern)
            if price:
                break

        return "SELL", price, False

    return None, None, False


def parse_messages(input_file: Path) -> list[Signal]:
    """Parsea todos los mensajes y extrae señales."""
    signals = []
    range_counter = 0
    current_range_id = None
    current_side = None

    with open(input_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")

        for row in reader:
            message_id = int(row["message_id"])
            date_str = row["date_utc"]
            text = row["text"] or ""

            try:
                timestamp = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except ValueError:
                continue

            side, price, is_close = detect_signal_type(text)

            if side and not is_close:
                # Nueva señal de entrada
                range_counter += 1
                date_prefix = timestamp.strftime("%Y-%m-%d")
                current_range_id = f"{date_prefix}-{range_counter}"
                current_side = side

                signals.append(Signal(
                    timestamp=timestamp,
                    kind="range_open",
                    side=side,
                    price_hint=price,
                    range_id=current_range_id,
                    message_id=message_id,
                    confidence=0.90,
                    raw_text=text[:100]
                ))

            elif is_close and current_range_id:
                # Cierre de señal
                signals.append(Signal(
                    timestamp=timestamp,
                    kind="range_close",
                    side=None,
                    price_hint=None,
                    range_id=current_range_id,
                    message_id=message_id,
                    confidence=0.95,
                    raw_text=text[:100]
                ))
                # Reset para siguiente rango
                current_range_id = None
                current_side = None

    return signals


def save_signals(signals: list[Signal], output_file: Path):
    """Guarda las señales en formato CSV."""
    with open(output_file, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow([
            "ts_utc", "kind", "side", "price_hint",
            "range_id", "message_id", "confidence"
        ])

        for s in signals:
            writer.writerow([
                s.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                s.kind,
                s.side or "",
                s.price_hint or "",
                s.range_id,
                s.message_id,
                s.confidence
            ])

    print(f"Guardadas {len(signals)} señales en {output_file}")


def print_stats(signals: list[Signal]):
    """Imprime estadísticas de las señales."""
    opens = [s for s in signals if s.kind == "range_open"]
    closes = [s for s in signals if s.kind == "range_close"]

    buys = [s for s in opens if s.side == "BUY"]
    sells = [s for s in opens if s.side == "SELL"]

    print("\n=== ESTADÍSTICAS ===")
    print(f"Total señales: {len(opens)} rangos abiertos")
    print(f"Señales BUY: {len(buys)}")
    print(f"Señales SELL: {len(sells)}")
    print(f"Cierres detectados: {len(closes)}")

    if opens:
        print(f"\nPrimera señal: {opens[0].timestamp.date()}")
        print(f"Última señal: {opens[-1].timestamp.date()}")

        # Por mes
        months = {}
        for s in opens:
            month_key = s.timestamp.strftime("%Y-%m")
            months[month_key] = months.get(month_key, 0) + 1

        print("\nSeñales por mes:")
        for month in sorted(months.keys()):
            print(f"  {month}: {months[month]} señales")


def main():
    print("=== PARSER DE SEÑALES DE TELEGRAM ===")
    print(f"Input: {INPUT_FILE}")
    print(f"Output: {OUTPUT_FILE}")

    if not INPUT_FILE.exists():
        print(f"Error: No existe {INPUT_FILE}")
        return

    print("\nParseando mensajes...")
    signals = parse_messages(INPUT_FILE)

    print_stats(signals)

    print(f"\nGuardando en {OUTPUT_FILE}...")
    save_signals(signals, OUTPUT_FILE)

    print("\n¡Listo!")


if __name__ == "__main__":
    main()
