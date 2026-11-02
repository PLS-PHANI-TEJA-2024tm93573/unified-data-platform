"""Pydantic response models for KPI endpoints and websocket messages."""

from datetime import datetime

from pydantic import BaseModel


class OeeReading(BaseModel):
    """One timestamped OEE calculation for an asset."""

    asset_id: str
    timestamp: datetime
    availability_percent: float | None
    performance_percent: float | None
    quality_percent: float | None
    oee_percent: float | None
    planned_production_seconds: float | None = None
    operating_seconds: float | None = None
    total_output: float | None = None
    good_output: float | None = None
    rejected_output: float | None = None
