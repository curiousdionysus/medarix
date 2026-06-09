from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import SystemSetting
from app.services.branding import BRANDING_DEFINITIONS, validate_branding_updates
from app.services.setting_definitions import SettingDefinition


settings = get_settings()


DEFAULT_SETTINGS = [
    SettingDefinition("ai.enabled", "true", "Yapay Zeka Servisleri", "Yapay zeka modülü etkin", "Kapalıyken transkripsiyon, rapor yapılandırma, AI asistan ve kalite denetimi devre dışı kalır."),
    SettingDefinition(
        "ai.text_base_url",
        settings.ollama_base_url,
        "Yapay Zeka Servisleri",
        "Dil modeli sunucusu",
        "Ollama veya OpenAI uyumlu LLM endpoint (ör. http://ollama:11434/v1).",
    ),
    SettingDefinition(
        "ai.text_model",
        settings.ollama_model,
        "Yapay Zeka Servisleri",
        "Dil modeli",
        "Sunucuda yüklü model adı. Listele ile mevcut modelleri sorgulayın.",
    ),
    SettingDefinition(
        "ai.transcription_base_url",
        settings.whisper_base_url,
        "Yapay Zeka Servisleri",
        "Transkripsiyon sunucusu",
        "Whisper/faster-whisper OpenAI uyumlu endpoint (ör. http://whisper:8000/v1).",
    ),
    SettingDefinition(
        "ai.transcription_model",
        settings.whisper_model,
        "Yapay Zeka Servisleri",
        "Transkripsiyon modeli",
        "Sunucuda yüklü model adı. Listele ile mevcut modelleri sorgulayın.",
    ),
    SettingDefinition("ai.transcription_language", "tr", "Yapay Zeka Servisleri", "Transkripsiyon dili", "Whisper dili. Türkçe için tr kullanın; otomatik algılama yanlış alfabe üretebilir."),
    SettingDefinition(
        "qa.enabled",
        "false",
        "Yapay Zeka Servisleri",
        "Rapor kalite denetimi (QA)",
        "Açıkken yapılandırılmış raporlar transkript ile karşılaştırılır; skor ve uyarılar üretilir.",
    ),
    SettingDefinition(
        "qa.secondary_review_enabled",
        "false",
        "Yapay Zeka Servisleri",
        "İkincil AI denetçi",
        "İkinci bir dil modeli halüsinasyon ve eksiklik denetimi yapar (birincil modelden bağımsız).",
    ),
    SettingDefinition(
        "qa.traceability_enabled",
        "true",
        "Yapay Zeka Servisleri",
        "Cümle izlenebilirliği",
        "Her rapor cümlesini transkriptteki kaynak cümleyle eşleştirir.",
    ),
    SettingDefinition(
        "qa.review_model",
        "",
        "Yapay Zeka Servisleri",
        "Denetçi modeli",
        "İkincil denetçi için model adı. Boş bırakılırsa birincil dil modeli kullanılır.",
    ),
    SettingDefinition("pacs.enabled", "true", "PACS / DICOM", "PACS entegrasyonu etkin", "Kapalıyken PACS sorgu, çekme ve rapor gönderimi devre dışı kalır."),
    SettingDefinition("pacs.ae_title", settings.pacs_ae_title, "PACS / DICOM", "Yerel AE başlığı", "DICOM geçidi tarafından kullanılan AE başlığı."),
    SettingDefinition("pacs.host", settings.pacs_host, "PACS / DICOM", "PACS sunucusu", "Harici PACS ana makine adı veya IP adresi."),
    SettingDefinition("pacs.port", str(settings.pacs_port), "PACS / DICOM", "PACS portu", "DICOM association portu."),
    SettingDefinition("pacs.called_ae_title", settings.pacs_called_ae_title, "PACS / DICOM", "Çağrılan AE başlığı", "Harici PACS sisteminin AE başlığı."),
    SettingDefinition("pacs.dicomweb_base_url", settings.dicomweb_base_url, "PACS / DICOM", "DICOMweb temel URL", "Web görüntüleyici için WADO-RS/QIDO-RS/STOW-RS endpoint'i."),
    SettingDefinition("pacs.mwl_auto_sync", "true", "PACS / DICOM", "İş listesi otomatik senkron", "İş listesi açıldığında PACS'ten Q/R sorgusu çalışır."),
    SettingDefinition("pacs.mwl_sync_days", "7", "PACS / DICOM", "Q/R tarih penceresi (gün)", "Bugünden geriye ve ileriye kaç gün C-FIND sorgulanır."),
    SettingDefinition("pacs.query_sync_days", "7", "PACS / DICOM", "Q/R tarih penceresi (gün)", "Study Root C-FIND için tarih aralığı."),
    SettingDefinition("pacs.move_destination_ae", settings.pacs_ae_title, "PACS / DICOM", "C-MOVE hedef AE", "Retrieve (C-MOVE) ile görüntülerin gönderileceği AE başlığı (ör. Orthanc)."),
    SettingDefinition(
        "pacs.web_viewer_url_template",
        "",
        "PACS / DICOM",
        "PACS web görüntüleyici URL şablonu",
        "İş listesinden accession ile açılır. Yer tutucular: {accession}, {study_instance_uid}. "
        "Örnek: https://pacs.sunucu/viewer?AccessionNumber={accession}",
    ),
    SettingDefinition("auth.ldap_enabled", str(settings.ldap_enabled).lower(), "Kimlik Doğrulama", "LDAP etkin", "LDAP/Active Directory kimlik doğrulamasını etkinleştir."),
    SettingDefinition("auth.ldap_server_uri", settings.ldap_server_uri, "Kimlik Doğrulama", "LDAP sunucu URI", "Active Directory için LDAP veya LDAPS URI."),
    SettingDefinition("auth.ldap_bind_dn", settings.ldap_bind_dn, "Kimlik Doğrulama", "LDAP bind DN", "Kullanıcı araması için servis hesabı DN değeri."),
    SettingDefinition("auth.ldap_bind_password", settings.ldap_bind_password, "Kimlik Doğrulama", "LDAP bind şifresi", "Servis hesabı şifresi. Üretimde Vault ile saklayın.", True),
    SettingDefinition("auth.ldap_user_search_base", settings.ldap_user_search_base, "Kimlik Doğrulama", "Kullanıcı arama tabanı", "Kullanıcı araması için LDAP OU/DC yolu."),
    SettingDefinition("auth.ldap_user_filter", settings.ldap_user_filter, "Kimlik Doğrulama", "Kullanıcı arama filtresi", "LDAP filtresi. {username} yer tutucusunu kullanın."),
    SettingDefinition("security.session_minutes", str(settings.access_token_minutes), "Güvenlik", "Oturum süresi (dakika)", "JWT erişim token süresi."),
    SettingDefinition("security.refresh_token_days", str(settings.refresh_token_days), "Güvenlik", "Yenileme token süresi (gün)", "Oturum yenileme token'ının geçerlilik süresi."),
    SettingDefinition("security.audit_retention_days", "2555", "Güvenlik", "Denetim saklama (gün)", "Klinik denetim olayları için hedef saklama süresi."),
    SettingDefinition("security.patient_data_key", "", "Güvenlik", "Hasta verisi şifreleme anahtarı", "Boş bırakılırsa audit HMAC secret türetilmiş anahtar kullanılır.", True),
    SettingDefinition("auth.ldap_group_attribute", settings.ldap_group_attribute, "Kimlik Doğrulama", "LDAP grup attribute", "Kullanıcının grup üyeliklerini okumak için LDAP attribute adı."),
    SettingDefinition("storage.recording_retention_days", "90", "Veri Saklama", "Ses ve rapor saklama günü", "Veritabanında tutulacak ses dosyası ve yapılandırılmış rapor kayıtlarının saklama süresi (gün)."),
    *BRANDING_DEFINITIONS,
]


