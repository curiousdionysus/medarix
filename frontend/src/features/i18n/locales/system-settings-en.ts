export const systemSettings = {
  ai_enabled: {
    label: "AI module enabled",
    desc: "When off, transcription, report formatting, the AI assistant, and quality assurance are disabled.",
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
  qa_enabled: {
    label: "Report quality assurance (QA)",
    desc: "When on, structured reports are validated against the transcript with scores and warnings.",
  },
  qa_secondary_review_enabled: {
    label: "Secondary AI reviewer",
    desc: "A second LLM checks for hallucinations and omissions (independent of the primary model).",
  },
  qa_traceability_enabled: {
    label: "Sentence traceability",
    desc: "Maps each report sentence to its transcript source.",
  },
  qa_review_model: {
    label: "Reviewer model",
    desc: "Secondary reviewer model. Leave empty to use the primary LLM.",
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
  pacs_mwl_auto_sync: {
    label: "Auto-sync worklist from PACS",
    desc: "Run Study Root Query (C-FIND) when the worklist page opens.",
  },
  pacs_mwl_sync_days: {
    label: "Q/R date window (days)",
    desc: "Days before and after today for C-FIND queries.",
  },
  pacs_query_sync_days: {
    label: "Q/R date window (days)",
    desc: "Study Root C-FIND date range.",
  },
  pacs_move_destination_ae: {
    label: "C-MOVE destination AE",
    desc: "AE title for retrieve (e.g. Orthanc RADIOLOGY).",
  },
  pacs_web_viewer_url_template: {
    label: "PACS web viewer URL template",
    desc: "Opened from the worklist via accession. Placeholders: {accession}, {study_instance_uid}.",
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
