from unittest.mock import patch

from starlette.requests import Request

from app.core.client_ip import client_ip


def test_client_ip_direct():
    with patch("app.core.client_ip.get_settings") as mocked:
        mocked.return_value.trusted_proxy_ips = ["127.0.0.1"]
        request = Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": [],
                "client": ("203.0.113.10", 4000),
            }
        )
        assert client_ip(request) == "203.0.113.10"


def test_client_ip_ignores_forwarded_from_untrusted_peer():
    with patch("app.core.client_ip.get_settings") as mocked:
        mocked.return_value.trusted_proxy_ips = ["127.0.0.1"]
        request = Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": [(b"x-forwarded-for", b"198.51.100.9")],
                "client": ("203.0.113.10", 4000),
            }
        )
        assert client_ip(request) == "203.0.113.10"


def test_client_ip_honors_forwarded_from_trusted_proxy():
    with patch("app.core.client_ip.get_settings") as mocked:
        mocked.return_value.trusted_proxy_ips = ["10.0.0.5"]
        request = Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": [(b"x-forwarded-for", b"198.51.100.9, 10.0.0.1")],
                "client": ("10.0.0.5", 4000),
            }
        )
        assert client_ip(request) == "198.51.100.9"
