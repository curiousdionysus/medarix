from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models import AuditEvent, Group, Report, Role, RoleName, User, UserGroup, UserRole
from app.services.token_store import revoke_all_for_user
from app.schemas import (
    AdminGroupCreate,
    AdminGroupOut,
    AdminRoleCreate,
    AdminRoleOut,
    AdminRoleUpdate,
    AdminUserCreate,
    AdminUserOut,
    AuthVerifyRequest,
    AuthVerifyResponse,
    LicenseActivateRequest,
    LicenseIssueRequest,
    SystemSettingsGroup,
    SystemSettingsUpdate,
)
from app.services import license as license_service
from app.services.audit import record_audit_event
from app.services.permissions import (
    BUILTIN_ADMIN,
    BUILTIN_ROLE_PRESETS,
    ensure_builtin_roles,
    normalize_permissions,
    permission_catalog,
    slugify_role_name,
)
from app.services.rbac import require_any_permission, require_permission
from app.services.recording_storage import purge_expired_recordings
from app.services.ai_gateway import ai_gateway
from app.services.ldap_auth import LDAP_SETTING_KEYS, verify_ldap_configuration
from app.services.system_settings import get_settings_map, list_grouped_settings, update_settings


router = APIRouter(prefix="/admin", tags=["admin"])


def _role_out(role: Role, user_count: int = 0) -> AdminRoleOut:
    perms = normalize_permissions(list(role.permissions) if role.permissions else [])
    if role.is_builtin and role.slug in BUILTIN_ROLE_PRESETS and not perms:
        perms = normalize_permissions(BUILTIN_ROLE_PRESETS[role.slug]["permissions"])
    return AdminRoleOut(
        id=role.id,
        slug=role.slug,
        label=role.label or role.slug,
        description=role.description,
        is_builtin=role.is_builtin,
        permissions=perms,
        user_count=user_count,
    )


