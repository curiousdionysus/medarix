"""Product licensing: Standard vs Enterprise edition gating.

License keys are self-contained, offline-verifiable tokens of the form
``<base64url(payload)>.<hmac>`` where the HMAC is computed with the server's
``license_signing_secret``. The payload encodes edition, licensee, seats and an
expiry date so activation works without contacting a license server.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import SystemSetting


settings = get_settings()

EDITION_STANDARD = "standard"
EDITION_ENTERPRISE = "enterprise"

LICENSE_CATEGORY = "Lisans"

# Capabilities unlocked by the Enterprise edition (used for display + gating).
ENTERPRISE_FEATURES = [
    {"key": "advanced_analytics", "label": "Gelişmiş Analitik ve KPI panoları"},
    {"key": "ai_assistant", "label": "AI Asistan ve akıllı öneriler"},
    {"key": "pacs_integration", "label": "PACS / DICOM SR entegrasyonu"},
    {"key": "audit_trail", "label": "Genişletilmiş denetim kaydı ve uyumluluk"},
    {"key": "unlimited_seats", "label": "Sınırsız kullanıcı koltuğu"},
    {"key": "priority_support", "label": "Öncelikli kurumsal destek"},
]

STANDARD_FEATURES = [
    {"key": "dictation", "label": "Canlı diktasyon ve transkripsiyon"},
    {"key": "reporting", "label": "Yapılandırılmış raporlama"},
    {"key": "worklist", "label": "İş listesi yönetimi"},
]


def _hmac_hex(payload_b64: str) -> str:
    return hmac.new(
        settings.license_signing_secret.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _sign_legacy(payload_b64: str) -> str:
    return _hmac_hex(payload_b64)[:16]


def _sign(payload_b64: str) -> str:
    """Full-length signature for newly issued keys (legacy keys use 16-char prefix)."""
    return _hmac_hex(payload_b64)


def _signature_matches(payload_b64: str, signature: str) -> bool:
    digest = _hmac_hex(payload_b64)
    if hmac.compare_digest(signature, digest):
        return True
    if len(signature) == 16 and hmac.compare_digest(signature, digest[:16]):
        return True
    return False


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def issue_key(edition: str, licensed_to: str, seats: int, expires: str) -> str:
    """Generate a signed license key. ``expires`` is an ISO date (YYYY-MM-DD)."""
    payload = {
        "ed": edition,
        "to": licensed_to,
        "seats": seats,
        "exp": expires,
    }
    payload_b64 = _b64encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    return f"{payload_b64}.{_sign(payload_b64)}"


def parse_key(key: str) -> dict:
    """Validate signature and return the decoded payload, or raise ValueError."""
    key = (key or "").strip()
    if "." not in key:
        raise ValueError("Geçersiz lisans anahtarı biçimi.")
    payload_b64, signature = key.rsplit(".", 1)
    if not _signature_matches(payload_b64, signature):
        raise ValueError("Lisans anahtarı imzası doğrulanamadı.")
    try:
        payload = json.loads(_b64decode(payload_b64))
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Lisans anahtarı çözümlenemedi.") from exc
    if payload.get("ed") not in (EDITION_STANDARD, EDITION_ENTERPRISE):
        raise ValueError("Bilinmeyen sürüm.")
    exp = payload.get("exp")
    if exp:
        try:
            expiry = date.fromisoformat(exp)
        except ValueError as exc:
            raise ValueError("Geçersiz son kullanma tarihi.") from exc
        if expiry < date.today():
            raise ValueError(f"Lisans {exp} tarihinde sona ermiş.")
    return payload


def _upsert(db: Session, key: str, value: str, label: str) -> None:
    row = db.get(SystemSetting, key)
    if row:
        row.value = value
    else:
        db.add(
            SystemSetting(
                key=key,
                value=value,
                category=LICENSE_CATEGORY,
                label=label,
                description=None,
                is_secret=False,
            )
        )


def _read(db: Session, key: str, default: str = "") -> str:
    row = db.get(SystemSetting, key)
    return row.value if row else default


def get_license(db: Session) -> dict:
    edition = _read(db, "license.edition", EDITION_STANDARD) or EDITION_STANDARD
    expires = _read(db, "license.expires_at", "")
    valid = True
    if edition == EDITION_ENTERPRISE and expires:
        try:
            valid = date.fromisoformat(expires) >= date.today()
        except ValueError:
            valid = False
    is_enterprise = edition == EDITION_ENTERPRISE and valid
    return {
        "edition": edition if is_enterprise else EDITION_STANDARD,
        "raw_edition": edition,
        "is_enterprise": is_enterprise,
        "valid": valid,
        "licensed_to": _read(db, "license.licensed_to", ""),
        "seats": _read(db, "license.seats", ""),
        "activated_at": _read(db, "license.activated_at", ""),
        "expires_at": expires,
        "enterprise_features": ENTERPRISE_FEATURES,
        "standard_features": STANDARD_FEATURES,
    }


def activate(db: Session, key: str) -> dict:
    payload = parse_key(key)
    _upsert(db, "license.edition", payload["ed"], "Sürüm")
    _upsert(db, "license.key", key, "Lisans anahtarı")
    _upsert(db, "license.licensed_to", str(payload.get("to", "")), "Lisans sahibi")
    _upsert(db, "license.seats", str(payload.get("seats", "")), "Koltuk sayısı")
    _upsert(db, "license.expires_at", str(payload.get("exp", "")), "Son kullanma tarihi")
    _upsert(db, "license.activated_at", datetime.now(timezone.utc).isoformat(), "Etkinleştirme zamanı")
    db.commit()
    return get_license(db)


def deactivate(db: Session) -> dict:
    _upsert(db, "license.edition", EDITION_STANDARD, "Sürüm")
    _upsert(db, "license.key", "", "Lisans anahtarı")
    _upsert(db, "license.licensed_to", "", "Lisans sahibi")
    _upsert(db, "license.seats", "", "Koltuk sayısı")
    _upsert(db, "license.expires_at", "", "Son kullanma tarihi")
    _upsert(db, "license.activated_at", "", "Etkinleştirme zamanı")
    db.commit()
    return get_license(db)
