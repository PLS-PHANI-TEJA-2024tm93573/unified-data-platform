"""Application configuration loaded from environment variables."""

import json

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings for Data service access, TimescaleDB, and polling."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    asset_model_url: str = "http://localhost:3000"
    data_service_url: str = "http://localhost:3001"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/unified_data_platform"
    poll_interval_seconds: float = 5.0
    counter_baseline_days: int = 1
    asset_config_json: str = "{}"

    @property
    def assets(self) -> dict[str, dict]:
        """Parse the per-asset measurement variable configuration."""
        return json.loads(self.asset_config_json or "{}")

    def replace_assets(self, assets: dict[str, dict]) -> None:
        """Update runtime asset configuration after Asset Model synchronization."""
        self.asset_config_json = json.dumps(assets)


settings = Settings()
