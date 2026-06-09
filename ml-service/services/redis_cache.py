"""
Shared Redis cache helper for ML services.
Falls back to in-memory TTLCache if Redis is unavailable.
"""

import os
import json
import redis
from cachetools import TTLCache

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

_fallback: TTLCache = TTLCache(maxsize=512, ttl=3600)

try:
    _redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True, socket_timeout=2)
    _redis.ping()
except Exception:
    _redis = None


def get(key: str):
    if _redis:
        try:
            val = _redis.get(key)
            return json.loads(val) if val else None
        except Exception:
            pass
    return _fallback.get(key)


def set(key: str, value: dict, ttl: int = 3600):
    if _redis:
        try:
            _redis.setex(key, ttl, json.dumps(value))
            return
        except Exception:
            pass
    _fallback[key] = value
