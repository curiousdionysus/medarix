from dataclasses import dataclass

from ldap3 import ALL, Connection, Server
from ldap3.utils.conv import escape_filter_chars

from app.models import RoleName


@dataclass(frozen=True)
class LdapIdentity:
    username: str
    display_name: str | None
    email: str | None
    dn: str
    roles: list[RoleName]


LDAP_SETTING_KEYS = (
    "auth.ldap_enabled",
    "auth.ldap_server_uri",
    "auth.ldap_bind_dn",
    "auth.ldap_bind_password",
    "auth.ldap_user_search_base",
    "auth.ldap_user_filter",
    "auth.ldap_group_attribute",
)


GROUP_ROLE_MAP = {
    "CN=Radiology-Radiologists": RoleName.radiologist,
    "CN=Radiology-Reporters": RoleName.reporter,
    "CN=Radiology-Technicians": RoleName.technician,
    "CN=Radiology-Admins": RoleName.admin,
    "CN=Radiology-Viewers": RoleName.viewer,
    "CN=Radiology-External": RoleName.external_consultant,
}


def authenticate_ldap(username: str, password: str, system_settings: dict[str, str]) -> LdapIdentity | None:
    if system_settings.get("auth.ldap_enabled", "false").lower() != "true":
        return None

    server = Server(system_settings["auth.ldap_server_uri"], get_info=ALL)
    with Connection(
        server,
        user=system_settings["auth.ldap_bind_dn"],
        password=system_settings["auth.ldap_bind_password"],
        auto_bind=True,
    ) as conn:
        safe_username = escape_filter_chars(username)
        search_filter = system_settings["auth.ldap_user_filter"].format(username=safe_username)
        conn.search(
            search_base=system_settings["auth.ldap_user_search_base"],
            search_filter=search_filter,
            attributes=["displayName", "mail", "memberOf"],
            size_limit=1,
        )
        if not conn.entries:
            return None

        entry = conn.entries[0]
        user_dn = entry.entry_dn

    user_conn = Connection(server, user=user_dn, password=password, auto_bind=False)
    if not user_conn.bind():
        return None
    user_conn.unbind()

    groups = [str(group) for group in getattr(entry, "memberOf", [])]
    roles = [
        role
        for group in groups
        for group_prefix, role in GROUP_ROLE_MAP.items()
        if group.startswith(group_prefix)
    ]
    if not roles:
        roles = [RoleName.viewer]

    return LdapIdentity(
        username=username,
        display_name=str(getattr(entry, "displayName", "") or username),
        email=str(getattr(entry, "mail", "") or ""),
        dn=user_dn,
        roles=roles,
    )


def verify_ldap_configuration(
    system_settings: dict[str, str],
    *,
    test_username: str | None = None,
    test_password: str | None = None,
) -> dict:
    """Validate LDAP settings (bind + search base); optionally test end-user credentials."""
    checks: list[dict] = []

    if system_settings.get("auth.ldap_enabled", "false").lower() != "true":
        return {
            "ok": True,
            "mode": "local",
            "message": "LDAP kapalı; yerel kullanıcı hesapları ile kimlik doğrulama kullanılıyor.",
            "checks": checks,
        }

    required = {
        "auth.ldap_server_uri": "LDAP sunucu URI",
        "auth.ldap_bind_dn": "LDAP bind DN",
        "auth.ldap_bind_password": "LDAP bind şifresi",
        "auth.ldap_user_search_base": "Kullanıcı arama tabanı",
        "auth.ldap_user_filter": "Kullanıcı arama filtresi",
    }
    missing = [label for key, label in required.items() if not str(system_settings.get(key, "")).strip()]
    if missing:
        return {
            "ok": False,
            "mode": "ldap",
            "message": f"Eksik alanlar: {', '.join(missing)}",
            "checks": checks,
        }

    server_uri = system_settings["auth.ldap_server_uri"].strip()
    bind_dn = system_settings["auth.ldap_bind_dn"].strip()
    bind_password = system_settings["auth.ldap_bind_password"]
    search_base = system_settings["auth.ldap_user_search_base"].strip()
    user_filter_template = system_settings["auth.ldap_user_filter"].strip()

    try:
        server = Server(server_uri, get_info=ALL)
        conn = Connection(server, user=bind_dn, password=bind_password, auto_bind=True)
        checks.append({"id": "bind", "label": "Servis hesabı (bind)", "ok": True, "detail": server_uri})
        conn.unbind()
    except Exception as exc:  # noqa: BLE001
        checks.append({"id": "bind", "label": "Servis hesabı (bind)", "ok": False, "detail": str(exc)})
        return {
            "ok": False,
            "mode": "ldap",
            "message": "LDAP sunucusuna servis hesabı ile bağlanılamadı.",
            "checks": checks,
        }

    try:
        with Connection(server, user=bind_dn, password=bind_password, auto_bind=True) as conn:
            conn.search(
                search_base=search_base,
                search_filter="(objectClass=user)",
                attributes=["cn"],
                size_limit=1,
            )
            count = len(conn.entries)
            checks.append(
                {
                    "id": "search_base",
                    "label": "Kullanıcı arama tabanı",
                    "ok": True,
                    "detail": f"Arama başarılı ({count} örnek kayıt)",
                }
            )
    except Exception as exc:  # noqa: BLE001
        checks.append({"id": "search_base", "label": "Kullanıcı arama tabanı", "ok": False, "detail": str(exc)})
        return {
            "ok": False,
            "mode": "ldap",
            "message": "Kullanıcı arama tabanı veya filtresi doğrulanamadı.",
            "checks": checks,
        }

    if "{username}" not in user_filter_template:
        checks.append(
            {
                "id": "user_filter",
                "label": "Kullanıcı arama filtresi",
                "ok": False,
                "detail": "Filtre {username} yer tutucusunu içermeli",
            }
        )
        return {
            "ok": False,
            "mode": "ldap",
            "message": "Kullanıcı arama filtresi geçersiz.",
            "checks": checks,
        }
    checks.append({"id": "user_filter", "label": "Kullanıcı arama filtresi", "ok": True, "detail": user_filter_template})

    username = (test_username or "").strip()
    password = test_password or ""
    if username:
        if not password:
            checks.append(
                {
                    "id": "user_login",
                    "label": "Test kullanıcı girişi",
                    "ok": False,
                    "detail": "Test için parola gerekli",
                }
            )
            return {
                "ok": False,
                "mode": "ldap",
                "message": "Test kullanıcısı için parola girin.",
                "checks": checks,
            }
        identity = authenticate_ldap(username, password, system_settings)
        if identity:
            checks.append(
                {
                    "id": "user_login",
                    "label": "Test kullanıcı girişi",
                    "ok": True,
                    "detail": f"{identity.username} — roller: {', '.join(r.value for r in identity.roles)}",
                }
            )
            message = f"LDAP yapılandırması doğrulandı; '{identity.username}' girişi başarılı."
        else:
            checks.append(
                {
                    "id": "user_login",
                    "label": "Test kullanıcı girişi",
                    "ok": False,
                    "detail": "Kullanıcı bulunamadı veya parola hatalı",
                }
            )
            return {
                "ok": False,
                "mode": "ldap",
                "message": "Test kullanıcısı ile giriş doğrulanamadı.",
                "checks": checks,
            }
    else:
        message = "LDAP bağlantı ayarları doğrulandı. Tam giriş testi için test kullanıcı adı girin."

    return {"ok": True, "mode": "ldap", "message": message, "checks": checks}
