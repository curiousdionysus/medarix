import base64
import hashlib
import unicodedata

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


settings = get_settings()


def _fernet_key(raw_key: str) -> bytes:
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _resolve_key_source(raw_key: str | None = None) -> str:
    if raw_key:
        return raw_key
    if settings.patient_data_key.strip():
        return settings.patient_data_key.strip()
    return settings.audit_hmac_secret


def _fernet(raw_key: str | None = None) -> Fernet:
    return Fernet(_fernet_key(_resolve_key_source(raw_key)))


def escape_ilike_pattern(value: str) -> str:
    """Escape user input for SQL ILIKE (PostgreSQL ESCAPE '\\')."""
    normalized = normalize_name(value)
    return normalized.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def patient_hash(patient_id: str) -> str:
    normalized = patient_id.strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def normalize_name(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value.strip().casefold())
    return "".join(ch for ch in folded if not unicodedata.combining(ch))


def encrypt_value(value: str, raw_key: str | None = None) -> str:
    if not value:
        return ""
    return _fernet(raw_key).encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str | None, raw_key: str | None = None) -> str | None:
    if not value:
        return None
    try:
        return _fernet(raw_key).decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return value


def build_name_search(first_name: str | None, last_name: str | None, full_name: str | None = None) -> str | None:
    parts = [part for part in [first_name, last_name, full_name] if part and part.strip()]
    if not parts:
        return None
    return normalize_name(" ".join(parts))
