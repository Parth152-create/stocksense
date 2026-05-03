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

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from concurrent.futures import ThreadPoolExecutor

from services.sentiment import get_sentiment
from services.prediction import get_prediction
from services.signal import get_signal
from services.anomaly import get_anomaly

app = FastAPI(
    title="StockSense ML Service",
    description="AI/ML signals for StockSense",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",
                   "http://localhost:8081", "http://127.0.0.1:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=8)


def run_sync(fn, *args):
    loop = asyncio.get_event_loop()
    if args:
        return loop.run_in_executor(executor, lambda: fn(*args))
    return loop.run_in_executor(executor, fn)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "stocksense-ml", "port": 8082}


@app.get("/ml/sentiment/{symbol}")
async def sentiment(symbol: str):
    try:
        result = await run_sync(get_sentiment, symbol.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/prediction/{symbol}")
async def prediction(symbol: str):
    try:
        result = await run_sync(get_prediction, symbol.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/signal/{symbol}")
async def signal(symbol: str):
    try:
        result = await run_sync(get_signal, symbol.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/anomaly/{symbol}")
async def anomaly(symbol: str):
    try:
        result = await run_sync(get_anomaly, symbol.upper())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/full/{symbol}")
async def full(symbol: str):
    try:
        sym = symbol.upper()
        sentiment_task  = run_sync(get_sentiment, sym)
        prediction_task = run_sync(get_prediction, sym)
        anomaly_task    = run_sync(get_anomaly, sym)

        sentiment_data, prediction_data, anomaly_data = await asyncio.gather(
            sentiment_task, prediction_task, anomaly_task
        )

        signal_data = await run_sync(get_signal, sym)

        return {
            "symbol": sym,
            "sentiment": sentiment_data,
            "prediction": prediction_data,
            "signal": signal_data,
            "anomaly": anomaly_data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))