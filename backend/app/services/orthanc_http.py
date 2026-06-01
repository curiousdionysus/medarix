"""Shared Orthanc HTTP basic auth for REST and DICOMweb."""

from __future__ import annotations

import httpx

from app.core.config import get_settings


def orthanc_basic_auth() -> httpx.BasicAuth | None:
    settings = get_settings()
    if settings.orthanc_username.strip():
        return httpx.BasicAuth(settings.orthanc_username, settings.orthanc_password)
    return None