def _resolve_roles(db: Session, slugs: list[str]) -> list[Role]:
    ensure_builtin_roles(db)
    cleaned = [s.strip() for s in slugs if s and s.strip()]
    if not cleaned:
        cleaned = [RoleName.viewer.value]
    roles = list(db.scalars(select(Role).where(Role.slug.in_(cleaned))))
    if len(roles) != len(set(cleaned)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more roles were not found")
    return roles


def _user_out(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        auth_provider=user.auth_provider,
        is_active=user.is_active,
        roles=[user_role.role.slug for user_role in user.roles],
        groups=[user_group.group for user_group in user.groups],
        created_at=user.created_at,
    )


@router.get("/permissions")
def list_permission_catalog(
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    require_any_permission(current_user, "admin:roles", "admin:access", "*")
    return permission_catalog()


@router.get("/roles", response_model=list[AdminRoleOut])
def list_roles(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[AdminRoleOut]:
    require_any_permission(current_user, "admin:roles", "admin:users", "admin:access", "*")
    ensure_builtin_roles(db)
    roles = list(db.scalars(select(Role).order_by(Role.is_builtin.desc(), Role.label)))
    counts = dict(
        db.execute(
            select(UserRole.role_id, func.count())
            .group_by(UserRole.role_id)
        ).all()
    )
    return [_role_out(role, int(counts.get(role.id, 0))) for role in roles]


@router.post("/roles", response_model=AdminRoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    request: Request,
    payload: AdminRoleCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AdminRoleOut:
    require_permission(current_user, "admin:roles")
    ensure_builtin_roles(db)
    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role label is required")
    slug = (payload.slug or slugify_role_name(label)).strip().lower()
    if slug in BUILTIN_ROLE_PRESETS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu slug yerleşik bir rol için ayrılmış")
    if db.scalar(select(Role).where(Role.slug == slug)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role slug already exists")
    perms = normalize_permissions(payload.permissions)
    if not perms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="En az bir yetki seçin")
    role = Role(
        slug=slug,
        name=slug,
        label=label,
        description=payload.description.strip() if payload.description else None,
        is_builtin=False,
        permissions=perms,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    record_audit_event(
        db,
        request=request,
        action="admin.role.create",
        resource_type="role",
        resource_id=str(role.id),
        actor=current_user,
        metadata={"slug": slug, "permissions": perms},
    )
    return _role_out(role, 0)


@router.patch("/roles/{role_id}", response_model=AdminRoleOut)
def update_role(
    role_id: UUID,
    request: Request,
    payload: AdminRoleUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AdminRoleOut:
    require_permission(current_user, "admin:roles")
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.is_builtin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yerleşik roller düzenlenemez",
        )
    if payload.label is not None:
        label = payload.label.strip()
        if not label:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role label is required")
        role.label = label
    if payload.description is not None:
        role.description = payload.description.strip() or None
    if payload.permissions is not None:
        perms = normalize_permissions(payload.permissions)
        if not perms:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="En az bir yetki seçin")
        role.permissions = perms
    db.commit()
    db.refresh(role)
    record_audit_event(
        db,
        request=request,
        action="admin.role.update",
        resource_type="role",
        resource_id=str(role.id),
        actor=current_user,
        metadata={"slug": role.slug},
    )
    count = db.scalar(select(func.count()).select_from(UserRole).where(UserRole.role_id == role.id)) or 0
    return _role_out(role, int(count))


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: UUID,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    require_permission(current_user, "admin:roles:delete")
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.is_builtin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yerleşik roller silinemez")
    assigned = db.scalar(select(func.count()).select_from(UserRole).where(UserRole.role_id == role.id))
    if assigned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu role atanmış kullanıcılar var; önce atamayı kaldırın",
        )
    slug = role.slug
    db.delete(role)
    db.commit()
    record_audit_event(
        db,
        request=request,
        action="admin.role.delete",
        resource_type="role",
        resource_id=str(role_id),
        actor=current_user,
        metadata={"slug": slug},
    )


@router.get("/groups", response_model=list[AdminGroupOut])
def list_groups(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[Group]:
    require_any_permission(current_user, "admin:groups", "admin:access", "*")
    return list(db.scalars(select(Group).order_by(Group.name)))


@router.post("/groups", response_model=AdminGroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    request: Request,
    payload: AdminGroupCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Group:
    require_permission(current_user, "admin:groups")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Group name is required")
    if db.scalar(select(Group).where(Group.name == name)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Group already exists")

    group = Group(name=name, description=payload.description.strip() if payload.description else None)
    db.add(group)
    db.commit()
    db.refresh(group)
    record_audit_event(
        db,
        request=request,
        action="admin.group.create",
        resource_type="group",
        resource_id=group.id,
        actor=current_user,
        metadata={"name": group.name},
    )
    return group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: UUID,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    require_permission(current_user, "admin:groups:delete")
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    name = group.name
    db.delete(group)
    db.commit()
    record_audit_event(
        db,
        request=request,
        action="admin.group.delete",
        resource_type="group",
        resource_id=str(group_id),
        actor=current_user,
        metadata={"name": name},
    )


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[AdminUserOut]:
    require_any_permission(current_user, "admin:users", "admin:access", "*")
    users = db.scalars(
        select(User)
        .options(selectinload(User.roles).selectinload(UserRole.role), selectinload(User.groups).selectinload(UserGroup.group))
        .order_by(User.username)
    )
    return [_user_out(user) for user in users]


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    request: Request,
    payload: AdminUserCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AdminUserOut:
    require_permission(current_user, "admin:users")
    username = payload.username.strip()
    if not username or not payload.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username and password are required")
    if db.scalar(select(User).where(User.username == username)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    selected_roles = _resolve_roles(db, payload.roles)
    groups = list(db.scalars(select(Group).where(Group.id.in_(payload.group_ids)))) if payload.group_ids else []
    if len(groups) != len(set(payload.group_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more groups were not found")

    user = User(
        username=username,
        display_name=payload.display_name.strip() if payload.display_name else None,
        email=payload.email.strip() if payload.email else None,
        auth_provider="local",
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    db.flush()
    for role in selected_roles:
        db.add(UserRole(user_id=user.id, role_id=role.id))
    for group in groups:
        db.add(UserGroup(user_id=user.id, group_id=group.id))
    db.commit()
    db.refresh(user)
    user = db.scalar(
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.roles).selectinload(UserRole.role), selectinload(User.groups).selectinload(UserGroup.group))
    )
    record_audit_event(
        db,
        request=request,
        action="admin.user.create",
        resource_type="user",
        resource_id=user.id,
        actor=current_user,
        metadata={"username": user.username, "roles": [r.slug for r in selected_roles], "group_count": len(groups)},
    )
    return _user_out(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    require_permission(current_user, "admin:users:delete")
    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles).selectinload(UserRole.role))
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendi hesabınızı silemezsiniz",
        )

    ensure_builtin_roles(db)
    admin_role = db.scalar(select(Role).where(Role.slug == BUILTIN_ADMIN))
    is_admin = admin_role is not None and any(ur.role_id == admin_role.id for ur in user.roles)
    if is_admin:
        admin_count = db.scalar(
            select(func.count())
            .select_from(UserRole)
            .where(UserRole.role_id == admin_role.id)
        )
        if admin_count is not None and admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Son yönetici hesabı silinemez",
            )

    report_count = db.scalar(select(func.count()).select_from(Report).where(Report.author_id == user.id))
    if report_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu kullanıcıya bağlı raporlar var; kullanıcı silinemez",
        )

    username = user.username
    revoke_all_for_user(username)
    db.delete(user)
    db.commit()
    record_audit_event(
        db,
        request=request,
        action="admin.user.delete",
        resource_type="user",
        resource_id=str(user_id),
        actor=current_user,
        metadata={"username": username},
    )


@router.get("/audit")
def audit_events(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = 100,
) -> list[dict]:
    require_permission(current_user, "admin:audit")
    events = list(db.scalars(select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(min(limit, 500))))

    actor_ids = {event.actor_user_id for event in events if event.actor_user_id}
    user_map: dict = {}
    if actor_ids:
        rows = db.execute(select(User.id, User.username, User.display_name).where(User.id.in_(actor_ids))).all()
        user_map = {row[0]: {"username": row[1], "display_name": row[2]} for row in rows}

    result = []
    for event in events:
        actor = user_map.get(event.actor_user_id) if event.actor_user_id else None
        result.append(
            {
                "id": event.id,
                "occurred_at": event.occurred_at,
                "actor_user_id": event.actor_user_id,
                "actor_username": actor["username"] if actor else None,
                "actor_display_name": actor["display_name"] if actor else None,
                "action": event.action,
                "resource_type": event.resource_type,
                "resource_id": event.resource_id,
                "ip_address": str(event.ip_address) if event.ip_address else None,
                "metadata": event.metadata_json,
                "integrity_hash": event.integrity_hash,
            }
        )
    return result


@router.get("/health/security")
def security_posture(current_user: Annotated[User, Depends(get_current_user)]) -> dict:
    require_any_permission(current_user, "admin:access", "admin:settings", "*")
    return {
        "audit": "append_only_hmac_enabled",
        "auth": "ldap_ready_jwt_sessions",
        "rbac": "server_side_enforced",
        "secrets": "vault_compatible_env_injection",
        "transport": "tls_expected_at_ingress",
    }


@router.get("/ai/models/text")
async def admin_list_text_models(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    base_url: str | None = None,
) -> dict:
    require_permission(current_user, "admin:settings")
    merged = get_settings_map(db)
    url = (base_url or "").strip() or merged.get("ai.text_base_url", "").strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Önce dil modeli sunucusu adresini girin",
        )
    try:
        models = await ai_gateway.list_text_models(url)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Dil modeli sunucusuna ulaşılamadı: {exc}",
        ) from exc
    return {"models": models}


@router.get("/ai/models/transcription")
async def admin_list_transcription_models(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    base_url: str | None = None,
) -> dict:
    require_permission(current_user, "admin:settings")
    merged = get_settings_map(db)
    url = (base_url or "").strip() or merged.get("ai.transcription_base_url", "").strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Önce transkripsiyon sunucusu adresini girin",
        )
    try:
        models = await ai_gateway.list_transcription_models(url)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Transkripsiyon sunucusuna ulaşılamadı: {exc}",
        ) from exc
    return {"models": models}


