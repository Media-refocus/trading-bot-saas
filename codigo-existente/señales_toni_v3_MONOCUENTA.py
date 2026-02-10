#!/usr/bin/env python3
# beta_toni_multicuenta_scalping.py – grid-scalping multicuenta 2.2-F
# ------------------------------------------------------------------
# · Replica señales BUY / SELL que llegan por Telegram en múltiples
#   cuentas MT5 (definidas en copiador.yml).
# · Mantiene una grilla infinita SIN duplicar niveles y con trailing-SL
#   virtual en la entrada.
# · Al detectar la cadena “cerramos rango” (aunque vaya rodeada de
#   emojis o texto) cierra TODO y reinicia el bot.
# ------------------------------------------------------------------
# Requiere: PyYAML · Telethon · MetaTrader5 ≥ 5.0.45 · Python ≥ 3.9
# ------------------------------------------------------------------

from __future__ import annotations
import asyncio, json, logging, re, threading, time, sys, unicodedata
from pathlib import Path
from typing import Any

import yaml
from telethon import TelegramClient, events
from telethon.tl.types import InputChannel
import MetaTrader5 as mt

# ───────────────────────── logging ────────────────────────────────
FMT     = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATEFMT = "%Y-%m-%d %H:%M:%S"

_root = logging.getLogger()
_root.setLevel(logging.INFO)

_hdlr = logging.StreamHandler()
_hdlr.setFormatter(logging.Formatter(FMT, DATEFMT))
_root.addHandler(_hdlr)

for noisy in ("telethon", "asyncio"):
    logging.getLogger(noisy).setLevel(logging.WARNING)
# ------------------------------------------------------------------

def strip_accents(txt: str) -> str:
    """Convierte 'cérra­mos' → 'cerramos' para no romper regex."""
    return "".join(c for c in unicodedata.normalize("NFD", txt)
                   if unicodedata.category(c) != "Mn")

