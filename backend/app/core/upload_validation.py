"""Upload content validation for security-sensitive endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, status


ALLOWED_AUDIO_TYPES: dict[str, tuple[str, ...]] = {
    "audio/webm": (".webm",),
    "audio/wav": (".wav",),
    "audio/x-wav": (".wav",),
    "audio/mpeg": (".mp3", ".mpeg"),
    "audio/ogg": (".ogg",),
    "application/octet-stream": (".webm", ".wav", ".mp3", ".ogg", ".mpeg"),
}


def validate_audio_upload(filename: str | None, content_type: str | None) -> None:
    normalized_type = (content_type or "").split(";")[0].strip().lower()
    suffix = Path(filename or "").suffix.lower()
    allowed_suffixes = ALLOWED_AUDIO_TYPES.get(normalized_type)
    if not allowed_suffixes:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Desteklenmeyen ses dosyası türü.",
        )
    if suffix and suffix not in allowed_suffixes:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Dosya uzantısı içerik türü ile uyuşmuyor.",
        )
