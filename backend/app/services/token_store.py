"""Refresh token JTI storage (Redis with in-memory fallback for local dev)."""

from __future__ import annotations

import logging
import threading
import time

from app.core.config import get_settings


logger = logging.getLogger("medarix.security")

_memory_jtis: dict[str, tuple[str, float]] = {}
_memory_user_index: dict[str, set[str]] = {}
_memory_lock = threading.Lock()
_redis_client = None
_redis_lock = threading.Lock()


def _get_redis():
    global _redis_client
    settings = get_settings()
    if not settings.redis_url.strip():
        return None
    with _redis_lock:
        if _redis_client is not None:
            return _redis_client
        try:
            import redis

            _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
            _redis_client.ping()
            return _redis_client
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis unavailable for token store, using in-memory fallback: %s", exc)
            return None


def store_refresh_jti(username: str, jti: str, ttl_seconds: int) -> None:
    ttl_seconds = max(60, int(ttl_seconds))
    client = _get_redis()
    if client:
        pipe = client.pipeline()
        pipe.setex(f"medarix:refresh:{jti}", ttl_seconds, username)
        pipe.sadd(f"medarix:user_refresh:{username}", jti)
        pipe.expire(f"medarix:user_refresh:{username}", ttl_seconds)
        pipe.execute()
        return

    expires_at = time.monotonic() + ttl_seconds
    with _memory_lock:
        _memory_jtis[jti] = (username, expires_at)
        _memory_user_index.setdefault(username, set()).add(jti)


def is_refresh_active(jti: str) -> bool:
    client = _get_redis()
    if client:
        return bool(client.exists(f"medarix:refresh:{jti}"))

    now = time.monotonic()
    with _memory_lock:
        entry = _memory_jtis.get(jti)
        if not entry:
            return False
        username, expires_at = entry
        if expires_at <= now:
            _memory_jtis.pop(jti, None)
            if username in _memory_user_index:
                _memory_user_index[username].discard(jti)
            return False
        return True


def revoke_refresh_jti(jti: str) -> None:
    client = _get_redis()
    if client:
        username = client.get(f"medarix:refresh:{jti}")
        pipe = client.pipeline()
        pipe.delete(f"medarix:refresh:{jti}")
        if username:
            pipe.srem(f"medarix:user_refresh:{username}", jti)
        pipe.execute()
        return

    with _memory_lock:
        entry = _memory_jtis.pop(jti, None)
        if entry:
            username, _ = entry
            if username in _memory_user_index:
                _memory_user_index[username].discard(jti)


def revoke_all_for_user(username: str) -> None:
    client = _get_redis()
    if client:
        jtis = client.smembers(f"medarix:user_refresh:{username}")
        if jtis:
            pipe = client.pipeline()
            for jti in jtis:
                pipe.delete(f"medarix:refresh:{jti}")
            pipe.delete(f"medarix:user_refresh:{username}")
            pipe.execute()
        return

    with _memory_lock:
        for jti in list(_memory_user_index.get(username, set())):
            _memory_jtis.pop(jti, None)
        _memory_user_index.pop(username, None)
