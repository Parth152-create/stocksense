"""
Anomaly detection using Z-score on price and volume.
Redis cache: ml:anomaly:{symbol}:{date} with 1800s TTL.
"""

import os
from datetime import datetime, timedelta, date
import httpx
import numpy as np
from services.redis_cache import get as cache_get, set as cache_set

AV_KEY   = os.getenv("ALPHA_VANTAGE_KEY")
BASE_URL = "https://www.alphavantage.co/query"


def _cache_key(symbol: str) -> str:
    return f"ml:anomaly:{symbol.upper()}:{date.today()}"


def _fetch_ohlcv(symbol: str) -> list[dict]:
    params = {
        "function":   "TIME_SERIES_DAILY",
        "symbol":     symbol,
        "outputsize": "compact",
        "apikey":     AV_KEY,
    }
    try:
        with httpx.Client(timeout=15) as client:
            resp   = client.get(BASE_URL, params=params)
            resp.raise_for_status()
            series = resp.json().get("Time Series (Daily)", {})
            rows   = [
                {
                    "date":   d,
                    "close":  float(v["4. close"]),
                    "volume": float(v["6. volume"]),
                    "high":   float(v["2. high"]),
                    "low":    float(v["3. low"]),
                }
                for d, v in list(series.items())[:30]
            ]
            rows.reverse()
            return rows
    except Exception:
        return []


def _mock_ohlcv(symbol: str) -> list[dict]:
    seed       = sum(ord(c) for c in symbol)
    rng        = np.random.default_rng(seed)
    base_price = 100 + (seed % 400)
    base_vol   = 1_000_000 + (seed % 4_000_000)
    rows       = []
    for i in range(30):
        d     = datetime.now() - timedelta(days=30 - i)
        close = base_price + rng.normal(0, base_price * 0.015)
        rows.append({
            "date":   d.strftime("%Y-%m-%d"),
            "close":  round(close, 2),
            "volume": int(base_vol * rng.uniform(0.5, 1.5)),
            "high":   round(close * rng.uniform(1.0, 1.02), 2),
            "low":    round(close * rng.uniform(0.98, 1.0), 2),
        })
    return rows


def get_anomaly(symbol: str) -> dict:
    key    = _cache_key(symbol)
    cached = cache_get(key)
    if cached:
        return cached

    rows      = _fetch_ohlcv(symbol)
    used_mock = False
    if len(rows) < 5:
        rows      = _mock_ohlcv(symbol)
        used_mock = True

    closes  = np.array([r["close"]  for r in rows])
    volumes = np.array([r["volume"] for r in rows])
    ranges  = np.array([(r["high"] - r["low"]) / r["close"] for r in rows])

    def z_score(arr): 
        std = arr[:-1].std() or 1
        return (arr[-1] - arr[:-1].mean()) / std

    price_z = z_score(closes)
    vol_z   = z_score(volumes)
    range_z = z_score(ranges)

    anomalies = []
    if abs(price_z) > 2:
        anomalies.append(f"Price is {abs(price_z):.1f}σ {'above' if price_z > 0 else 'below'} 20-day average.")
    if abs(vol_z) > 2:
        anomalies.append(f"Volume is {abs(vol_z):.1f}σ {'above' if vol_z > 0 else 'below'} 20-day average — unusual activity.")
    if abs(range_z) > 2:
        anomalies.append(f"Intraday range {abs(range_z):.1f}σ above normal — high volatility detected.")

    max_z    = max(abs(price_z), abs(vol_z), abs(range_z))
    severity = "high" if max_z > 3 else "medium" if anomalies else "normal"

    result = {
        "symbol":     symbol.upper(),
        "is_anomaly": bool(anomalies),
        "severity":   severity,
        "anomalies":  anomalies,
        "summary":    " ".join(anomalies) if anomalies else "No unusual activity detected.",
        "z_scores":   {
            "price":  round(float(price_z), 3),
            "volume": round(float(vol_z), 3),
            "range":  round(float(range_z), 3),
        },
        "latest": {
            "date":   rows[-1]["date"],
            "close":  rows[-1]["close"],
            "volume": int(volumes[-1]),
        },
        "mock": used_mock,
    }

    cache_set(key, result, ttl=1800)
    return result
