"""Kurumsal kimlik (branding) system_settings anahtarları ve public API yükü."""

from __future__ import annotations

from app.services.setting_definitions import SettingDefinition

BRANDING_CATEGORY = "Kurumsal Kimlik"

# Public GET /branding yanıtında dönen alanlar
PUBLIC_BRANDING_KEYS = (
    "branding.org_name",
    "branding.product_title",
    "branding.product_subtitle",
    "branding.browser_title",
    "branding.primary_color",
    "branding.accent_color",
    "branding.sidebar_background",
    "branding.sidebar_accent",
    "branding.primary_foreground",
    "branding.accent_foreground",
    "branding.secondary_foreground",
    "branding.logo_url",
    "branding.logo_dark_url",
    "branding.favicon_url",
    "branding.login_headline",
    "branding.login_tagline",
    "branding.footer_text",
    "branding.support_email",
    "branding.support_phone",
    "branding.font_family",
)

MAX_LOGO_DATA_URL_LEN = 600_000

BRANDING_DEFAULTS: dict[str, str] = {
    "branding.org_name": "",
    "branding.product_title": "Medarix",
    "branding.product_subtitle": "Radyoloji Platformu",
    "branding.browser_title": "Medarix",
    "branding.primary_color": "#1d6fd8",
    "branding.accent_color": "#1fa89a",
    "branding.sidebar_background": "#0f1729",
    "branding.sidebar_accent": "#2b7de9",
    "branding.primary_foreground": "#f8fafc",
    "branding.accent_foreground": "#ffffff",
    "branding.secondary_foreground": "#1e293b",
    "branding.logo_url": "",
    "branding.logo_dark_url": "",
    "branding.favicon_url": "",
    "branding.login_headline": "Yapay zeka destekli radyoloji raporlama",
    "branding.login_tagline": "Dikte, transkripsiyon ve yapılandırılmış raporlama tek platformda.",
    "branding.footer_text": "",
    "branding.support_email": "",
    "branding.support_phone": "",
    "branding.font_family": '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
}

