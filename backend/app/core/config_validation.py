"""Startup validation for unsafe pilot defaults (production only)."""

from __future__ import annotations

import logging

from app.core.config import Settings


logger = logging.getLogger("medarix.security")

_UNSAFE_SECRETS = frozenset(
    {
        "change-me-before-production",
        "replace-with-vault-secret",
        "medarix-license-signing-secret",
    }
)
_UNSAFE_ADMIN_PASSWORDS = frozenset({"admin-change-me", "admin", "password"})
_UNSAFE_ORTHANC_PASSWORDS = frozenset({"orthanc-change-me", "orthanc", "password", ""})


def validate_settings(settings: Settings) -> None:
    if settings.environment.lower() not in {"production", "prod"}:
        return

    problems: list[str] = []
    if settings.session_jwt_secret in _UNSAFE_SECRETS or len(settings.session_jwt_secret) < 32:
        problems.append("MEDARIX_SESSION_JWT_SECRET must be a strong unique value (32+ chars).")
    if settings.audit_hmac_secret in _UNSAFE_SECRETS or len(settings.audit_hmac_secret) < 32:
        problems.append("MEDARIX_AUDIT_HMAC_SECRET must be a strong unique value (32+ chars).")
    if settings.license_signing_secret in _UNSAFE_SECRETS or len(settings.license_signing_secret) < 32:
        problems.append("MEDARIX_LICENSE_SIGNING_SECRET must be a strong unique value (32+ chars).")
    if settings.default_admin_password in _UNSAFE_ADMIN_PASSWORDS:
        problems.append("MEDARIX_DEFAULT_ADMIN_PASSWORD must not be a known default.")
    if settings.allow_bootstrap_admin:
        problems.append("Set MEDARIX_ALLOW_BOOTSTRAP_ADMIN=false in production.")
    if settings.allow_license_issue:
        problems.append("Set MEDARIX_ALLOW_LICENSE_ISSUE=false in production.")
    if not settings.redis_url.strip():
        problems.append("MEDARIX_REDIS_URL is required in production (refresh token revocation).")
    if not settings.patient_data_key.strip():
        problems.append("MEDARIX_PATIENT_DATA_KEY must be set in production (do not rely on audit HMAC fallback).")
    if settings.allow_legacy_ui:
        problems.append("Set MEDARIX_ALLOW_LEGACY_UI=false in production.")
    if settings.orthanc_password in _UNSAFE_ORTHANC_PASSWORDS:
        problems.append("MEDARIX_ORTHANC_PASSWORD must not be a known default.")
    if not settings.cookie_secure:
        problems.append("Set MEDARIX_COOKIE_SECURE=true in production (HTTPS).")

    if problems:
        raise RuntimeError("Unsafe Medarix production configuration: " + " ".join(problems))

    logger.info("Medarix production security configuration validated.")
