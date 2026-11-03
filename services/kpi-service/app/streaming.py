"""Client scoped websocket fanout of Data Service backed OEE calculations."""

import asyncio
import logging
from datetime import datetime, time, timedelta, timezone

import httpx
from fastapi import WebSocket

from .config import settings
from .data_service import asset_config, read_history
from .database import repository
from .models import OeeReading
from .oee import ASSET_VARIABLES, _planned_intervals, calculate_oee

logger = logging.getLogger(__name__)


def _current_shift_start(now: datetime, config: dict) -> datetime:
    """Return the configured UTC shift start at or before ``now``."""
    shift_minutes = int(config.get("shift_duration_minutes", 480))
    if shift_minutes <= 0:
        raise ValueError("shift_duration_minutes must be positive")
    try:
        shift_time = time.fromisoformat(config.get("shift_start_utc", "00:00"))
    except ValueError as error:
        raise ValueError("shift_start_utc must be an ISO time such as 06:00") from error

    day_start = now.replace(
        hour=shift_time.hour,
        minute=shift_time.minute,
        second=shift_time.second,
        microsecond=0,
    )
    if day_start > now:
        day_start -= timedelta(days=1)

    shift = timedelta(minutes=shift_minutes)
    shifts_elapsed = int((now - day_start).total_seconds() // shift.total_seconds())
    return day_start + shift * shifts_elapsed


def _resolve_live_window(
    asset_name: str,
    histories: dict[str, list[dict]],
    requested_start: datetime,
    end: datetime,
    config: dict,
    previous_start: datetime | None,
    run_start: datetime | None,
) -> tuple[datetime | None, datetime | None]:
    """Choose a complete live segment, restarting after data gaps or counter resets."""
    role_points: dict[str, list[tuple[datetime, object]]] = {}
    for role, variable_name in ASSET_VARIABLES[asset_name].items():
        points = []
        for item in histories.get(variable_name, []):
            when = datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00")).astimezone(timezone.utc)
            if when <= end:
                points.append((when, item.get("value")))
        role_points[role] = sorted(points, key=lambda point: point[0])

    if any(not points for points in role_points.values()):
        return None, run_start

    max_state_gap = float(config.get("max_state_gap_seconds", 30))
    max_counter_gap = float(config.get("max_counter_gap_seconds", 30))

    def gap_limit(role: str) -> float:
        return max_state_gap if role == "status" else max_counter_gap

    def at_or_before(points: list[tuple[datetime, object]], when: datetime):
        return next((point for point in reversed(points) if point[0] <= when), None)

    # Keep a fresh shift boundary if all inputs have one. Otherwise start at the
    # first timestamp by which every required signal has appeared.
    if previous_start is None:
        boundary_is_fresh = all(
            (boundary := at_or_before(points, requested_start)) is not None
            and (requested_start - boundary[0]).total_seconds() <= gap_limit(role)
            and any(point[0] > requested_start for point in points)
            for role, points in role_points.items()
        )
        if boundary_is_fresh:
            window_start = requested_start
        else:
            first_samples = [next((point[0] for point in points if requested_start <= point[0] <= end), None)
                             for points in role_points.values()]
            if any(point is None for point in first_samples):
                return None, run_start
            window_start = max(first_samples)
        run_start = run_start or window_start
    else:
        window_start = previous_start
        run_start = run_start or previous_start

    schedule_config = {
        **config,
        "shift_start_utc": run_start.strftime("%H:%M:%S"),
    }
    shift_minutes = int(schedule_config.get("shift_duration_minutes", 480))
    break_minutes = int(schedule_config.get("planned_break_minutes", 30))
    restart_points: list[datetime] = []

    for role, points in role_points.items():
        limit = gap_limit(role)
        for previous, current in zip(points, points[1:]):
            current_time, current_value = current
            if current_time <= window_start:
                continue
            elapsed = (current_time - previous[0]).total_seconds()
            if elapsed > limit:
                planned_seconds = sum(
                    (planned_end - planned_start).total_seconds()
                    for planned_start, planned_end in _planned_intervals(
                        previous[0], current_time, shift_minutes, break_minutes,
                        schedule_config["shift_start_utc"],
                    )
                )
                # A gap contained in the scheduled break does not invalidate the
                # production segment. A gap through planned time does.
                if planned_seconds > limit:
                    restart_points.append(current_time)

            if role != "status":
                try:
                    reset = float(current_value) < float(previous[1])
                except (TypeError, ValueError):
                    reset = False
                if reset:
                    restart_points.append(current_time)

    if restart_points:
        window_start = max(window_start, max(restart_points))

    # A fresh baseline is required at the chosen segment boundary for every
    # counter and for machine status; otherwise wait for the input to recover.
    for role, points in role_points.items():
        boundary = at_or_before(points, window_start)
        if boundary is None or (window_start - boundary[0]).total_seconds() > gap_limit(role):
            return None, run_start

    return (window_start if window_start < end else None), run_start


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
            window_start: datetime | None = None
            run_start: datetime | None = None
            while self.clients.get(asset_id):
                started = datetime.now(timezone.utc)
                end = started
                try:
                    requested_start = _current_shift_start(started, config)
                    fetch_start = min(requested_start, window_start) if window_start else requested_start
                    histories = await read_history(client, asset_name, config, fetch_start, end)
                    resolved_start, run_start = _resolve_live_window(
                        asset_name, histories, requested_start, end, config, window_start, run_start,
                    )
                    if resolved_start is not None and run_start is not None:
                        window_start = resolved_start
                        live_config = {
                            **config,
                            "shift_start_utc": run_start.strftime("%H:%M:%S"),
                        }
                        reading = OeeReading(**calculate_oee(
                            asset_id, asset_name, live_config, histories,
                            resolved_start, end, started,
                        ))
                        await repository.insert(reading)
                        payload = reading.model_dump(mode="json")
                        payload["calculation_start"] = resolved_start.isoformat()
                        payload["calculation_period"] = (
                            "since_recovery" if resolved_start > run_start else "since_start"
                        )
                        await self._broadcast(asset_id, payload)
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
