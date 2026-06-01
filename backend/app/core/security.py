from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings


settings = get_settings()
password_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return password_context.verify(plain_password, password_hash)


def hash_password(password: str) -> str:
    return password_context.hash(password)


def create_access_token(
    subject: str,
    roles: list[str],
    extra_claims: dict[str, Any] | None = None,
    expires_minutes: int | None = None,
) -> str:
    minutes = expires_minutes if expires_minutes is not None else settings.access_token_minutes
    expires_at = datetime.now(UTC) + timedelta(minutes=minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "roles": roles,
        "iss": settings.session_jwt_issuer,
        "exp": expires_at,
        "iat": datetime.now(UTC),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.session_jwt_secret, algorithm="HS256")


def create_refresh_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
    expires_days: int | None = None,
) -> tuple[str, str]:
    """Return (encoded_token, jti)."""
    days = expires_days if expires_days is not None else settings.refresh_token_days
    expires_at = datetime.now(UTC) + timedelta(days=days)
    jti = str(uuid4())
    payload: dict[str, Any] = {
        "sub": subject,
        "iss": settings.session_jwt_issuer,
        "exp": expires_at,
        "iat": datetime.now(UTC),
        "type": "refresh",
        "jti": jti,
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, settings.session_jwt_secret, algorithm="HS256")
    return token, jti


def decode_refresh_token(token: str) -> dict[str, Any]:
    payload = decode_access_token(token)
    if payload.get("type") != "refresh":
        raise ValueError("Invalid refresh token")
    return payload


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.session_jwt_secret,
            algorithms=["HS256"],
            issuer=settings.session_jwt_issuer,
        )
    except JWTError as exc:
        raise ValueError("Invalid access token") from exc
