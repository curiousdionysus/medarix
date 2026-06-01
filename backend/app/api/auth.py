from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.auth_cookies import clear_refresh_cookie, set_refresh_cookie
from app.core.config import get_settings
from app.core.rate_limit import check_login_rate, check_refresh_rate
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models import Role, RoleName, User, UserRole
from app.schemas import LoginRequest, RefreshRequest, TokenResponse, UserOut, UserProfileUpdate
from app.services.audit import record_audit_event
from app.services.ldap_auth import authenticate_ldap
from app.services.permissions import ensure_builtin_roles
from app.services.rbac import permissions_for_user, user_role_slugs
from app.services.system_settings import get_settings_map
from app.services.token_store import is_refresh_active, revoke_refresh_jti, store_refresh_jti


router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _session_minutes(system_settings: dict[str, str]) -> int:
    raw = system_settings.get("security.session_minutes", str(settings.access_token_minutes))
    try:
        return max(1, int(raw))
    except ValueError:
        return settings.access_token_minutes


def _refresh_token_days(system_settings: dict[str, str]) -> int:
    raw = system_settings.get("security.refresh_token_days", str(settings.refresh_token_days))
    try:
        return max(1, int(raw))
    except ValueError:
        return settings.refresh_token_days


def _role(db: Session, slug: str | RoleName) -> Role:
    key = slug.value if isinstance(slug, RoleName) else slug
    ensure_builtin_roles(db)
    role = db.scalar(select(Role).where(Role.slug == key))
    if role:
        return role
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Role not provisioned: {key}")


def _ensure_default_admin(db: Session) -> None:
    existing = db.scalar(select(User).where(User.username == settings.default_admin_username))
    if existing:
        return

    admin = User(
        username=settings.default_admin_username,
        display_name="Administrator",
        auth_provider="local",
        password_hash=hash_password(settings.default_admin_password),
    )
    db.add(admin)
    db.flush()
    db.add(UserRole(user_id=admin.id, role_id=_role(db, RoleName.admin).id))
    db.commit()


def _upsert_ldap_user(db: Session, login: LoginRequest, system_settings: dict[str, str]) -> User | None:
    identity = authenticate_ldap(login.username, login.password, system_settings)
    if not identity:
        return None

    user = db.scalar(select(User).where(User.username == identity.username))
    if not user:
        user = User(
            username=identity.username,
            display_name=identity.display_name,
            email=identity.email,
            auth_provider="ldap",
            ldap_dn=identity.dn,
        )
        db.add(user)
        db.flush()
    user.roles.clear()
    db.flush()
    for role_name in identity.roles:
        db.add(UserRole(user_id=user.id, role_id=_role(db, role_name).id))
    db.commit()
    db.refresh(user)
    return user


def _read_refresh_token(request: Request, payload: RefreshRequest) -> str:
    cookie_token = request.cookies.get(settings.refresh_cookie_name, "").strip()
    if cookie_token:
        return cookie_token
    body_token = (payload.refresh_token or "").strip()
    if body_token:
        return body_token
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Erişim reddedildi — Medarix oturum yenileme belirteci gerekir",
    )


def _issue_session(
    response: Response,
    user: User,
    system_settings: dict[str, str],
) -> TokenResponse:
    session_minutes = _session_minutes(system_settings)
    refresh_days = _refresh_token_days(system_settings)
    roles = user_role_slugs(user)
    access_token = create_access_token(user.username, roles, {"uid": str(user.id)}, expires_minutes=session_minutes)
    refresh_token, jti = create_refresh_token(user.username, {"uid": str(user.id)}, expires_days=refresh_days)
    store_refresh_jti(user.username, jti, refresh_days * 86400)
    set_refresh_cookie(response, refresh_token, max_age_seconds=refresh_days * 86400)
    return TokenResponse(
        access_token=access_token,
        expires_in=session_minutes * 60,
    )


