"""Rate limiting for auth endpoints (Redis with in-memory fallback)."""

from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from app.core.client_ip import client_ip


logger = logging.getLogger("medarix.security")


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._events: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, *, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            bucket = self._events[key]
            self._events[key] = [t for t in bucket if t > cutoff]
            if len(self._events[key]) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Çok fazla istek — lütfen kısa süre sonra tekrar deneyin.",
                )
            self._events[key].append(now)


class RedisRateLimiter:
    def __init__(self) -> None:
        self._fallback = InMemoryRateLimiter()
        self._redis = None
        self._redis_lock = threading.Lock()

    def _client(self):
        from app.core.config import get_settings

        settings = get_settings()
        if not settings.redis_url.strip():
            return None
        with self._redis_lock:
            if self._redis is not None:
                return self._redis
            try:
                import redis

                self._redis = redis.from_url(settings.redis_url, decode_responses=True)
                self._redis.ping()
                return self._redis
            except Exception as exc:  # noqa: BLE001
                logger.warning("Redis unavailable for rate limit, using in-memory fallback: %s", exc)
                return None

    def check(self, key: str, *, limit: int, window_seconds: int) -> None:
        client = self._client()
        if not client:
            self._fallback.check(key, limit=limit, window_seconds=window_seconds)
            return

        redis_key = f"medarix:ratelimit:{key}"
        try:
            count = client.incr(redis_key)
            if count == 1:
                client.expire(redis_key, window_seconds)
            if count > limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Çok fazla istek — lütfen kısa süre sonra tekrar deneyin.",
                )
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis rate limit error, falling back: %s", exc)
            self._fallback.check(key, limit=limit, window_seconds=window_seconds)


login_rate_limiter = RedisRateLimiter()
refresh_rate_limiter = RedisRateLimiter()


def check_login_rate(request: Request, username: str, *, limit: int) -> None:
    ip = client_ip(request)
    login_rate_limiter.check(f"login:ip:{ip}", limit=limit, window_seconds=60)
    login_rate_limiter.check(f"login:user:{username.lower()}", limit=max(5, limit // 2), window_seconds=60)


def check_refresh_rate(request: Request, *, limit: int) -> None:
    ip = client_ip(request)
    refresh_rate_limiter.check(f"refresh:ip:{ip}", limit=limit, window_seconds=60)
