"""
Price prediction using Alpha Vantage daily history + linear regression.
Predicts next-day and next-week closing price.
Redis cache: ml:prediction:{symbol} with 3600s TTL.
"""

import os
from datetime import date
import httpx
import numpy as np
from sklearn.linear_model import LinearRegression
from services.redis_cache import get as cache_get, set as cache_set

AV_KEY   = os.getenv("ALPHA_VANTAGE_KEY")
BASE_URL = "https://www.alphavantage.co/query"


def _cache_key(symbol: str) -> str:
    return f"ml:prediction:{symbol.upper()}:{date.today()}"


def _fetch_history(symbol: str) -> list[float]:
    params = {
        "function":   "TIME_SERIES_DAILY",
        "symbol":     symbol,
        "outputsize": "compact",
        "apikey":     AV_KEY,
    }
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(BASE_URL, params=params)
            resp.raise_for_status()
            series = resp.json().get("Time Series (Daily)", {})
            closes = [float(v["4. close"]) for v in list(series.values())[:60]]
            closes.reverse()
            return closes
    except Exception:
        return []


def _mock_closes(symbol: str) -> list[float]:
    seed   = sum(ord(c) for c in symbol)
    base   = 100 + (seed % 400)
    prices = [base]
    rng    = np.random.default_rng(seed)
    for _ in range(59):
        prices.append(round(prices[-1] + rng.normal(0, base * 0.012), 2))
    return prices


def get_prediction(symbol: str) -> dict:
    key    = _cache_key(symbol)
    cached = cache_get(key)
    if cached:
        return cached

    closes    = _fetch_history(symbol)
    used_mock = False
    if len(closes) < 10:
        closes    = _mock_closes(symbol)
        used_mock = True

    closes_arr    = np.array(closes)
    current_price = closes_arr[-1]

    window = closes_arr[-30:]
    X      = np.arange(len(window)).reshape(-1, 1)
    model  = LinearRegression().fit(X, window)

    next_day_price  = float(model.predict([[len(window)]])[0])
    next_week_price = float(model.predict([[len(window) + 5]])[0])

    deltas   = np.diff(closes_arr[-15:])
    avg_gain = deltas[deltas > 0].mean() if len(deltas[deltas > 0]) > 0 else 0.001
    avg_loss = (-deltas[deltas < 0]).mean() if len(deltas[deltas < 0]) > 0 else 0.001
    rsi      = round(100 - (100 / (1 + avg_gain / avg_loss)), 1)

    momentum_5d = round(((closes_arr[-1] - closes_arr[-6]) / closes_arr[-6]) * 100, 2)
    r2          = model.score(X, window)
    confidence  = round(max(0.4, min(0.95, abs(r2))) * 100, 1)

    result = {
        "symbol":               symbol.upper(),
        "current_price":        round(current_price, 2),
        "next_day":             round(next_day_price, 2),
        "next_day_change_pct":  round(((next_day_price - current_price) / current_price) * 100, 2),
        "next_week":            round(next_week_price, 2),
        "next_week_change_pct": round(((next_week_price - current_price) / current_price) * 100, 2),
        "rsi":                  rsi,
        "momentum_5d":          momentum_5d,
        "confidence":           confidence,
        "model":                "linear_regression",
        "data_points":          len(closes),
        "mock":                 used_mock,
    }

    cache_set(key, result, ttl=3600)
    return result