# ───────────────────────── AccountBot ─────────────────────────────
class AccountBot:
    """Gestor de una única cuenta MT5 (grid infinita sin duplicados)."""

    mt_lock  = threading.RLock()
    DIST_PIP = 0.10                    # 1 pip ≈ 0.10 USD (XAU/USD típico)

    def __init__(self, cfg: dict[str, Any]):
        # ── credenciales ──────────────────────────────────────────
        self.login, self.password = cfg["login"], cfg["password"]
        self.server, self.path    = cfg["server"], cfg["path"]
        self.SYMBOL, self.MAGIC   = cfg["symbol"], cfg["magic"]

        # ── parámetros YAML ───────────────────────────────────────
        self.entry_cfg = cfg["entry"]
        self.prom_cfg  = cfg["promedios"]

        # ── geometría grilla ──────────────────────────────────────
        self.GRID_DIST = self.prom_cfg["step_pips"] * self.DIST_PIP
        self.HALF_GRID = self.GRID_DIST / 2
        self.EPS       = 1e-6

        # ── estado persistente ────────────────────────────────────
        self.state_file = Path(f"state_{self.login}.json")
        self.state = {
            "side"          : None,  # BUY / SELL
            "entry"         : None,  # precio nivel 0
            "entry_open"    : False,
            "entry_sl"      : None,  # trailing-SL virtual
            "pending_levels": [],    # niveles con orden en curso
        }
        self._load_state()
        self._sanitize_pending()

        # ── logger por cuenta ─────────────────────────────────────
        Path("logs").mkdir(exist_ok=True)
        self.log = logging.getLogger(f"bot.{self.login}")
        self.log.setLevel(logging.DEBUG)
        fh = logging.FileHandler(f"logs/bot_{self.login}.log", encoding="utf-8")
        fh.setFormatter(logging.Formatter(FMT, DATEFMT))
        self.log.addHandler(fh)

        self._mt5_ready = False       # cache de inicialización

    # ===== estado =====
    def _load_state(self) -> None:
        if self.state_file.exists():
            try:
                data = json.loads(self.state_file.read_text())
                # compat: lista simple → lista única
                if isinstance(data.get("pending_levels"), list):
                    if data["pending_levels"] and isinstance(data["pending_levels"][0], int):
                        data["pending_levels"] = list(set(data["pending_levels"]))
                self.state.update(data)
            except Exception as e:
                self.log.error("state corrupt → reset (%s)", e)

    def _save_state(self) -> None:
        self.state_file.write_text(json.dumps(self.state, ensure_ascii=False))

    # ===== MetaTrader conexión =====
    def _mt5(self) -> bool:
        if self._mt5_ready and mt.terminal_info():
            return True
        ok = mt.initialize(login=self.login, password=self.password,
                           server=self.server, path=self.path)
        self._mt5_ready = bool(ok)
        return self._mt5_ready

    # ===== precio / enviar / cerrar =====
    def _price(self, side: str, retry: int = 30) -> float | None:
        with AccountBot.mt_lock:
            if not self._mt5():
                self.log.error("MT5 init error: %s", mt.last_error())
                return None
            for _ in range(retry):
                mt.symbol_select(self.SYMBOL, True)
                t = mt.symbol_info_tick(self.SYMBOL)
                if t and t.bid and t.ask:
                    return t.ask if side == "BUY" else t.bid
                time.sleep(0.5)
        return None

    def send(self, side: str, lot: float, n: int = 1, *, set_entry=False) -> bool:
        px = self._price(side)
        if px is None:
            return False
        base = {
            "action"      : mt.TRADE_ACTION_DEAL,
            "symbol"      : self.SYMBOL,
            "volume"      : lot,
            "type"        : mt.ORDER_TYPE_BUY if side == "BUY" else mt.ORDER_TYPE_SELL,
            "price"       : px,
            "deviation"   : 100,
            "magic"       : self.MAGIC,
            "comment"     : "multi",
            "type_time"   : mt.ORDER_TIME_GTC,
            "type_filling": getattr(mt, "ORDER_FILLING_IOC", 1),
        }
        success = False
        with AccountBot.mt_lock:
            if not self._mt5():
                return False
            for i in range(n):
                r = mt.order_send(base)
                if r and r.retcode == 10009:
                    success = True
                    self.log.info("🚀 %s %.2f lot #%d @ %.5f",
                                  side, lot, i+1, r.price or px)
        if success and set_entry and self.state["entry"] is None:
            self.state["entry"] = px
            self._save_state()
        return success

    def _close_ticket(self, pos, side: str) -> None:
        op  = mt.ORDER_TYPE_BUY if side == "SELL" else mt.ORDER_TYPE_SELL
        px  = self._price("BUY" if op == mt.ORDER_TYPE_BUY else "SELL")
        if px is None:
            return
        req = {
            "action"      : mt.TRADE_ACTION_DEAL,
            "symbol"      : self.SYMBOL,
            "volume"      : pos.volume,
            "type"        : op,
            "price"       : px,
            "deviation"   : 100,
            "magic"       : self.MAGIC,
            "position"    : pos.ticket,
            "comment"     : "multi_close",
            "type_time"   : mt.ORDER_TIME_GTC,
            "type_filling": getattr(mt, "ORDER_FILLING_IOC", 1),
        }
        with AccountBot.mt_lock:
            if self._mt5():
                mt.order_send(req)

    # ===== sanitizar pendientes al arrancar =====
    def _sanitize_pending(self) -> None:
        if not self.state["pending_levels"]:
            return
        with AccountBot.mt_lock:
            if not self._mt5():
                return
            poss   = mt.positions_get(symbol=self.SYMBOL) or []
            orders = mt.orders_get(symbol=self.SYMBOL)    or []
        p0 = self.state["entry"] or 0
        vivos = {int((abs(p.price_open - p0)+self.HALF_GRID)//self.GRID_DIST)
                 for p in poss if p.magic == self.MAGIC}
        en_mercado = {int((abs(o.price_open - p0)+self.HALF_GRID)//self.GRID_DIST)
                      for o in orders if o.magic == self.MAGIC}
        self.state["pending_levels"] = [lv for lv in self.state["pending_levels"]
                                        if lv in vivos or lv in en_mercado]
        self._save_state()

    # ===== CLOSE ALL =====
    def close_all(self):
        self.is_closing = True
        with AccountBot.mt_lock:
            if self._mt5():
                while True:
                    poss = mt.positions_get(symbol=self.SYMBOL) or []
                    if not poss:
                        break
                    for pos in poss:
                        side = "BUY" if pos.type == 0 else "SELL"
                        self._close_ticket(pos, side)
        self.log.info("🛑 posiciones cerradas (login %s)", self.login)
        self.state.update({
            "side" : None, "entry" : None, "entry_open" : False,
            "entry_sl" : None, "pending_levels" : [] })
        self._save_state()
        self.is_closing = False

    # ===== trailing-SL virtual =====
    def _entry_trailing(self, p_close: float):
        cfg = (self.entry_cfg or {}).get("trailing")
        if not cfg or not self.state["entry_open"]:
            return
        side   = self.state["side"]
        entry  = self.state["entry"]
        spread = (mt.symbol_info(self.SYMBOL).spread or 0) * self.DIST_PIP
        buffer = cfg.get("buffer_pips", 1) * self.DIST_PIP + spread

        activate = cfg.get("activate", 30) * self.DIST_PIP
        back     = cfg.get("back",     20) * self.DIST_PIP
        step     = cfg.get("step",     10) * self.DIST_PIP

        if side == "BUY":
            if p_close >= entry + activate:
                tgt = p_close - back
                cur = self.state.get("entry_sl")
                if cur is None or tgt - cur >= step - self.EPS:
                    self.state["entry_sl"] = tgt - buffer
        else:
            if p_close <= entry - activate:
                tgt = p_close + back
                cur = self.state.get("entry_sl")
                if cur is None or cur - tgt >= step - self.EPS:
                    self.state["entry_sl"] = tgt + buffer
        self._save_state()

    def _check_entry_sl_hit(self, p_close: float, niveles: dict[int, list]):
        sl = self.state.get("entry_sl")
        if sl is None:
            return
        side = self.state["side"]
        if (p_close <= sl and side == "BUY") or (p_close >= sl and side == "SELL"):
            for pos in niveles.get(0, []):
                self._close_ticket(pos, side)
            if niveles.get(0):
                self.log.info("🔒 SL virtual L0 ejecutado (login %s)", self.login)
            niveles.pop(0, None)
            self.state.update({"entry_open": False, "entry_sl": None})
            self._save_state()

    # ===== manage grid =====
    def manage_grid(self):
        if getattr(self, "is_closing", False) or not self.state["side"]:
            return
        side, p0 = self.state["side"], self.state["entry"]
        if not p0:
            return
        with AccountBot.mt_lock:
            if not self._mt5():
                return
            tick = mt.symbol_info_tick(self.SYMBOL)
        if not tick or not tick.bid or not tick.ask:
            return
        p_close = tick.bid if side == "BUY" else tick.ask

        # trailing-SL
        self._entry_trailing(p_close)

        # ─ posiciones vivas agrupadas por nivel ────────────────────────
        niveles: dict[int, list] = {}
        with AccountBot.mt_lock:
            poss = mt.positions_get(symbol=self.SYMBOL) or []
        for pos in poss:
            if pos.magic != self.MAGIC:
                continue
            diff = abs(pos.price_open - p0)
            lvl  = int((diff + self.HALF_GRID) // self.GRID_DIST)
            niveles.setdefault(lvl, []).append(pos)

        # revisar SL virtual
        self._check_entry_sl_hit(p_close, niveles)

        # ─ cierre escalones (profit) ──────────────────────────────────
        for lvl in list(niveles):          # list() evita KeyError tras pop
            if lvl == 0:
                continue
            lst = niveles[lvl]
            gain = (p_close - lst[0].price_open) if side == "BUY" else (lst[0].price_open - p_close)
            if gain >= self.GRID_DIST - self.EPS:
                for pos in lst:
                    self._close_ticket(pos, side)
                niveles.pop(lvl, None)
                if lvl in self.state["pending_levels"]:
                    self.state["pending_levels"].remove(lvl)
                self.log.info("💰 Escalón %d cerrado (login %s)", lvl, self.login)

        # ─ depurar pendientes vs MT5 ──────────────────────────────────
        p_pending: set[int] = set(self.state["pending_levels"])
        for lv in list(p_pending):
            if niveles.get(lv):            # posición ya viva
                p_pending.discard(lv)

        with AccountBot.mt_lock:
            orders = mt.orders_get(symbol=self.SYMBOL) or []
        live_ord_lv = {int((abs(o.price_open - p0)+self.HALF_GRID)//self.GRID_DIST)
                       for o in orders if o.magic == self.MAGIC}
        for lv in list(p_pending):
            if lv not in live_ord_lv and lv not in niveles:
                p_pending.discard(lv)      # orden cancelada

        # ─ apertura nuevos escalones ─────────────────────────────────
        against = (p0 - p_close) if side == "BUY" else (p_close - p0)
        if against >= self.GRID_DIST - self.EPS:
            deepest = int((against + self.HALF_GRID) // self.GRID_DIST)

            vivos_por_nivel = {lv: len(lst) for lv, lst in niveles.items() if lv >= 1}
            free_global = (self.prom_cfg["max"] - sum(vivos_por_nivel.values()) - len(p_pending))

            for lvl in range(1, deepest + 1):
                max_lvl = self.prom_cfg.get("num_orders", 1)
                vivos   = vivos_por_nivel.get(lvl, 0)
                en_cola = 1 if lvl in p_pending else 0
                dispo   = max_lvl - vivos - en_cola
                if dispo <= 0 or free_global <= 0:
                    continue
                if self.send(side, self.prom_cfg["lot"], 1):
                    p_pending.add(lvl)
                    free_global -= 1

        self.state["pending_levels"] = sorted(p_pending)
        self._save_state()

    # ===== handler señal BUY / SELL =====
    def handle_signal(self, side: str):
        self.state.update({
            "side"          : side,
            "entry"         : None,
            "entry_open"    : False,
            "entry_sl"      : None,
            "pending_levels": [],
        })
        self._save_state()

        if self.send(side,
                     self.entry_cfg["lot"],
                     self.entry_cfg.get("num_orders", 1),
                     set_entry=True):
            self.state["entry_open"] = True
            self._save_state()

# ──────────────────────── carga YAML ──────────────────────────────
if len(sys.argv) < 2:
    sys.exit("Uso: python beta_toni_multicuenta_scalping.py copiador.yml")

YAML_FILE = Path(sys.argv[1])
if not YAML_FILE.exists():
    sys.exit(f"No existe {YAML_FILE}")

with YAML_FILE.open("r", encoding="utf-8-sig", errors="replace") as fh:
    cfg = yaml.safe_load(fh)

accounts_cfg = cfg.get("accounts") or sys.exit("YAML sin 'accounts:'")

# ───────────────── Telegram cfg ───────────────────────────────────
API_ID   = cfg["telegram"]["api_id"]
API_HASH = cfg["telegram"]["api_hash"]
SESSION  = cfg["telegram"]["session"]
CHANNELS = [InputChannel(c["id"], c["access_hash"]) if c.get("access_hash") else c["id"]
            for c in cfg["telegram"]["channels"]]

client = TelegramClient(SESSION, API_ID, API_HASH)

# ───────────────── bots por cuenta ────────────────────────────────
BOTS: list[AccountBot] = [AccountBot(ac) for ac in accounts_cfg]

# ───────────────── patrones TG ────────────────────────────────────
BASE_PATTERN = "|".join({re.sub(r"[^A-Z]+", "", b.SYMBOL.split("-")[0]) for b in BOTS})
SIG_RE   = re.compile(rf"\b(BUY|SELL)\b\s+\d+(?:[.,]\d+)?\s+({BASE_PATTERN})(?:[-\w]*)", re.I)
CLOSE_RE = re.compile(r"cerramos[\W_]*rango", re.I | re.UNICODE)

# ───────────────── TG handlers ────────────────────────────────────
@client.on(events.NewMessage(chats=CHANNELS))
async def on_message(ev):
    txt_raw  = ev.message.message.strip()
    txt_norm = strip_accents(txt_raw.lower())

    # cierre total
    if CLOSE_RE.search(txt_norm):
        _root.info("📩 CERRAMOS RANGO → %s", txt_raw[:60])
        for bot in BOTS:
            await asyncio.get_event_loop().run_in_executor(None, bot.close_all)
        return

    # señal BUY / SELL
    m = SIG_RE.search(txt_raw)
    if m:
        side = m.group(1).upper()
        _root.info("📩 Señal %s detectada (%s)", side, m.group(0))
        for bot in BOTS:
            await asyncio.get_event_loop().run_in_executor(None, bot.handle_signal, side)

# ───────────────── watchdog (grid) ────────────────────────────────
async def watchdog():
    while True:
        loop = asyncio.get_event_loop()
        tasks = [loop.run_in_executor(None, b.manage_grid) for b in BOTS]
        await asyncio.gather(*tasks)
        await asyncio.sleep(0.5)

# ───────────────── main ───────────────────────────────────────────
async def main():
    await client.start()
    _root.info("🤖 Telegram conectado. Escuchando señales…")
    asyncio.create_task(watchdog())
    await client.run_until_disconnected()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
