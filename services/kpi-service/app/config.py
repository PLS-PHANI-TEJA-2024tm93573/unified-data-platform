"""Application configuration loaded from environment variables."""

import json

from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_ASSET_TUNING = {
    "ProductionLine01": {"ideal_rate_per_minute": 60},
    "Packager": {"ideal_rate_per_minute": 60},
}


class Settings(BaseSettings):
    """Settings for Data service access, TimescaleDB, and polling."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    asset_model_url: str = "http://localhost:3000"
    data_service_url: str = "http://localhost:3001"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/unified_data_platform"
    cors_origins: str = "http://localhost:4200,http://127.0.0.1:4200"
    poll_interval_seconds: float = 7.0
    counter_baseline_days: int = 1
    asset_config_json: str = "{}"

    @property
    def assets(self) -> dict[str, dict]:
        """Parse per-asset tuning, supplying simulator OEE defaults."""
        configured = json.loads(self.asset_config_json or "{}")
        assets = {name: values.copy() for name, values in DEFAULT_ASSET_TUNING.items()}
        for name, values in configured.items():
            assets.setdefault(name, {}).update(values)
        return assets

    @property
    def allowed_origins(self) -> list[str]:
        """Return configured browser origins for the HTTP API."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def replace_assets(self, assets: dict[str, dict]) -> None:
        """Update runtime asset configuration after Asset Model synchronization."""
        self.asset_config_json = json.dumps(assets)


settings = Settings()