def ensure_system_settings(db: Session) -> None:
    existing = {row.key: row for row in db.scalars(select(SystemSetting))}
    for definition in DEFAULT_SETTINGS:
        if definition.key in existing:
            row = existing[definition.key]
            row.category = definition.category
            row.label = definition.label
            row.description = definition.description
            row.is_secret = definition.is_secret
            continue
        db.add(
            SystemSetting(
                key=definition.key,
                value=definition.value,
                category=definition.category,
                label=definition.label,
                description=definition.description,
                is_secret=definition.is_secret,
            )
        )
    db.commit()


def get_settings_map(db: Session) -> dict[str, str]:
    ensure_system_settings(db)
    rows = db.scalars(select(SystemSetting))
    return {row.key: row.value for row in rows}


def get_setting(db: Session, key: str) -> str:
    values = get_settings_map(db)
    return values[key]


def is_setting_enabled(system_settings: dict[str, str], key: str, *, default: bool = True) -> bool:
    raw = system_settings.get(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("true", "1", "yes", "on")


def list_grouped_settings(db: Session) -> list[dict]:
    ensure_system_settings(db)
    rows = list(db.scalars(select(SystemSetting).order_by(SystemSetting.category, SystemSetting.key)))
    grouped: dict[str, list[SystemSetting]] = {}
    ai_order = {
        "ai.transcription_base_url": 1,
        "ai.transcription_model": 2,
        "ai.transcription_language": 3,
        "ai.text_base_url": 4,
        "ai.text_model": 5,
        "qa.enabled": 6,
        "qa.secondary_review_enabled": 7,
        "qa.review_model": 8,
        "qa.traceability_enabled": 9,
    }
    for row in rows:
        # License state is managed by the dedicated license module, not the settings editor.
        if row.key.startswith("license."):
            continue
        grouped.setdefault(row.category, []).append(row)
    for category, settings_rows in grouped.items():
        if category == "Yapay Zeka Servisleri":
            settings_rows.sort(key=lambda r: ai_order.get(r.key, 100))
    return [
        {
            "category": category,
            "settings": [
                {
                    "key": row.key,
                    "value": "********" if row.is_secret and row.value else row.value,
                    "category": row.category,
                    "label": row.label,
                    "description": row.description,
                    "is_secret": row.is_secret,
                }
                for row in settings_rows
            ],
        }
        for category, settings_rows in grouped.items()
    ]


def update_settings(db: Session, updates: dict[str, str], actor_user_id: UUID | None) -> dict[str, str]:
    ensure_system_settings(db)
    try:
        validate_branding_updates(updates)
    except ValueError as exc:
        raise KeyError(str(exc)) from exc
    known = {row.key: row for row in db.scalars(select(SystemSetting))}
    for key, value in updates.items():
        if key not in known:
            raise KeyError(key)
        if known[key].is_secret and value == "********":
            continue
        known[key].value = value
        known[key].updated_by = actor_user_id
    db.commit()
    return get_settings_map(db)
