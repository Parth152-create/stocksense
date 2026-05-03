"""
Anomaly detection using Z-score on price and volume.
Flags unusual movements relative to recent history.
"""

import os
import httpx
import numpy as np
from cachetools import TTLCache

AV_KEY = os.getenv("ALPHA_VANTAGE_KEY")
BASE_URL = "https://www.alphavantage.co/query"

_cache: TTLCache = TTLCache(maxsize=128, ttl=1800)


def _fetch_ohlcv(symbol: str) -> list[dict]:
    params = {
        "function": "TIME_SERIES_DAILY",
        "symbol": symbol,
        "outputsize": "compact",
        "apikey": AV_KEY,
    }
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            series = data.get("Time Series (Daily)", {})
            rows = []
            for date, v in list(series.items())[:30]:
                rows.append({
                    "date": date,
                    "close": float(v["4. close"]),
                    "volume": float(v["6. volume"]),
                    "high": float(v["2. high"]),
                    "low": float(v["3. low"]),
                })
            rows.reverse()
            return rows
    except Exception:
        return []


def _mock_ohlcv(symbol: str) -> list[dict]:
    seed = sum(ord(c) for c in symbol)
    rng = np.random.default_rng(seed)
    base_price = 100 + (seed % 400)
    base_vol = 1_000_000 + (seed % 4_000_000)
    rows = []
    from datetime import datetime, timedelta
    for i in range(30):
        d = datetime.now() - timedelta(days=30 - i)
        close = base_price + rng.normal(0, base_price * 0.015)
        rows.append({
            "date": d.strftime("%Y-%m-%d"),
            "close": round(close, 2),
            "volume": int(base_vol * rng.uniform(0.5, 1.5)),
            "high": round(close * rng.uniform(1.0, 1.02), 2),
            "low": round(close * rng.uniform(0.98, 1.0), 2),
        })
    return rows


def get_anomaly(symbol: str) -> dict:
    cache_key = symbol.upper()
    if cache_key in _cache:
        return _cache[cache_key]

    rows = _fetch_ohlcv(symbol)
    used_mock = False
    if len(rows) < 5:
        rows = _mock_ohlcv(symbol)
        used_mock = True

    closes = np.array([r["close"] for r in rows])
    volumes = np.array([r["volume"] for r in rows])

    # ── Z-score on last point vs prior 20 ────────────────────────────────────
    price_mean = closes[:-1].mean()
    price_std  = closes[:-1].std() or 1
    price_z    = (closes[-1] - price_mean) / price_std

    vol_mean = volumes[:-1].mean()
    vol_std  = volumes[:-1].std() or 1
    vol_z    = (volumes[-1] - vol_mean) / vol_std

    # ── Daily range anomaly ───────────────────────────────────────────────────
    ranges = np.array([(r["high"] - r["low"]) / r["close"] for r in rows])
    range_mean = ranges[:-1].mean()
    range_std  = ranges[:-1].std() or 0.001
    range_z    = (ranges[-1] - range_mean) / range_std

    # ── Flag if any Z-score > 2 ───────────────────────────────────────────────
    anomalies = []
    if abs(price_z) > 2:
        direction = "above" if price_z > 0 else "below"
        anomalies.append(f"Price is {abs(price_z):.1f}σ {direction} 20-day average.")
    if abs(vol_z) > 2:
        direction = "above" if vol_z > 0 else "below"
        anomalies.append(f"Volume is {abs(vol_z):.1f}σ {direction} 20-day average — unusual activity.")
    if abs(range_z) > 2:
        anomalies.append(f"Intraday range {abs(range_z):.1f}σ above normal — high volatility detected.")

    is_anomaly = len(anomalies) > 0
    severity = "high" if max(abs(price_z), abs(vol_z), abs(range_z)) > 3 else \
               "medium" if is_anomaly else "normal"

    result = {
        "symbol": symbol.upper(),
        "is_anomaly": is_anomaly,
        "severity": severity,
        "anomalies": anomalies,
        "summary": " ".join(anomalies) if anomalies else "No unusual activity detected.",
        "z_scores": {
            "price": round(float(price_z), 3),
            "volume": round(float(vol_z), 3),
            "range": round(float(range_z), 3),
        },
        "latest": {
            "date": rows[-1]["date"],
            "close": rows[-1]["close"],
            "volume": int(volumes[-1]),
        },
        "mock": used_mock,
    }

    _cache[cache_key] = result
    return result