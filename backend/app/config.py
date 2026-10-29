from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CareerOS API"
    environment: str = "development"

    database_url: str = "postgresql+psycopg://careeros:careeros@localhost:5432/careeros"

    jwt_secret: str = "change-me-in-production-please-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30

    cookie_secure: bool = False  # set True behind HTTPS
    cookie_domain: str | None = None

    frontend_origin: str = "http://localhost:3000"

    # Rate limits (slowapi syntax)
    auth_rate_limit: str = "10/minute"

    # Optional external job sources (Phase 2+). Empty = offline seed data only.
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""

    # AI (Phase 2+)
    anthropic_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
