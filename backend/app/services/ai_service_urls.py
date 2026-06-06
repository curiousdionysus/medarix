"""Resolve AI service URLs for Docker Compose vs host-local admin settings."""

from __future__ import annotations

from urllib.parse import urlparse

from app.core.config import get_settings

_settings = get_settings()

# Host ports published in docker-compose.yml -> in-network service base URLs.
_LOCALHOST_REWRITES: dict[tuple[int, str], str] = {
    (10300, "/v1"): "http://whisper:8000/v1",
    (11434, "/v1"): "http://ollama:11434/v1",
    (11434, ""): "http://ollama:11434",
    (8042, "/dicom-web"): "http://orthanc:8042/dicom-web",
    (8042, ""): "http://orthanc:8042",
}


def _rewrite_localhost_url(url: str, fallback: str) -> str:
    raw = (url or "").strip().rstrip("/") or fallback.rstrip("/")
    parsed = urlparse(raw)
    if parsed.hostname not in ("127.0.0.1", "localhost"):
        return raw
    port = parsed.port
    if port is None:
        return raw
    path = parsed.path.rstrip("/") or ""
    key = (port, path if path in ("/v1", "") else "/v1")
    if key in _LOCALHOST_REWRITES:
        return _LOCALHOST_REWRITES[key]
  # Common dev typo: localhost without /v1 for Ollama
    if port == 11434:
        return _LOCALHOST_REWRITES[(11434, "/v1")]
    if port == 10300:
        return _LOCALHOST_REWRITES[(10300, "/v1")]
    if port == 8042:
        return _LOCALHOST_REWRITES.get((8042, path if path in ("/dicom-web", "") else "/dicom-web"), raw)
    return raw


def resolve_transcription_base_url(configured: str) -> str:
    return _rewrite_localhost_url(configured, _settings.whisper_base_url)


def resolve_text_base_url(configured: str) -> str:
    return _rewrite_localhost_url(configured, _settings.ollama_base_url)


def resolve_dicomweb_base_url(configured: str) -> str:
    return _rewrite_localhost_url(configured, _settings.dicomweb_base_url)
