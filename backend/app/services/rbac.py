from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User
from app.services.permissions import BUILTIN_ROLE_PRESETS, expand_permissions, normalize_permissions


def user_role_slugs(user: User) -> list[str]:
    return [user_role.role.slug for user_role in user.roles]


def permissions_for_user(user: User) -> set[str]:
    merged: set[str] = set()
    for user_role in user.roles:
        role = user_role.role
        raw = role.permissions if role.permissions else []
        if role.is_builtin and role.slug in BUILTIN_ROLE_PRESETS and not raw:
            raw = BUILTIN_ROLE_PRESETS[role.slug]["permissions"]
        merged |= expand_permissions(normalize_permissions(list(raw) if isinstance(raw, list) else []))
    return merged


def has_permission(user: User, permission: str) -> bool:
    allowed = permissions_for_user(user)
    if "*" in allowed:
        return True
    if permission in allowed:
        return True
    # Wildcard namespaces, e.g. admin:* covers admin:users
    prefix = permission.rsplit(":", 1)[0] + ":*" if ":" in permission else None
    if prefix and prefix in allowed:
        return True
    # Legacy permission aliases
    aliases = {
        "report:create": "report:write",
        "report:update": "report:write",
        "template:read": "report:read",
        "template:delete": "report:delete",
        "pacs:store": "pacs:retrieve",
    }
    mapped = aliases.get(permission)
    return bool(mapped and mapped in allowed)


def require_permission(user: User, permission: str) -> None:
    if not has_permission(user, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Bu işlem için yetkiniz yok: {permission}",
        )


def require_any_permission(user: User, *permissions: str) -> None:
    if any(has_permission(user, p) for p in permissions):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Bu işlem için yetkiniz yok",
    )
