from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="MEDARIX_",
        extra="ignore",
    )

    app_name: str = "Medarix"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:8088", "http://localhost:5173"]
    )

    database_url: str = ""
    database_host: str = "postgres"
    database_port: int = 5432
    database_name: str = "medarix"
    database_user: str = "medarix"
    database_password: str = "medarix"
    audit_hmac_secret: str = "change-me-before-production"

    session_jwt_secret: str = "change-me-before-production"
    session_jwt_issuer: str = "medarix"
    access_token_minutes: int = 30
    refresh_token_days: int = 7

    ldap_enabled: bool = False
    ldap_server_uri: str = "ldap://ad.example.local"
    ldap_bind_dn: str = ""
    ldap_bind_password: str = ""
    ldap_user_search_base: str = "OU=Users,DC=example,DC=local"
    ldap_user_filter: str = "(sAMAccountName={username})"
    ldap_group_attribute: str = "memberOf"

    default_admin_username: str = "admin"
    default_admin_password: str = "admin-change-me"

    ollama_base_url: str = "http://ollama:11434/v1"
    ollama_model: str = "llama3.1:latest"
    whisper_base_url: str = "http://whisper:8000/v1"
    whisper_model: str = "Systran/faster-whisper-large-v3"

    pacs_ae_title: str = "RADIOLOGY"
    pacs_host: str = "pacs.example.local"
    pacs_port: int = 104
    pacs_called_ae_title: str = "HOSPITALPACS"
    dicomweb_base_url: str = "http://orthanc:8042/dicom-web"

    license_signing_secret: str = "medarix-license-signing-secret"

    patient_data_key: str = ""
    allow_bootstrap_admin: bool = True
    allow_license_issue: bool = True
    expose_health_deps: bool = False
    login_rate_limit_per_minute: int = 20
    refresh_rate_limit_per_minute: int = 60
    max_upload_bytes: int = 52_428_800

    redis_url: str = ""
    trusted_proxy_ips: list[str] = Field(default_factory=lambda: ["127.0.0.1", "::1"])
    cookie_secure: bool = False
    cookie_samesite: str = "strict"
    refresh_cookie_name: str = "medarix_refresh"
    orthanc_username: str = "medarix"
    orthanc_password: str = "orthanc-change-me"
    allow_legacy_ui: bool = True

    @model_validator(mode="after")
    def resolve_database_url(self) -> "Settings":
        if self.database_url.strip():
            return self
        user = quote_plus(self.database_user)
        password = quote_plus(self.database_password)
        object.__setattr__(
            self,
            "database_url",
            (
                f"postgresql+psycopg://{user}:{password}@"
                f"{self.database_host}:{self.database_port}/{self.database_name}"
            ),
        )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
