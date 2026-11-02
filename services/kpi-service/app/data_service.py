"""Read measurement histories through the Data Service's existing API."""

import asyncio
from datetime import datetime, timedelta

import httpx

from .config import settings
from .oee import ASSET_VARIABLES, ENABLED_ASSETS


def asset_config(asset_name_or_id: str) -> tuple[str, dict] | None:
    for name, config in settings.assets.items():
        if name == asset_name_or_id or config.get("asset_id") == asset_name_or_id:
            return name, config
    return None


async def read_history(client: httpx.AsyncClient, asset_name: str, config: dict, start: datetime, end: datetime) -> dict[str, list[dict]]:
    """Read configured variable histories; include a baseline before the requested window."""
    if asset_name not in ENABLED_ASSETS:
        raise ValueError(f"OEE is not enabled for {asset_name}")
    ids = config.get("variables", {})
    names = ASSET_VARIABLES[asset_name]
    missing = [variable for variable in names.values() if not ids.get(variable)]
    if missing:
        raise ValueError(f"Missing Data Service variable IDs for {asset_name}: {', '.join(missing)}")
    baseline_start = start - timedelta(days=settings.counter_baseline_days)

    async def query(variable_id: str, from_time: datetime, to_time: datetime) -> list[dict]:
        response = await client.get("/measurements", params={
            "asset_variable_id": variable_id,
            "from": from_time.isoformat(),
            "to": to_time.isoformat(),
            "limit": 10000,
        })
        response.raise_for_status()
        data = response.json().get("data", [])
        if len(data) >= 10000:
            raise ValueError("Data Service range reached its 10,000 row limit; narrow the OEE window")
        return data

    async def fetch(variable_name: str, variable_id: str) -> tuple[str, list[dict]]:
        # Read the window in hourly slices to stay below Data Service's row cap.
        window: list[dict] = []
        cursor = start
        while cursor < end:
            slice_end = min(end, cursor + timedelta(hours=1))
            window.extend(await query(variable_id, cursor, slice_end))
            cursor = slice_end

        # Query backward in hourly slices and retain only the nearest pre-window baseline.
        baseline: list[dict] = []
        cursor = start
        while cursor > baseline_start and not baseline:
            slice_start = max(baseline_start, cursor - timedelta(hours=1))
            candidates = await query(variable_id, slice_start, cursor)
            before = [point for point in candidates if datetime.fromisoformat(point["timestamp"].replace("Z", "+00:00")) < start]
            if before:
                baseline = [max(before, key=lambda point: point["timestamp"])]
            cursor = slice_start
        unique = {point["timestamp"]: point for point in [*baseline, *window]}
        return variable_name, sorted(unique.values(), key=lambda point: point["timestamp"])

    pairs = await asyncio.gather(*(fetch(name, ids[name]) for name in names.values()))
    return dict(pairs)
