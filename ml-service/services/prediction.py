"""
Price prediction using Alpha Vantage daily history + linear regression.
Predicts next-day and next-week closing price.
"""

import os
import httpx
import numpy as np
from sklearn.linear_model import LinearRegression
from cachetools import TTLCache

AV_KEY = os.getenv("ALPHA_VANTAGE_KEY")
BASE_URL = "https://www.alphavantage.co/query"

# Cache predictions for 60 minutes
_cache: TTLCache = TTLCache(maxsize=128, ttl=3600)


def _fetch_history(symbol: str) -> list[float]:
    """Fetch last 60 daily closing prices from Alpha Vantage."""
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
            closes = [
                float(v["4. close"])
                for v in list(series.values())[:60]
            ]
            closes.reverse()  # oldest first
            return closes
    except Exception:
        return []


def _mock_closes(symbol: str) -> list[float]:
    """Deterministic mock prices when API fails."""
    seed = sum(ord(c) for c in symbol)
    base = 100 + (seed % 400)
    prices = [base]
    rng = np.random.default_rng(seed)
    for _ in range(59):
        change = rng.normal(0, base * 0.012)
        prices.append(round(prices[-1] + change, 2))
    return prices


def get_prediction(symbol: str) -> dict:
    cache_key = symbol.upper()
    if cache_key in _cache:
        return _cache[cache_key]

    closes = _fetch_history(symbol)
    used_mock = False
    if len(closes) < 10:
        closes = _mock_closes(symbol)
        used_mock = True

    closes_arr = np.array(closes)
    current_price = closes_arr[-1]

    # ── Linear regression over last 30 days ──────────────────────────────────
    window = closes_arr[-30:]
    X = np.arange(len(window)).reshape(-1, 1)
    y = window
    model = LinearRegression().fit(X, y)

    next_day_price = float(model.predict([[len(window)]])[0])
    next_week_price = float(model.predict([[len(window) + 5]])[0])

    # ── RSI (14-period) ───────────────────────────────────────────────────────
    deltas = np.diff(closes_arr[-15:])
    gains = deltas[deltas > 0]
    losses = -deltas[deltas < 0]
    avg_gain = gains.mean() if len(gains) > 0 else 0.001
    avg_loss = losses.mean() if len(losses) > 0 else 0.001
    rs = avg_gain / avg_loss
    rsi = round(100 - (100 / (1 + rs)), 1)

    # ── Momentum (5-day return) ───────────────────────────────────────────────
    momentum_5d = round(((closes_arr[-1] - closes_arr[-6]) / closes_arr[-6]) * 100, 2)

    # ── Confidence based on R² ────────────────────────────────────────────────
    r2 = model.score(X, y)
    confidence = round(max(0.4, min(0.95, abs(r2))) * 100, 1)

    day_change_pct = round(((next_day_price - current_price) / current_price) * 100, 2)
    week_change_pct = round(((next_week_price - current_price) / current_price) * 100, 2)

    result = {
        "symbol": symbol.upper(),
        "current_price": round(current_price, 2),
        "next_day": round(next_day_price, 2),
        "next_day_change_pct": day_change_pct,
        "next_week": round(next_week_price, 2),
        "next_week_change_pct": week_change_pct,
        "rsi": rsi,
        "momentum_5d": momentum_5d,
        "confidence": confidence,
        "model": "linear_regression",
        "data_points": len(closes),
        "mock": used_mock,
    }

    _cache[cache_key] = result
    return result