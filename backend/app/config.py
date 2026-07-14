from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Stress Research Platform API"
    app_env: str = "development"
    api_prefix: str = "/api"
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "stress_research_platform"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175"
    jwt_secret: str = "development-only-change-me-32-characters-minimum"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    refresh_token_days: int = 30
    consent_version: str = "1.0"
    bootstrap_super_admin_email: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "BOOTSTRAP_SUPER_ADMIN_EMAIL",
            "BOOTSTRAP_RESEARCHER_EMAIL",
        ),
    )
    bootstrap_super_admin_password: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "BOOTSTRAP_SUPER_ADMIN_PASSWORD",
            "BOOTSTRAP_RESEARCHER_PASSWORD",
        ),
    )
    bootstrap_super_admin_name: str = Field(
        default="Super Administrator",
        validation_alias=AliasChoices(
            "BOOTSTRAP_SUPER_ADMIN_NAME",
            "BOOTSTRAP_RESEARCHER_NAME",
        ),
    )
    frontend_url: str = "http://localhost:5173"
    mobile_url: str = "http://localhost:5174"
    brevo_api_key: str | None = None
    brevo_sender_email: str | None = None
    brevo_sender_name: str = "Stress Research Platform"

    model_config = SettingsConfigDict(
        env_file="backend/.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
