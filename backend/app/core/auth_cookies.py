"""HttpOnly refresh token cookies."""

from fastapi import Response

from app.core.config import get_settings


def refresh_cookie_path() -> str:
    settings = get_settings()
    return f"{settings.api_prefix.rstrip('/')}/auth"


def set_refresh_cookie(response: Response, token: str, *, max_age_seconds: int) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=max_age_seconds,
        path=refresh_cookie_path(),
    )


def clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=refresh_cookie_path(),
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
