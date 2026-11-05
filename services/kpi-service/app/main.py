"""FastAPI application exposing live and historical asset OEE."""

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .asset_model import synchronize_asset_config
from .data_service import asset_config, read_history
from .database import repository
from .models import OeeReading
from .oee import ENABLED_ASSETS, calculate_oee
from .streaming import manager

logger = logging.getLogger(__name__)


async def _synchronize_asset_config_until_available() -> None:
    """Keep the service running while retrying unavailable Asset Model metadata."""
    while True:
        try:
            await synchronize_asset_config()
            logger.info("Synchronized KPI asset metadata from Asset Model")
            return
        except Exception:
            logger.exception(
                "Asset Model metadata sync failed; retrying in 10 seconds"
            )
            await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Retry Asset Model sync in the background and manage TimescaleDB lifecycle."""
    asset_sync_task = asyncio.create_task(
        _synchronize_asset_config_until_available()
    )
    try:
        await repository.connect()
        yield
    finally:
        asset_sync_task.cancel()
        with suppress(asyncio.CancelledError):
            await asset_sync_task
        await repository.close()


app = FastAPI(
    title="KPI Service",
    description="OEE calculated from Data Service measurement history for configured assets.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"], summary="Check service health")
async def health() -> dict[str, str]:
    """Return a simple process health response."""
    return {"status": "ok"}


@app.get("/api/v1/oee/{asset_id}/history", response_model=list[OeeReading], tags=["OEE"],
         summary="Get historical OEE telemetry")
async def get_history(
    asset_id: str,
    start: datetime = Query(..., description="Inclusive ISO 8601 start timestamp"),
    end: datetime = Query(..., description="Inclusive ISO 8601 end timestamp"),
) -> list[OeeReading]:
    """Return persisted OEE readings inside the requested time window."""
    if start > end:
        raise HTTPException(status_code=400, detail="start must not be later than end")
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(status_code=400, detail="start and end must include a timezone")
    return await repository.history(asset_id, start, end)


@app.get("/api/v1/oee/{asset_id}", response_model=OeeReading, tags=["OEE"],
         summary="Calculate OEE for a reporting window")
async def calculate_asset_oee(
    asset_id: str,
    start: datetime = Query(..., description="Inclusive ISO 8601 reporting window start"),
    end: datetime = Query(..., description="Inclusive ISO 8601 reporting window end"),
) -> OeeReading:
    """Calculate an OEE reading from Data Service counter and state histories."""
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(status_code=400, detail="start and end must include a timezone")
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be later than start")
    resolved = asset_config(asset_id)
    if not resolved:
        raise HTTPException(status_code=404, detail="No KPI variable configuration exists for this asset")
    asset_name, config = resolved
    if asset_name not in ENABLED_ASSETS:
        raise HTTPException(status_code=422, detail=f"OEE is not enabled for {asset_name}")
    try:
        async with httpx.AsyncClient(base_url=settings.data_service_url, timeout=20.0) as client:
            histories = await read_history(client, asset_name, config, start, end)
        return OeeReading(**calculate_oee(asset_id, asset_name, config, histories, start, end, datetime.now(timezone.utc)))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail=f"Data Service returned {error.response.status_code}") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="Unable to retrieve telemetry from Data Service") from error


@app.websocket("/api/v1/oee/{asset_id}/live")
async def live_oee(websocket: WebSocket, asset_id: str) -> None:
    """Stream OEE while this client keeps the asset view websocket open."""
    await manager.connect(asset_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(asset_id, websocket)
