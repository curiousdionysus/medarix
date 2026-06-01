import hashlib
import hmac
import json
from uuid import UUID

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.client_ip import client_ip
from app.core.config import get_settings
from app.models import AuditEvent, User


settings = get_settings()


def _audit_hash(payload: dict) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    return hmac.new(settings.audit_hmac_secret.encode(), serialized.encode(), hashlib.sha256).hexdigest()


def record_audit_event(
    db: Session,
    *,
    request: Request | None,
    action: str,
    resource_type: str,
    resource_id: str | UUID | None = None,
    actor: User | None = None,
    metadata: dict | None = None,
) -> AuditEvent:
    metadata = metadata or {}
    payload = {
        "actor_user_id": str(actor.id) if actor else None,
        "action": action,
        "resource_type": resource_type,
        "resource_id": str(resource_id) if resource_id else None,
        "ip_address": client_ip(request) if request else None,
        "user_agent": request.headers.get("user-agent") if request else None,
        "metadata": metadata,
    }
    event = AuditEvent(
        actor_user_id=actor.id if actor else None,
        action=action,
        resource_type=resource_type,
        resource_id=payload["resource_id"],
        ip_address=payload["ip_address"],
        user_agent=payload["user_agent"],
        metadata_json=metadata,
        integrity_hash=_audit_hash(payload),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