def _validate_refresh_payload(token_payload: dict) -> tuple[str, str]:
    username = token_payload.get("sub")
    jti = token_payload.get("jti")
    if not username or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Erişim reddedildi — geçersiz Medarix oturum yenileme belirteci",
        )
    if not is_refresh_active(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Erişim reddedildi — oturum sonlandırılmış veya süresi dolmuş",
        )
    return username, jti


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    check_login_rate(request, payload.username, limit=settings.login_rate_limit_per_minute)
    if settings.allow_bootstrap_admin:
        _ensure_default_admin(db)

    system_settings = get_settings_map(db)
    user = _upsert_ldap_user(db, payload, system_settings)
    if not user:
        user = db.scalar(
            select(User)
            .where(User.username == payload.username, User.is_active.is_(True))
            .options(selectinload(User.roles).selectinload(UserRole.role))
        )
        if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
            record_audit_event(
                db,
                request=request,
                action="auth.login_failed",
                resource_type="user",
                resource_id=payload.username,
                metadata={"provider": "ldap" if system_settings.get("auth.ldap_enabled") == "true" else "local"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Erişim reddedildi — Medarix kimlik doğrulaması gerekir",
            )

    record_audit_event(db, request=request, action="auth.login", resource_type="user", resource_id=user.id, actor=user)
    return _issue_session(response, user, system_settings)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    request: Request,
    response: Response,
    payload: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    check_refresh_rate(request, limit=settings.refresh_rate_limit_per_minute)
    raw_token = _read_refresh_token(request, payload)
    try:
        token_payload = decode_refresh_token(raw_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Erişim reddedildi — geçersiz Medarix oturum yenileme belirteci",
        ) from exc

    username, old_jti = _validate_refresh_payload(token_payload)
    user = db.scalar(
        select(User)
        .where(User.username == username, User.is_active.is_(True))
        .options(selectinload(User.roles).selectinload(UserRole.role))
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Erişim reddedildi — Medarix kullanıcısı bulunamadı",
        )

    revoke_refresh_jti(old_jti)
    system_settings = get_settings_map(db)
    return _issue_session(response, user, system_settings)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    payload: RefreshRequest | None = None,
) -> None:
    body = payload or RefreshRequest()
    try:
        raw_token = _read_refresh_token(request, body)
        token_payload = decode_refresh_token(raw_token)
        jti = token_payload.get("jti")
        if jti:
            revoke_refresh_jti(jti)
    except HTTPException:
        pass
    except ValueError:
        pass

    clear_refresh_cookie(response)

    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        access_payload = None
        try:
            access_payload = decode_access_token(authorization[7:].strip())
        except ValueError:
            pass
        if access_payload:
            username = access_payload.get("sub")
            user = db.scalar(select(User).where(User.username == username, User.is_active.is_(True)))
            if user:
                record_audit_event(
                    db,
                    request=request,
                    action="auth.logout",
                    resource_type="user",
                    resource_id=user.id,
                    actor=user,
                )


def _user_response(user: User) -> UserOut:
    perms = sorted(permissions_for_user(user))
    if "*" in perms:
        perms = ["*"]
    return UserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        roles=user_role_slugs(user),
        permissions=perms,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserOut:
    return _user_response(current_user)


@router.put("/me", response_model=UserOut)
def update_me(
    request: Request,
    payload: UserProfileUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserOut:
    display_name = payload.display_name.strip()
    email = payload.email.strip() if payload.email else None
    if not display_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Display name is required")

    changed_fields = []
    if current_user.display_name != display_name:
        changed_fields.append("display_name")
    if current_user.email != email:
        changed_fields.append("email")

    current_user.display_name = display_name
    current_user.email = email
    db.commit()
    db.refresh(current_user)
    record_audit_event(
        db,
        request=request,
        action="auth.profile_update",
        resource_type="user",
        resource_id=current_user.id,
        actor=current_user,
        metadata={"changed_fields": changed_fields},
    )
    return _user_response(current_user)