BRANDING_DEFINITIONS: list[SettingDefinition] = [
    SettingDefinition(
        "branding.org_name",
        BRANDING_DEFAULTS["branding.org_name"],
        BRANDING_CATEGORY,
        "Kurum adı",
        "Hastane veya kuruluş adı; giriş paneli ve alt bilgide görünür.",
    ),
    SettingDefinition(
        "branding.product_title",
        BRANDING_DEFAULTS["branding.product_title"],
        BRANDING_CATEGORY,
        "Ürün başlığı",
        "Kenar çubuğu ve giriş ekranındaki ana başlık.",
    ),
    SettingDefinition(
        "branding.product_subtitle",
        BRANDING_DEFAULTS["branding.product_subtitle"],
        BRANDING_CATEGORY,
        "Ürün alt başlığı",
        "Başlığın altındaki kısa açıklama.",
    ),
    SettingDefinition(
        "branding.browser_title",
        BRANDING_DEFAULTS["branding.browser_title"],
        BRANDING_CATEGORY,
        "Tarayıcı sekmesi başlığı",
        "Sekme başlığı; boşsa ürün başlığı kullanılır.",
    ),
    SettingDefinition(
        "branding.primary_color",
        BRANDING_DEFAULTS["branding.primary_color"],
        BRANDING_CATEGORY,
        "Ana renk",
        "Hex renk (#2563eb). Düğmeler ve vurgular.",
    ),
    SettingDefinition(
        "branding.accent_color",
        BRANDING_DEFAULTS["branding.accent_color"],
        BRANDING_CATEGORY,
        "Vurgu rengi",
        "Hex renk. İkincil vurgu ve gradyanlar.",
    ),
    SettingDefinition(
        "branding.sidebar_background",
        BRANDING_DEFAULTS["branding.sidebar_background"],
        BRANDING_CATEGORY,
        "Kenar çubuğu arka planı",
        "Hex renk. Sol menü arka planı.",
    ),
    SettingDefinition(
        "branding.sidebar_accent",
        BRANDING_DEFAULTS["branding.sidebar_accent"],
        BRANDING_CATEGORY,
        "Kenar çubuğu vurgu",
        "Hex renk. Logo kutusu ve aktif öğeler.",
    ),
    SettingDefinition(
        "branding.primary_foreground",
        BRANDING_DEFAULTS["branding.primary_foreground"],
        BRANDING_CATEGORY,
        "Ana düğme yazı rengi",
        "Birincil (primary) düğmelerdeki metin rengi.",
    ),
    SettingDefinition(
        "branding.accent_foreground",
        BRANDING_DEFAULTS["branding.accent_foreground"],
        BRANDING_CATEGORY,
        "Vurgu düğme yazı rengi",
        "Vurgu (accent) düğmelerdeki metin rengi.",
    ),
    SettingDefinition(
        "branding.secondary_foreground",
        BRANDING_DEFAULTS["branding.secondary_foreground"],
        BRANDING_CATEGORY,
        "İkincil düğme yazı rengi",
        "İkincil / outline düğmelerdeki metin rengi.",
    ),
    SettingDefinition(
        "branding.logo_url",
        BRANDING_DEFAULTS["branding.logo_url"],
        BRANDING_CATEGORY,
        "Logo (URL veya dosya)",
        "HTTPS URL veya yüklenen PNG/SVG (data URL). Boşsa varsayılan simge.",
    ),
    SettingDefinition(
        "branding.logo_dark_url",
        BRANDING_DEFAULTS["branding.logo_dark_url"],
        BRANDING_CATEGORY,
        "Logo (açık tema)",
        "Açık arka planda kullanılacak alternatif logo; isteğe bağlı.",
    ),
    SettingDefinition(
        "branding.favicon_url",
        BRANDING_DEFAULTS["branding.favicon_url"],
        BRANDING_CATEGORY,
        "Favicon",
        "Sekme simgesi URL veya data URL (.ico/.png).",
    ),
    SettingDefinition(
        "branding.login_headline",
        BRANDING_DEFAULTS["branding.login_headline"],
        BRANDING_CATEGORY,
        "Giriş başlığı",
        "Giriş sayfası sol paneldeki ana metin.",
    ),
    SettingDefinition(
        "branding.login_tagline",
        BRANDING_DEFAULTS["branding.login_tagline"],
        BRANDING_CATEGORY,
        "Giriş alt metni",
        "Giriş paneli açıklama paragrafı.",
    ),
    SettingDefinition(
        "branding.footer_text",
        BRANDING_DEFAULTS["branding.footer_text"],
        BRANDING_CATEGORY,
        "Alt bilgi metni",
        "Giriş veya uygulama altında görünen telif / kurum notu.",
    ),
    SettingDefinition(
        "branding.support_email",
        BRANDING_DEFAULTS["branding.support_email"],
        BRANDING_CATEGORY,
        "Destek e-postası",
        "İsteğe bağlı iletişim.",
    ),
    SettingDefinition(
        "branding.support_phone",
        BRANDING_DEFAULTS["branding.support_phone"],
        BRANDING_CATEGORY,
        "Destek telefonu",
        "İsteğe bağlı iletişim.",
    ),
    SettingDefinition(
        "branding.font_family",
        BRANDING_DEFAULTS["branding.font_family"],
        BRANDING_CATEGORY,
        "Yazı tipi",
        "Kurumsal arayüz yazı tipi (varsayılan: Plus Jakarta Sans).",
    ),
]


def validate_branding_updates(updates: dict[str, str]) -> None:
    for key, value in updates.items():
        if not key.startswith("branding."):
            continue
        if key in ("branding.logo_url", "branding.logo_dark_url", "branding.favicon_url"):
            if len(value) > MAX_LOGO_DATA_URL_LEN:
                raise ValueError(f"{key} çok büyük (maks. ~{MAX_LOGO_DATA_URL_LEN // 1000} KB)")


def build_public_branding(settings: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for key in PUBLIC_BRANDING_KEYS:
        raw = settings.get(key, BRANDING_DEFAULTS.get(key, ""))
        out[key.removeprefix("branding.")] = (raw or BRANDING_DEFAULTS.get(key, "")).strip()
    title = out.get("browser_title") or out.get("product_title") or "Medarix"
    org = out.get("org_name", "")
    if org and org not in title:
        out["document_title"] = f"{title} | {org}" if title else org
    else:
        out["document_title"] = title or "Medarix"
    return out
