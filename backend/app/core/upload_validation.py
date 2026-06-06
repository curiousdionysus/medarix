"""Upload content validation for security-sensitive endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, status

ALLOWED_AUDIO_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".webm",
        ".wav",
        ".mp3",
        ".mpeg",
        ".ogg",
        ".opus",
        ".m4a",
        ".mp4",
        ".flac",
        ".aac",
        ".wma",
    }
)

ALLOWED_AUDIO_TYPES: dict[str, tuple[str, ...]] = {
    "audio/webm": (".webm",),
    "video/webm": (".webm",),
    "audio/wav": (".wav",),
    "audio/x-wav": (".wav",),
    "audio/mpeg": (".mp3", ".mpeg"),
    "audio/mp3": (".mp3",),
    "audio/ogg": (".ogg",),
    "audio/opus": (".opus",),
    "audio/mp4": (".mp4", ".m4a"),
    "audio/x-m4a": (".m4a",),
    "audio/m4a": (".m4a",),
    "audio/flac": (".flac",),
    "audio/aac": (".aac",),
    "audio/x-aac": (".aac",),
    "video/mp4": (".mp4", ".m4a"),
    "video/quicktime": (".mp4", ".m4a"),
    "application/octet-stream": tuple(ALLOWED_AUDIO_EXTENSIONS),
}


def validate_audio_upload(filename: str | None, content_type: str | None) -> None:
    normalized_type = (content_type or "").split(";")[0].strip().lower()
    suffix = Path(filename or "").suffix.lower()

    allowed_suffixes = ALLOWED_AUDIO_TYPES.get(normalized_type)
    if not allowed_suffixes:
        if suffix in ALLOWED_AUDIO_EXTENSIONS:
            return
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Desteklenmeyen ses dosyası türü.",
        )
    if suffix and suffix not in allowed_suffixes:
        if suffix in ALLOWED_AUDIO_EXTENSIONS:
            return
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Dosya uzantısı içerik türü ile uyuşmuyor.",
        )
