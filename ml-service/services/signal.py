"""
Buy/Sell/Hold signal combining:
- Sentiment score (weight: 30%)
- Price momentum (weight: 25%)
- RSI (weight: 25%)
- Linear regression trend (weight: 20%)
"""

from services.sentiment import get_sentiment
from services.prediction import get_prediction


def get_signal(symbol: str) -> dict:
    sentiment = get_sentiment(symbol)
    prediction = get_prediction(symbol)

    # ── Normalise each component to [-1, +1] ─────────────────────────────────

    # 1. Sentiment (-1 to +1 directly)
    sentiment_score = sentiment["score"]  # already -1..+1

    # 2. Momentum: cap at ±5% → normalise to -1..+1
    momentum = prediction["momentum_5d"]
    momentum_norm = max(-1.0, min(1.0, momentum / 5.0))

    # 3. RSI: <30 oversold (+1), >70 overbought (-1), 50 neutral (0)
    rsi = prediction["rsi"]
    if rsi < 30:
        rsi_norm = 1.0
    elif rsi > 70:
        rsi_norm = -1.0
    else:
        rsi_norm = (50 - rsi) / 20.0  # linear between 30-70

    # 4. Trend from regression: next-week change normalised ±5%
    trend = prediction["next_week_change_pct"]
    trend_norm = max(-1.0, min(1.0, trend / 5.0))

    # ── Weighted composite score ──────────────────────────────────────────────
    composite = (
        0.30 * sentiment_score +
        0.25 * momentum_norm +
        0.25 * rsi_norm +
        0.20 * trend_norm
    )

    # ── Map to signal ─────────────────────────────────────────────────────────
    if composite >= 0.2:
        signal = "BUY"
        signal_color = "#8FFFD6"
        reasoning = _build_reasoning("buy", sentiment, prediction, rsi, momentum)
    elif composite <= -0.2:
        signal = "SELL"
        signal_color = "#ef4444"
        reasoning = _build_reasoning("sell", sentiment, prediction, rsi, momentum)
    else:
        signal = "HOLD"
        signal_color = "#f59e0b"
        reasoning = _build_reasoning("hold", sentiment, prediction, rsi, momentum)

    strength = round(abs(composite) * 100, 1)  # 0-100

    return {
        "symbol": symbol.upper(),
        "signal": signal,
        "signal_color": signal_color,
        "composite_score": round(composite, 4),
        "strength": strength,
        "reasoning": reasoning,
        "components": {
            "sentiment": round(sentiment_score, 3),
            "momentum": round(momentum_norm, 3),
            "rsi": round(rsi_norm, 3),
            "trend": round(trend_norm, 3),
        },
        "weights": {
            "sentiment": 0.30,
            "momentum": 0.25,
            "rsi": 0.25,
            "trend": 0.20,
        },
    }


def _build_reasoning(signal: str, sentiment: dict, prediction: dict, rsi: float, momentum: float) -> str:
    parts = []

    # Sentiment
    label = sentiment["label"]
    count = sentiment["article_count"]
    if count > 0:
        parts.append(f"News sentiment is {label.lower()} across {count} recent articles.")
    else:
        parts.append("No recent news found for this symbol.")

    # RSI
    if rsi < 30:
        parts.append(f"RSI at {rsi} indicates the stock is oversold — potential rebound ahead.")
    elif rsi > 70:
        parts.append(f"RSI at {rsi} signals overbought conditions — caution advised.")
    else:
        parts.append(f"RSI at {rsi} is in neutral territory.")

    # Momentum
    direction = "gained" if momentum > 0 else "lost"
    parts.append(f"5-day momentum: stock has {direction} {abs(momentum):.1f}%.")

    # Prediction
    wk = prediction["next_week_change_pct"]
    direction2 = "rise" if wk > 0 else "fall"
    parts.append(f"Model projects a {abs(wk):.1f}% {direction2} over the next week.")

    return " ".join(parts)