"""
Sentiment analysis using NewsAPI + VADER.
Redis cache: ml:sentiment:{symbol}:{date} with 3600s TTL.
"""

import os
from datetime import datetime, timedelta, date
import httpx
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from services.redis_cache import get as cache_get, set as cache_set

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
BASE_URL     = "https://newsapi.org/v2/everything"
analyzer     = SentimentIntensityAnalyzer()


def _cache_key(symbol: str) -> str:
    return f"ml:sentiment:{symbol.upper()}:{date.today()}"


def _fetch_articles(symbol: str) -> list[str]:
    query  = symbol.replace(".BSE", "").replace(".NSE", "").replace("/", " ")
    params = {
        "q":        query,
        "language": "en",
        "sortBy":   "publishedAt",
        "pageSize": 20,
        "from":     (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
        "apiKey":   NEWS_API_KEY,
    }
    try:
        with httpx.Client(timeout=10) as client:
            resp     = client.get(BASE_URL, params=params)
            resp.raise_for_status()
            articles = resp.json().get("articles", [])
            texts    = []
            for a in articles:
                parts = []
                if a.get("title"):       parts.append(a["title"])
                if a.get("description"): parts.append(a["description"])
                if parts: texts.append(" ".join(parts))
            return texts
    except Exception:
        return []


def get_sentiment(symbol: str) -> dict:
    key    = _cache_key(symbol)
    cached = cache_get(key)
    if cached:
        return cached

    articles = _fetch_articles(symbol)

    if not articles:
        result = {
            "symbol":        symbol.upper(),
            "score":         0.0,
            "label":         "Neutral",
            "article_count": 0,
            "positive":      0.33,
            "negative":      0.33,
            "neutral":       0.34,
            "source":        "newsapi",
        }
        cache_set(key, result, ttl=3600)
        return result

    scores    = [analyzer.polarity_scores(t)["compound"] for t in articles]
    avg_score = sum(scores) / len(scores)
    total     = len(scores)
    pos       = sum(1 for s in scores if s >= 0.05)
    neg       = sum(1 for s in scores if s <= -0.05)
    neu       = total - pos - neg

    label = "Bullish" if avg_score >= 0.15 else "Bearish" if avg_score <= -0.15 else "Neutral"

    result = {
        "symbol":        symbol.upper(),
        "score":         round(avg_score, 4),
        "label":         label,
        "article_count": total,
        "positive":      round(pos / total, 2),
        "negative":      round(neg / total, 2),
        "neutral":       round(neu / total, 2),
        "source":        "newsapi+vader",
    }

    cache_set(key, result, ttl=3600)
    return result
