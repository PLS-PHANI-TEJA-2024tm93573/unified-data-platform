"""TimescaleDB connection lifecycle and OEE telemetry persistence."""

import asyncpg
from asyncpg.pool import Pool

from .config import settings
from .models import OeeReading


class OeeRepository:
    """Create the hypertable and persist/query timestamped OEE readings."""

    def __init__(self) -> None:
        """Initialize without opening connections until application startup."""
        self.pool: Pool | None = None

    async def connect(self) -> None:
        """Open a database pool and ensure the TimescaleDB hypertable exists."""
        self.pool = await asyncpg.create_pool(settings.database_url)
        async with self.pool.acquire() as connection:
            await connection.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS oee_telemetry (
                    asset_id TEXT NOT NULL,
                    timestamp TIMESTAMPTZ NOT NULL,
                    availability_percent DOUBLE PRECISION,
                    performance_percent DOUBLE PRECISION,
                    quality_percent DOUBLE PRECISION,
                    oee_percent DOUBLE PRECISION,
                    planned_production_seconds DOUBLE PRECISION,
                    operating_seconds DOUBLE PRECISION,
                    total_output DOUBLE PRECISION,
                    good_output DOUBLE PRECISION,
                    rejected_output DOUBLE PRECISION,
                    PRIMARY KEY (asset_id, timestamp)
                )
            """)
            for column in ("planned_production_seconds", "operating_seconds", "total_output", "good_output", "rejected_output"):
                await connection.execute(f"ALTER TABLE oee_telemetry ADD COLUMN IF NOT EXISTS {column} DOUBLE PRECISION")
            await connection.execute(
                "SELECT create_hypertable('oee_telemetry', 'timestamp', if_not_exists => TRUE)"
            )

    async def close(self) -> None:
        """Close the connection pool during application shutdown."""
        if self.pool:
            await self.pool.close()

    async def insert(self, reading: OeeReading) -> None:
        """Write one calculated OEE snapshot to the hypertable."""
        if not self.pool:
            raise RuntimeError("OEE repository is not connected")
        await self.pool.execute("""
            INSERT INTO oee_telemetry
                (asset_id, timestamp, availability_percent, performance_percent, quality_percent, oee_percent,
                 planned_production_seconds, operating_seconds, total_output, good_output, rejected_output)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (asset_id, timestamp) DO UPDATE SET
                availability_percent = EXCLUDED.availability_percent,
                performance_percent = EXCLUDED.performance_percent,
                quality_percent = EXCLUDED.quality_percent,
                oee_percent = EXCLUDED.oee_percent,
                planned_production_seconds = EXCLUDED.planned_production_seconds,
                operating_seconds = EXCLUDED.operating_seconds,
                total_output = EXCLUDED.total_output,
                good_output = EXCLUDED.good_output,
                rejected_output = EXCLUDED.rejected_output
        """, reading.asset_id, reading.timestamp, reading.availability_percent,
            reading.performance_percent, reading.quality_percent, reading.oee_percent,
            reading.planned_production_seconds, reading.operating_seconds, reading.total_output,
            reading.good_output, reading.rejected_output)

    async def history(self, asset_id: str, start, end) -> list[OeeReading]:
        """Return stored OEE snapshots for an asset and inclusive time window."""
        if not self.pool:
            raise RuntimeError("OEE repository is not connected")
        rows = await self.pool.fetch("""
            SELECT asset_id, timestamp, availability_percent, performance_percent,
                   quality_percent, oee_percent, planned_production_seconds, operating_seconds,
                   total_output, good_output, rejected_output
            FROM oee_telemetry
            WHERE asset_id = $1 AND timestamp >= $2 AND timestamp <= $3
            ORDER BY timestamp ASC
        """, asset_id, start, end)
        return [OeeReading(**dict(row)) for row in rows]


repository = OeeRepository()
