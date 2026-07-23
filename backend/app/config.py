from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Akbil Takip Sistemi"
    api_prefix: str = "/api/v1"
    debug: bool = False

    database_url: str
    db_echo: bool = False

    secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    analytics_timezone: str = "Europe/Istanbul"


    sim_speed: float = 10.0
    bus_capacity: int = 40

    cors_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()