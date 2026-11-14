"""Application configuration.

All configuration comes from environment variables (or a local, git-ignored .env file).
Secrets are typed as ``SecretStr`` so they never appear in logs, reprs or error pages.
No credential has a default value: a missing key means the provider is "not configured",
never silently faked.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppEnv(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class ProviderMode(StrEnum):
    SAMPLE = "sample"  # offline sample adapters only: no network, no spend
    LIVE = "live"  # real adapters, only where credentials are configured


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "OMỌLÚÀBÍ BUSINESS ACADEMY"
    app_env: AppEnv = AppEnv.DEVELOPMENT
    log_level: str = "INFO"
    log_format: str = Field(default="json", pattern="^(json|text)$")

    provider_mode: ProviderMode = ProviderMode.SAMPLE

    database_url: str = "postgresql+psycopg://omoluabi:omoluabi@localhost:5432/omoluabi"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000"]

    # Optional machine token for scripts/automation. Dashboard users log in with sessions.
    admin_api_token: SecretStr | None = None
    session_ttl_hours: int = Field(default=12, ge=1, le=24 * 7)

    storage_backend: str = Field(default="local", pattern="^(local|r2)$")
    local_storage_path: str = "./var/storage"

    anthropic_api_key: SecretStr | None = None
    elevenlabs_api_key: SecretStr | None = None
    youtube_api_key: SecretStr | None = None
    r2_account_id: str | None = None
    r2_access_key_id: SecretStr | None = None
    r2_secret_access_key: SecretStr | None = None
    r2_bucket: str | None = None

    task_max_retries: int = Field(default=3, ge=0, le=10)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return value

    @field_validator(
        "admin_api_token",
        "anthropic_api_key",
        "elevenlabs_api_key",
        "youtube_api_key",
        "r2_access_key_id",
        "r2_secret_access_key",
        mode="before",
    )
    @classmethod
    def _blank_secret_is_none(cls, value: object) -> object:
        # An empty env var must mean "not configured", not "configured with an empty key".
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == AppEnv.PRODUCTION

    def validate_for_production(self) -> list[str]:
        """Return a list of problems that must block a production start."""
        problems: list[str] = []
        if self.admin_api_token is not None and len(self.admin_api_token.get_secret_value()) < 32:
            problems.append("ADMIN_API_TOKEN, if set, must be at least 32 characters")
        if "omoluabi:omoluabi@" in self.database_url:
            problems.append("DATABASE_URL uses the default development password")
        if any(o.startswith("http://localhost") for o in self.cors_origins):
            problems.append("CORS_ORIGINS still points at localhost")
        return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()
