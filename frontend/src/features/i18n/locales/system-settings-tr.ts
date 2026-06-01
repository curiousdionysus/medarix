/** Labels/descriptions for /admin/settings (API returns Turkish; UI uses these by setting key). */
export const systemSettings = {
  ai_enabled: {
    label: "Yapay zeka servisleri etkin",
    desc: "Kapalıyken transkripsiyon, rapor düzenleme ve AI asistan devre dışı kalır.",
  },
  ai_text_base_url: {
    label: "Dil modeli sunucusu",
    desc: "Ollama veya OpenAI uyumlu LLM endpoint (ör. http://ollama:11434/v1).",
  },
  ai_text_model: {
    label: "Dil modeli",
    desc: "Sunucuda yüklü model adı. Listele ile mevcut modelleri sorgulayın.",
  },
  ai_transcription_base_url: {
    label: "Transkripsiyon sunucusu",
    desc: "Whisper/faster-whisper OpenAI uyumlu endpoint (ör. http://whisper:8000/v1).",
  },
  ai_transcription_model: {
    label: "Transkripsiyon modeli",
    desc: "Sunucuda yüklü model adı. Listele ile mevcut modelleri sorgulayın.",
  },
  ai_transcription_language: {
    label: "Transkripsiyon dili",
    desc: "Whisper dili. Türkçe için tr kullanın; otomatik algılama yanlış alfabe üretebilir.",
  },
  pacs_enabled: {
    label: "PACS entegrasyonu etkin",
    desc: "Kapalıyken PACS sorgu, çekme ve rapor gönderimi devre dışı kalır.",
  },
  pacs_ae_title: {
    label: "Yerel AE başlığı",
    desc: "DICOM geçidi tarafından kullanılan AE başlığı.",
  },
  pacs_host: {
    label: "PACS sunucusu",
    desc: "Harici PACS ana makine adı veya IP adresi.",
  },
  pacs_port: {
    label: "PACS portu",
    desc: "DICOM association portu.",
  },
  pacs_called_ae_title: {
    label: "Çağrılan AE başlığı",
    desc: "Harici PACS sisteminin AE başlığı.",
  },
  pacs_dicomweb_base_url: {
    label: "DICOMweb temel URL",
    desc: "Web görüntüleyici için WADO-RS/QIDO-RS/STOW-RS endpoint'i.",
  },
  auth_ldap_enabled: {
    label: "LDAP etkin",
    desc: "LDAP/Active Directory kimlik doğrulamasını etkinleştir.",
  },
  auth_ldap_server_uri: {
    label: "LDAP sunucu URI",
    desc: "Active Directory için LDAP veya LDAPS URI.",
  },
  auth_ldap_bind_dn: {
    label: "LDAP bind DN",
    desc: "Kullanıcı araması için servis hesabı DN değeri.",
  },
  auth_ldap_bind_password: {
    label: "LDAP bind şifresi",
    desc: "Servis hesabı şifresi. Üretimde Vault ile saklayın.",
  },
  auth_ldap_user_search_base: {
    label: "Kullanıcı arama tabanı",
    desc: "Kullanıcı araması için LDAP OU/DC yolu.",
  },
  auth_ldap_user_filter: {
    label: "Kullanıcı arama filtresi",
    desc: "LDAP filtresi. {username} yer tutucusunu kullanın.",
  },
  auth_ldap_group_attribute: {
    label: "LDAP grup attribute",
    desc: "Kullanıcının grup üyeliklerini okumak için LDAP attribute adı.",
  },
  security_session_minutes: {
    label: "Oturum süresi (dakika)",
    desc: "JWT erişim token süresi.",
  },
  security_refresh_token_days: {
    label: "Yenileme token süresi (gün)",
    desc: "Oturum yenileme token'ının geçerlilik süresi.",
  },
  security_audit_retention_days: {
    label: "Denetim saklama (gün)",
    desc: "Klinik denetim olayları için hedef saklama süresi.",
  },
  security_patient_data_key: {
    label: "Hasta verisi şifreleme anahtarı",
    desc: "Boş bırakılırsa audit HMAC secret türetilmiş anahtar kullanılır.",
  },
  storage_recording_retention_days: {
    label: "Ses ve rapor saklama günü",
    desc: "Veritabanında tutulacak ses dosyası ve yapılandırılmış rapor kayıtlarının saklama süresi (gün).",
  },
} as const;
