"""Client scoped websocket fanout of Data Service backed OEE calculations."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import WebSocket

from .config import settings
from .data_service import asset_config, read_history
from .database import repository
from .models import OeeReading
from .oee import calculate_oee

logger = logging.getLogger(__name__)


class OeeStreamManager:
    """Manage subscribers and one live calculation loop per asset."""

    def __init__(self) -> None:
        self.clients: dict[str, set[WebSocket]] = {}
        self.tasks: dict[str, asyncio.Task] = {}

    async def connect(self, asset_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.clients.setdefault(asset_id, set()).add(websocket)
        if asset_id not in self.tasks:
            self.tasks[asset_id] = asyncio.create_task(self._poll_asset(asset_id))

    async def disconnect(self, asset_id: str, websocket: WebSocket) -> None:
        subscribers = self.clients.get(asset_id)
        if not subscribers:
            return
        subscribers.discard(websocket)
        if not subscribers:
            self.clients.pop(asset_id, None)
            task = self.tasks.pop(asset_id, None)
            if task:
                task.cancel()

    async def _poll_asset(self, asset_id: str) -> None:
        resolved = asset_config(asset_id)
        if not resolved:
            await self._broadcast_error(asset_id, "No KPI variable configuration exists for this asset")
            return
        asset_name, config = resolved
        async with httpx.AsyncClient(base_url=settings.data_service_url, timeout=10.0) as client:
            while self.clients.get(asset_id):
                started = datetime.now(timezone.utc)
                end = started
                start = end - timedelta(seconds=settings.poll_interval_seconds)
                try:
                    histories = await read_history(client, asset_name, config, start, end)
                    reading = OeeReading(**calculate_oee(asset_id, asset_name, config, histories, start, end, started))
                    await repository.insert(reading)
                    await self._broadcast(asset_id, reading.model_dump(mode="json"))
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("OEE calculation failed for asset %s", asset_id)
                    await self._broadcast_error(asset_id, "Unable to calculate OEE from Data Service measurement history")
                elapsed = (datetime.now(timezone.utc) - started).total_seconds()
                await asyncio.sleep(max(0, settings.poll_interval_seconds - elapsed))

    async def _broadcast(self, asset_id: str, payload: dict) -> None:
        for websocket in list(self.clients.get(asset_id, ())):
            try:
                await websocket.send_json(payload)
            except Exception:
                await self.disconnect(asset_id, websocket)

    async def _broadcast_error(self, asset_id: str, message: str) -> None:
        await self._broadcast(asset_id, {"asset_id": asset_id, "error": message})


manager = OeeStreamManager()
