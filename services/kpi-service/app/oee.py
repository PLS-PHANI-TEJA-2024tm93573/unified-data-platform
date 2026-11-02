"""OEE calculations from Data Service measurement histories."""

from datetime import datetime, time, timedelta, timezone
from typing import Any

ENABLED_ASSETS = {"ProductionLine01", "Packager"}
ASSET_VARIABLES = {
    "ProductionLine01": {"status": "line_status", "total": "total_bottles", "good": "total_good_bottles", "rejected": "total_rejected_bottles"},
    "Station01": {"status": "station_status"},
    "Mixer_01": {"status": "machine_status", "total": "batch_count", "good": "good_batch_count", "rejected": "rejected_batch_count"},
    "Boiler_Hub": {"status": "hub_status"},
    "Boiler_01": {"status": "machine_status", "total": "heating_cycle_count", "good": "good_cycle_count", "rejected": "rejected_cycle_count"},
    "Boiler_02": {"status": "machine_status", "total": "heating_cycle_count", "good": "good_cycle_count", "rejected": "rejected_cycle_count"},
    "Pump_0": {"status": "machine_status", "total": "transfer_cycle_count", "good": "good_transfer_count", "rejected": "rejected_transfer_count"},
    "Packager": {"status": "machine_status", "total": "total_bottles", "good": "good_bottles", "rejected": "rejected_bottles"},
}


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("timestamps must include a timezone")
    return value.astimezone(timezone.utc)


def _number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if result >= 0 else None


def _at_or_before(series: list[dict], when: datetime) -> dict | None:
    return next((point for point in reversed(series) if point["timestamp"] <= when), None)


def _planned_intervals(start: datetime, end: datetime, shift_minutes: int, break_minutes: int, shift_start_utc: str) -> list[tuple[datetime, datetime]]:
    """Repeat configured UTC shifts, with the break at each shift's end."""
    shift = timedelta(minutes=shift_minutes)
    planned = shift - timedelta(minutes=break_minutes)
    if shift.total_seconds() <= 0 or planned.total_seconds() < 0:
        raise ValueError("shift_duration_minutes must be positive and planned_break_minutes cannot exceed it")
    try:
        shift_time = time.fromisoformat(shift_start_utc)
    except ValueError as error:
        raise ValueError("shift_start_utc must be an ISO time such as 06:00") from error
    day = start.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    result = []
    while day < end:
        base = day.replace(hour=shift_time.hour, minute=shift_time.minute, second=shift_time.second)
        for index in range(int(24 * 60 / shift_minutes)):
            shift_start = base + shift * index
            interval_start = max(start, shift_start)
            interval_end = min(end, shift_start + planned)
            if interval_end > interval_start:
                result.append((interval_start, interval_end))
        day += timedelta(days=1)
    return result


def calculate_oee(asset_id: str, asset_name: str, config: dict, histories: dict[str, list[dict]], start: datetime, end: datetime, timestamp: datetime | None = None) -> dict:
    """Calculate OEE over a closed reporting window using counter deltas and state history."""
    start, end = _utc(start), _utc(end)
    if end <= start:
        raise ValueError("end must be later than start")
    timestamp = _utc(timestamp or end)
    variables = ASSET_VARIABLES[asset_name]
    normalized: dict[str, list[dict]] = {}
    for role, name in variables.items():
        points = []
        for item in histories.get(name, []):
            when = _utc(datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00")))
            if when <= end:
                points.append({"timestamp": when, "value": item.get("value")})
        normalized[role] = sorted(points, key=lambda point: point["timestamp"])

    def delta(role: str) -> float | None:
        series = normalized.get(role, [])
        before = _at_or_before(series, start)
        # Use latest boundary value and all points through end (there can be resets in between).
        inside = [point for point in series if start < point["timestamp"] <= end]
        if before is None or not inside:
            return None
        max_counter_gap = float(config.get("max_counter_gap_seconds", 30))
        if ((end - inside[-1]["timestamp"]).total_seconds() > max_counter_gap
                or (start - before["timestamp"]).total_seconds() > max_counter_gap):
            return None
        values = [_number(before["value"])] + [_number(point["value"]) for point in inside]
        if any(value is None for value in values):
            return None
        amount = 0.0
        for prior, current in zip(values, values[1:]):
            if current < prior:
                return None
            amount += current - prior
        return amount

    total = delta("total")
    good = delta("good")
    rejected = delta("rejected")
    if total is None or good is None or rejected is None or abs(good + rejected - total) > 1e-6:
        total = good = rejected = None

    shift_minutes = int(config.get("shift_duration_minutes", 480))
    break_minutes = int(config.get("planned_break_minutes", 30))
    planned_intervals = _planned_intervals(start, end, shift_minutes, break_minutes, config.get("shift_start_utc", "00:00"))
    planned = sum((b - a).total_seconds() for a, b in planned_intervals)
    states = normalized["status"]
    boundary = _at_or_before(states, start)
    state_points = ([boundary] if boundary else []) + [point for point in states if start < point["timestamp"] < end]
    state_points = sorted({point["timestamp"]: point for point in state_points}.values(), key=lambda p: p["timestamp"])
    operating = 0.0
    covered = 0.0
    max_gap = float(config.get("max_state_gap_seconds", 30))
    operating_states = {str(value).strip().upper() for value in config.get("operating_states", ["RUNNING", "HEATING", "TRUE", "1"])}
    for index, point in enumerate(state_points):
        segment_start = max(start, point["timestamp"])
        segment_end = min(end, state_points[index + 1]["timestamp"] if index + 1 < len(state_points) else end)
        # A state sample only describes the configured freshness interval. Beyond that, state is unknown.
        segment_end = min(segment_end, segment_start + timedelta(seconds=max_gap))
        if segment_end <= segment_start:
            continue
        for planned_start, planned_end in planned_intervals:
            overlap_start = max(segment_start, planned_start)
            overlap_end = min(segment_end, planned_end)
            if overlap_end <= overlap_start:
                continue
            segment = (overlap_end - overlap_start).total_seconds()
            covered += segment
            if str(point["value"]).strip().upper() in operating_states:
                operating += segment
    # State gaps are unknown. Do not turn them into downtime or report partial availability as complete.
    state_complete = planned == 0 or covered >= planned - 1
    availability = operating / planned * 100 if planned > 0 and state_complete else None
    ideal_rate = config.get("ideal_rate_per_minute")
    if ideal_rate is None and config.get("ideal_cycle_time_seconds"):
        ideal_rate = 60 / float(config["ideal_cycle_time_seconds"])
    if ideal_rate is None and config.get("ideal_transfers_per_hour"):
        ideal_rate = float(config["ideal_transfers_per_hour"]) / 60
    performance = None
    if total is not None and operating > 0 and ideal_rate and float(ideal_rate) > 0:
        performance = total / (float(ideal_rate) * operating / 60) * 100
    quality = good / total * 100 if total is not None and total > 0 else None
    oee = availability * performance * quality / 10000 if all(value is not None for value in (availability, performance, quality)) else None
    return {
        "asset_id": asset_id,
        "timestamp": timestamp,
        "availability_percent": availability,
        "performance_percent": performance,
        "quality_percent": quality,
        "oee_percent": oee,
        "planned_production_seconds": planned,
        "operating_seconds": operating if state_complete else None,
        "total_output": total,
        "good_output": good,
        "rejected_output": rejected,
    }
