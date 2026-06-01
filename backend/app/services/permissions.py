"""Permission catalog and built-in role presets for Medarix RBAC."""

from __future__ import annotations

from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Role


class PermissionDef(TypedDict):
    key: str
    label: str
    description: str


class PermissionGroupDef(TypedDict):
    key: str
    label: str
    permissions: list[PermissionDef]


# Built-in role slugs (stable identifiers).
BUILTIN_ADMIN = "admin"
BUILTIN_RADIOLOGIST = "radiologist"
BUILTIN_REPORTER = "reporter"
BUILTIN_VIEWER = "viewer"
BUILTIN_TECHNICIAN = "technician"
BUILTIN_EXTERNAL = "external_consultant"

ALL_PERMISSION_KEYS: list[str] = []


def _perm(key: str, label: str, description: str) -> PermissionDef:
    ALL_PERMISSION_KEYS.append(key)
    return {"key": key, "label": label, "description": description}


PERMISSION_GROUPS: list[PermissionGroupDef] = [
    {
        "key": "clinical",
        "label": "Klinik",
        "permissions": [
            _perm("study:read", "Çalışma listesi", "Worklist ve hasta/çalışma arama"),
            _perm("image:view", "Görüntüleme", "DICOM görüntüleyici ve proxy erişimi"),
            _perm("pacs:query", "PACS sorgu", "Uzak PACS sorgulama"),
            _perm("pacs:retrieve", "PACS çekme", "Çalışma/seri retrieve"),
        ],
    },
    {
        "key": "reports",
        "label": "Raporlama",
        "permissions": [
            _perm("report:read", "Rapor okuma", "Rapor ve sürüm görüntüleme"),
            _perm("report:write", "Rapor yazma", "Rapor oluşturma ve düzenleme"),
            _perm("report:sign", "Rapor imzalama", "Nihai imza ve PACS gönderimi"),
            _perm("report:delete", "Rapor silme", "Rapor/şablon silme işlemleri"),
            _perm("template:write", "Şablon yazma", "Rapor şablonu oluşturma/düzenleme"),
            _perm("recording:read", "Kayıt okuma", "Dikte kayıtlarını listeleme"),
            _perm("recording:write", "Kayıt yazma", "Ses yükleme ve transkripsiyon"),
        ],
    },
    {
        "key": "ai",
        "label": "Yapay zeka",
        "permissions": [
            _perm("ai:use", "AI kullanımı", "Asistan, öneri ve formatlama"),
            _perm("analytics:view", "Analitik", "Enterprise analitik panelleri"),
        ],
    },
    {
        "key": "admin",
        "label": "Yönetim",
        "permissions": [
            _perm("admin:access", "Yönetim paneli", "Admin arayüzüne giriş"),
            _perm("admin:users", "Kullanıcı yönetimi", "Kullanıcı oluşturma ve düzenleme"),
            _perm("admin:users:delete", "Kullanıcı silme", "Kullanıcı hesabı silme"),
            _perm("admin:groups", "Grup yönetimi", "Grup oluşturma"),
            _perm("admin:groups:delete", "Grup silme", "Grup silme"),
            _perm("admin:roles", "Rol yönetimi", "Özel rol oluşturma ve yetki düzenleme"),
            _perm("admin:roles:delete", "Rol silme", "Özel rol silme"),
            _perm("admin:settings", "Sistem ayarları", "Modül ve güvenlik ayarları"),
            _perm("admin:license", "Lisans", "Lisans etkinleştirme"),
            _perm("admin:audit", "Denetim", "Denetim kayıtları görüntüleme"),
        ],
    },
]

VALID_PERMISSIONS: frozenset[str] = frozenset(ALL_PERMISSION_KEYS)

# Viewer: read-only clinical surface.
_VIEWER = frozenset(
    {
        "study:read",
        "image:view",
        "report:read",
        "recording:read",
    }
)

# Raportör: view + write reports/recordings/templates; no delete, sign, or admin.
_REPORTER = _VIEWER | frozenset(
    {
        "report:write",
        "template:write",
        "recording:write",
        "ai:use",
    }
)

# Radyolog: reporter + sign, analytics, PACS query, limited delete (templates).
_RADIOLOGIST = _REPORTER | frozenset(
    {
        "report:sign",
        "report:delete",
        "pacs:query",
        "analytics:view",
    }
)

# Teknisyen: PACS operations + read (legacy; no report write).
_TECHNICIAN = _VIEWER | frozenset({"pacs:query", "pacs:retrieve"})

_EXTERNAL = _VIEWER

_ADMIN = frozenset({"*"})

BUILTIN_ROLE_PRESETS: dict[str, dict] = {
    BUILTIN_VIEWER: {"label": "Görüntüleyici", "description": "Salt okunur; değişiklik yapamaz.", "permissions": sorted(_VIEWER)},
    BUILTIN_REPORTER: {
        "label": "Raportör",
        "description": "Rapor ve dikte oluşturabilir; silme ve imza yapamaz.",
        "permissions": sorted(_REPORTER),
    },
    BUILTIN_RADIOLOGIST: {
        "label": "Radyolog",
        "description": "Tam raporlama, imza ve analitik; yönetim yok.",
        "permissions": sorted(_RADIOLOGIST),
    },
    BUILTIN_ADMIN: {"label": "Admin", "description": "Tüm yetkiler.", "permissions": ["*"]},
    BUILTIN_TECHNICIAN: {
        "label": "Teknisyen",
        "description": "PACS sorgu/çekme ve görüntüleme.",
        "permissions": sorted(_TECHNICIAN),
    },
    BUILTIN_EXTERNAL: {
        "label": "Dış Konsültan",
        "description": "Salt okunur dış erişim.",
        "permissions": sorted(_EXTERNAL),
    },
}


def permission_catalog() -> list[dict]:
    return PERMISSION_GROUPS


def normalize_permissions(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        key = str(item).strip()
        if not key or key in seen:
            continue
        if key == "*":
            return ["*"]
        if key in VALID_PERMISSIONS:
            seen.add(key)
            out.append(key)
    return sorted(out)


def expand_permissions(permissions: list[str]) -> set[str]:
    if "*" in permissions:
        return {"*"}
    expanded: set[str] = set(permissions)
    if "admin:access" not in expanded:
        for key in list(expanded):
            if key.startswith("admin:"):
                expanded.add("admin:access")
                break
    # Legacy alias: report:create/update -> report:write
    if "report:create" in expanded or "report:update" in expanded:
        expanded.add("report:write")
    return expanded


def ensure_builtin_roles(db: Session) -> None:
    """Upsert built-in roles and refresh their permission sets."""
    for slug, preset in BUILTIN_ROLE_PRESETS.items():
        role = db.scalar(select(Role).where(Role.slug == slug))
        perms = normalize_permissions(preset["permissions"])
        if not role:
            role = Role(
                slug=slug,
                name=slug,
                label=preset["label"],
                description=preset.get("description"),
                is_builtin=True,
                permissions=perms,
            )
            db.add(role)
            continue
        role.name = slug
        role.label = preset["label"]
        role.description = preset.get("description")
        role.is_builtin = True
        role.permissions = perms
    db.commit()


def slugify_role_name(name: str) -> str:
    base = "".join(ch if ch.isalnum() else "_" for ch in name.strip().lower())
    base = "_".join(part for part in base.split("_") if part)
    return (base[:48] or "rol")
