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

    card_token_secret: str
    card_token_expire_seconds: int = 60

    device_api_key_header: str = "X-Device-Key"

    trip_auto_close_minutes: int = 180

    cors_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()