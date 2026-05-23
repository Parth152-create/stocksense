"""
StockSense ML Service — FastAPI @ port 8082

Endpoints:
  GET /ml/sentiment/{symbol}   — news sentiment (NewsAPI + VADER)
  GET /ml/prediction/{symbol}  — price prediction (Alpha Vantage + sklearn)
  GET /ml/signal/{symbol}      — buy/sell/hold signal (composite)
  GET /ml/anomaly/{symbol}     — anomaly detection (Z-score)
  GET /ml/full/{symbol}        — all four in one call (used by frontend)
  GET /health                  — health check
"""

import os
import asyncio
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*_args, **_kwargs):
        return False

try:
    import jwt
    from jwt import ExpiredSignatureError, InvalidTokenError
except ImportError:
    jwt = None
    ExpiredSignatureError = InvalidTokenError = Exception

load_dotenv()

from services.sentiment  import get_sentiment
from services.prediction import get_prediction
from services.signal     import get_signal
from services.anomaly    import get_anomaly

# ── Config ────────────────────────────────────────────────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "")
security   = HTTPBearer(auto_error=False)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="StockSense ML Service",
    description="AI/ML signals for StockSense",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=8)

# ── Auth ──────────────────────────────────────────────────────────────────────

def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Optional JWT guard.
    - If JWT_SECRET is not set in .env  → dev mode, all requests pass through.
    - If JWT_SECRET is set              → validates Bearer token against Spring's secret.
    - If pyjwt is not installed         → skips silently (warn in logs).
    """
    if not JWT_SECRET:
        # Dev mode — no secret configured, allow everything
        return

    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    if jwt is None:
        # pyjwt not installed — log warning but don't block
        print("[WARN] pyjwt not installed — skipping JWT verification. Run: pip install pyjwt")
        return

    try:
        jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Helpers ───────────────────────────────────────────────────────────────────

def run_sync(fn, *args):
    """Run a blocking function in the thread pool without blocking the event loop."""
    loop = asyncio.get_running_loop()
    if args:
        return loop.run_in_executor(executor, lambda: fn(*args))
    return loop.run_in_executor(executor, fn)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":  "ok",
        "service": "stocksense-ml",
        "port":    8082,
        "jwt_guard": bool(JWT_SECRET),
    }


@app.get("/ml/sentiment/{symbol}")
async def sentiment(
    symbol: str,
    _: None = Depends(verify_token),
):
    """
    News sentiment for a symbol via NewsAPI + VADER.
    Returns: { score, label, article_count, sources[] }
    """
    try:
        result = await run_sync(get_sentiment, symbol.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/prediction/{symbol}")
async def prediction(
    symbol: str,
    _: None = Depends(verify_token),
):
    """
    30-day price prediction via Alpha Vantage OHLCV + sklearn linear regression.
    Returns: { next_week, next_week_change_pct, next_month, confidence, rsi }
    """
    try:
        result = await run_sync(get_prediction, symbol.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/signal/{symbol}")
async def signal(
    symbol: str,
    _: None = Depends(verify_token),
):
    """
    Composite buy/sell/hold signal combining sentiment + technicals.
    Returns: { signal, strength, signal_color, reasons[] }
    """
    try:
        result = await run_sync(get_signal, symbol.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/anomaly/{symbol}")
async def anomaly(
    symbol: str,
    _: None = Depends(verify_token),
):
    """
    Z-score based anomaly detection on price and volume.
    Returns: { anomaly_detected, z_score, description, severity }
    """
    try:
        result = await run_sync(get_anomaly, symbol.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/full/{symbol}")
async def full(
    symbol: str,
    _: None = Depends(verify_token),
):
    """
    All four ML signals in one call — used by the Insights page InsightCard.
    Runs sentiment, prediction, and anomaly in parallel, then derives signal.

    Returns:
    {
      symbol,
      sentiment:  { score, label, article_count, sources[] },
      prediction: { next_week, next_week_change_pct, next_month, confidence, rsi },
      signal:     { signal, strength, signal_color, reasons[] },
      anomaly:    { anomaly_detected, z_score, description, severity },
    }
    """
    try:
        sym = symbol.upper()

        # Run the three independent services in parallel
        sentiment_data, prediction_data, anomaly_data = await asyncio.gather(
            run_sync(get_sentiment,  sym),
            run_sync(get_prediction, sym),
            run_sync(get_anomaly,    sym),
        )

        # Signal depends on sentiment + prediction so runs after
        signal_data = await run_sync(get_signal, sym)

        return {
            "symbol":     sym,
            "sentiment":  sentiment_data,
            "prediction": prediction_data,
            "signal":     signal_data,
            "anomaly":    anomaly_data,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
