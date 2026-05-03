"""
Sentiment analysis using NewsAPI + VADER
Returns a score from -1.0 (very negative) to +1.0 (very positive)
"""

import os
import httpx
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from cachetools import TTLCache, cached
from datetime import datetime, timedelta

NEWS_API_KEY = os.getenv("NEWS_API_KEY")
BASE_URL = "https://newsapi.org/v2/everything"

analyzer = SentimentIntensityAnalyzer()

# Cache sentiment for 30 minutes per symbol
_cache: TTLCache = TTLCache(maxsize=128, ttl=1800)


def _fetch_articles(symbol: str) -> list[str]:
    """Fetch recent news headlines for a symbol."""
    # Clean symbol for search (remove .BSE, .NSE suffixes)
    query = symbol.replace(".BSE", "").replace(".NSE", "").replace("/", " ")

    params = {
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 20,
        "from": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
        "apiKey": NEWS_API_KEY,
    }

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            articles = data.get("articles", [])
            # Combine title + description for richer signal
            texts = []
            for a in articles:
                parts = []
                if a.get("title"):
                    parts.append(a["title"])
                if a.get("description"):
                    parts.append(a["description"])
                if parts:
                    texts.append(" ".join(parts))
            return texts
    except Exception:
        return []


def get_sentiment(symbol: str) -> dict:
    """
    Returns sentiment analysis for a symbol.
    Uses cache to avoid hammering NewsAPI.
    """
    cache_key = symbol.upper()
    if cache_key in _cache:
        return _cache[cache_key]

    articles = _fetch_articles(symbol)

    if not articles:
        # No news found — return neutral
        result = {
            "symbol": symbol.upper(),
            "score": 0.0,
            "label": "Neutral",
            "article_count": 0,
            "positive": 0.33,
            "negative": 0.33,
            "neutral": 0.34,
            "source": "newsapi",
        }
        _cache[cache_key] = result
        return result

    # Run VADER on each article
    scores = [analyzer.polarity_scores(text)["compound"] for text in articles]
    avg_score = sum(scores) / len(scores)

    # Count sentiment buckets
    pos = sum(1 for s in scores if s >= 0.05)
    neg = sum(1 for s in scores if s <= -0.05)
    neu = len(scores) - pos - neg
    total = len(scores)

    if avg_score >= 0.15:
        label = "Bullish"
    elif avg_score <= -0.15:
        label = "Bearish"
    else:
        label = "Neutral"

    result = {
        "symbol": symbol.upper(),
        "score": round(avg_score, 4),
        "label": label,
        "article_count": len(articles),
        "positive": round(pos / total, 2),
        "negative": round(neg / total, 2),
        "neutral": round(neu / total, 2),
        "source": "newsapi+vader",
    }

    _cache[cache_key] = result
    return result