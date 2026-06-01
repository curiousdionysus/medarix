from app.core.security import create_refresh_token, decode_refresh_token
from app.services import token_store


def test_refresh_token_includes_jti():
    token, jti = create_refresh_token("radiologist1")
    payload = decode_refresh_token(token)
    assert payload["jti"] == jti
    assert payload["sub"] == "radiologist1"
    assert payload["type"] == "refresh"


def test_token_store_revoke_flow():
    token_store.revoke_all_for_user("user-a")
    token_store.store_refresh_jti("user-a", "jti-a", ttl_seconds=3600)
    assert token_store.is_refresh_active("jti-a")
    token_store.revoke_refresh_jti("jti-a")
    assert not token_store.is_refresh_active("jti-a")
