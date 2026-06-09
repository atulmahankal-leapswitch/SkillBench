"""Application settings, loaded from environment / .env."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # General
    environment: str = "development"
    log_level: str = "info"

    # URLs / CORS
    app_base_url: str = "http://localhost:3000"
    api_base_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"

    # Datastores
    database_url: str = (
        "postgresql+asyncpg://skillbench:change-me-postgres@db:5432/skillbench"
    )
    redis_url: str = "redis://redis:6379/0"

    # Security
    secret_key: str = "change-me-32-byte-hex"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14

    # Google OAuth (admin sign-in)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect_uri: str = (
        "http://localhost:8000/api/auth/google/callback"
    )
    allowed_admin_email_domains: str = "leapswitch.com"

    # AI (multi-provider; used in the AI phase)
    ai_provider: str = "anthropic"
    ai_model: str = "claude-opus-4-8"
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Judge0 (code-execution phase)
    judge0_url: str = "http://judge0:2358"
    judge0_auth_token: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_email_domains(self) -> list[str]:
        return [
            d.strip().lower()
            for d in self.allowed_admin_email_domains.split(",")
            if d.strip()
        ]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
