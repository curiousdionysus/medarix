export const systemSettings = {
  ai_enabled: {
    label: "AI services enabled",
    desc: "When off, transcription, report editing, and the AI assistant are disabled.",
  },
  ai_text_base_url: {
    label: "LLM server URL",
    desc: "Ollama or OpenAI-compatible LLM endpoint (e.g. http://ollama:11434/v1).",
  },
  ai_text_model: {
    label: "LLM model",
    desc: "Model name on the server. Use List to query available models.",
  },
  ai_transcription_base_url: {
    label: "Transcription server URL",
    desc: "Whisper/faster-whisper OpenAI-compatible endpoint (e.g. http://whisper:8000/v1).",
  },
  ai_transcription_model: {
    label: "Transcription model",
    desc: "Model name on the server. Use List to query available models.",
  },
  ai_transcription_language: {
    label: "Transcription language",
    desc: "Whisper language code. Use tr for Turkish; auto-detect may produce wrong script.",
  },
  pacs_enabled: {
    label: "PACS integration enabled",
    desc: "When off, PACS query, retrieve, and report send are disabled.",
  },
  pacs_ae_title: {
    label: "Local AE title",
    desc: "AE title used by the DICOM gateway.",
  },
  pacs_host: {
    label: "PACS host",
    desc: "Remote PACS hostname or IP address.",
  },
  pacs_port: {
    label: "PACS port",
    desc: "DICOM association port.",
  },
  pacs_called_ae_title: {
    label: "Called AE title",
    desc: "AE title of the remote PACS system.",
  },
  pacs_dicomweb_base_url: {
    label: "DICOMweb base URL",
    desc: "WADO-RS/QIDO-RS/STOW-RS endpoint for the web viewer.",
  },
  auth_ldap_enabled: {
    label: "LDAP enabled",
    desc: "Enable LDAP/Active Directory authentication.",
  },
  auth_ldap_server_uri: {
    label: "LDAP server URI",
    desc: "LDAP or LDAPS URI for Active Directory.",
  },
  auth_ldap_bind_dn: {
    label: "LDAP bind DN",
    desc: "Service account DN for user search.",
  },
  auth_ldap_bind_password: {
    label: "LDAP bind password",
    desc: "Service account password. Store in Vault in production.",
  },
  auth_ldap_user_search_base: {
    label: "User search base",
    desc: "LDAP OU/DC path for user search.",
  },
  auth_ldap_user_filter: {
    label: "User search filter",
    desc: "LDAP filter. Use the {username} placeholder.",
  },
  auth_ldap_group_attribute: {
    label: "LDAP group attribute",
    desc: "LDAP attribute for reading group membership.",
  },
  security_session_minutes: {
    label: "Session length (minutes)",
    desc: "JWT access token lifetime.",
  },
  security_refresh_token_days: {
    label: "Refresh token lifetime (days)",
    desc: "Validity period for session refresh tokens.",
  },
  security_audit_retention_days: {
    label: "Audit retention (days)",
    desc: "Target retention for clinical audit events.",
  },
  security_patient_data_key: {
    label: "Patient data encryption key",
    desc: "If empty, a key derived from the audit HMAC secret is used.",
  },
  storage_recording_retention_days: {
    label: "Audio/report retention (days)",
    desc: "How long audio and structured reports are kept in the database.",
  },
} as const;
