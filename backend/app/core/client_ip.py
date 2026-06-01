"""Resolve client IP for audit and rate limiting behind trusted proxies."""

from __future__ import annotations

import ipaddress

from starlette.requests import Request

from app.core.config import get_settings


def _parse_trusted_networks(entries: list[str]) -> list[ipaddress._BaseNetwork]:  # noqa: SLF001
    networks: list[ipaddress._BaseNetwork] = []
    for raw in entries:
        value = raw.strip()
        if not value:
            continue
        try:
            if "/" in value:
                networks.append(ipaddress.ip_network(value, strict=False))
            else:
                networks.append(ipaddress.ip_network(f"{value}/32", strict=False))
        except ValueError:
            continue
    return networks


def _is_trusted_proxy(peer_host: str | None, trusted: list[ipaddress._BaseNetwork]) -> bool:
    if not peer_host or not trusted:
        return False
    try:
        addr = ipaddress.ip_address(peer_host)
    except ValueError:
        return False
    return any(addr in network for network in trusted)


def client_ip(request: Request) -> str:
    settings = get_settings()
    trusted = _parse_trusted_networks(settings.trusted_proxy_ips)
    peer_host = request.client.host if request.client else None

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded and _is_trusted_proxy(peer_host, trusted):
        return forwarded.split(",")[0].strip()

    if peer_host:
        return peer_host
    return "unknown"