@router.post("/auth/verify", response_model=AuthVerifyResponse)
def verify_auth_settings(
    request: Request,
    payload: AuthVerifyRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AuthVerifyResponse:
    require_permission(current_user, "admin:settings")
    merged = get_settings_map(db)
    for key in LDAP_SETTING_KEYS:
        if key in payload.settings:
            merged[key] = payload.settings[key]
    result = verify_ldap_configuration(
        merged,
        test_username=payload.test_username,
        test_password=payload.test_password,
    )
    record_audit_event(
        db,
        request=request,
        action="admin.auth.verify",
        resource_type="system_settings",
        actor=current_user,
        metadata={"ok": result["ok"], "mode": result["mode"]},
    )
    return AuthVerifyResponse(**result)


@router.get("/system-settings", response_model=list[SystemSettingsGroup])
def get_system_settings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    require_permission(current_user, "admin:settings")
    return list_grouped_settings(db)


@router.put("/system-settings")
def put_system_settings(
    request: Request,
    payload: SystemSettingsUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "admin:settings")
    try:
        updated = update_settings(db, payload.settings, current_user.id)
    except KeyError as exc:
        msg = str(exc.args[0]) if exc.args else "Invalid setting"
        if msg.startswith("branding.") or "çok büyük" in msg:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown setting: {msg}") from exc

    if "storage.recording_retention_days" in payload.settings:
        purge_expired_recordings(db)

    record_audit_event(
        db,
        request=request,
        action="admin.system_settings.update",
        resource_type="system_settings",
        actor=current_user,
        metadata={"updated_keys": sorted(payload.settings.keys())},
    )
    return {"status": "saved", "settings": updated}


@router.get("/license")
def get_license(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "admin:license")
    return license_service.get_license(db)


@router.post("/license/activate")
def activate_license(
    request: Request,
    payload: LicenseActivateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "admin:license")
    try:
        result = license_service.activate(db, payload.key)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    record_audit_event(
        db,
        request=request,
        action="admin.license.activate",
        resource_type="license",
        actor=current_user,
        metadata={"edition": result["edition"], "licensed_to": result["licensed_to"], "expires_at": result["expires_at"]},
    )
    return result


@router.post("/license/deactivate")
def deactivate_license(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "admin:license")
    result = license_service.deactivate(db)
    record_audit_event(
        db,
        request=request,
        action="admin.license.deactivate",
        resource_type="license",
        actor=current_user,
    )
    return result


@router.post("/license/issue")
def issue_license(
    request: Request,
    payload: LicenseIssueRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Generate a signed license key (super-admin only, for self-hosted provisioning)."""
    require_permission(current_user, "admin:license")
    from app.core.config import get_settings

    if not get_settings().allow_license_issue:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Lisans üretimi bu ortamda devre dışı bırakıldı.",
        )
    from datetime import date, timedelta

    expires = (date.today() + timedelta(days=max(1, payload.valid_days))).isoformat()
    key = license_service.issue_key(payload.edition, payload.licensed_to or "Medarix", payload.seats, expires)
    record_audit_event(
        db,
        request=request,
        action="admin.license.issue",
        resource_type="license",
        actor=current_user,
        metadata={"edition": payload.edition, "expires_at": expires},
    )
    return {"key": key, "edition": payload.edition, "expires_at": expires}
