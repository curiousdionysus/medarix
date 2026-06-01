const STORAGE_KEYS = {
  token: "medarixToken",
  refreshToken: "medarixRefreshToken",
  tokenExpiresAt: "medarixTokenExpiresAt",
  language: "medarixLanguage",
  theme: "medarixTheme",
};

const LEGACY_MEDDICTATE_KEYS = {
  token: "meddictateToken",
  refreshToken: "meddictateRefreshToken",
  tokenExpiresAt: "meddictateTokenExpiresAt",
  language: "meddictateLanguage",
  theme: "meddictateTheme",
};

const LEGACY_VOXRAD_KEYS = {
  token: "voxradToken",
  refreshToken: "voxradRefreshToken",
  tokenExpiresAt: "voxradTokenExpiresAt",
  language: "voxradLanguage",
  theme: "voxradTheme",
};

function readStoredItem(key) {
  const current = localStorage.getItem(STORAGE_KEYS[key]);
  if (current !== null && current !== "") return current;
  for (const legacyKey of [LEGACY_MEDDICTATE_KEYS[key], LEGACY_VOXRAD_KEYS[key]]) {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null && legacy !== "") {
      localStorage.setItem(STORAGE_KEYS[key], legacy);
      localStorage.removeItem(legacyKey);
      return legacy;
    }
  }
  return "";
}

function writeStoredItem(key, value) {
  localStorage.setItem(STORAGE_KEYS[key], value);
  localStorage.removeItem(LEGACY_MEDDICTATE_KEYS[key]);
  localStorage.removeItem(LEGACY_VOXRAD_KEYS[key]);
}

function removeStoredItem(key) {
  localStorage.removeItem(STORAGE_KEYS[key]);
  localStorage.removeItem(LEGACY_MEDDICTATE_KEYS[key]);
  localStorage.removeItem(LEGACY_VOXRAD_KEYS[key]);
}

let token = readStoredItem("token") || "";
let refreshToken = readStoredItem("refreshToken") || "";
let tokenExpiresAt = Number(readStoredItem("tokenExpiresAt") || 0);
let selectedStudy = null;
let selectedReport = null;
let currentUser = null;
let currentSettings = [];
let activeSettingsCategory = null;
let userAdminState = { users: [], roles: [], groups: [] };
let reportTemplates = [];
let currentLanguage = readStoredItem("language") || "tr";
if (!["tr", "en"].includes(currentLanguage)) {
  currentLanguage = "tr";
}
let currentTheme = readStoredItem("theme") || "dark";
if (!["dark", "light"].includes(currentTheme)) {
  currentTheme = "dark";
}
let currentRecordingId = null;
let audioChunks = [];
let audioStream = null;
let audioContext = null;
let waveformAnalyser = null;
let waveformAnimationId = null;

let autoSaveTimer = null;
let lastFormattedTranscript = "";

const I18N = {
  tr: {
    worklist: "İş Listesi",
    reportEditor: "Rapor Editörü",
    archive: "Arşiv",
    templates: "Taslaklarım",
    saveDraft: "Taslak kaydedildi",
    sessionExpiring: "Oturumunuz yakında sona erecek. Yenileniyor...",
    apiError: "İşlem başarısız",
  },
  en: {
    worklist: "Worklist",
    reportEditor: "Report Editor",
    archive: "Archive",
    templates: "My Templates",
    saveDraft: "Draft saved",
    sessionExpiring: "Your session is expiring soon. Refreshing...",
    apiError: "Operation failed",
  },
};

function t(key) {
  return I18N[currentLanguage]?.[key] || I18N.tr[key] || key;
}

function applyTranslations() {
  const map = {
    templatesBtn: "templates",
    archiveBtn: "archive",
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = $(id);
    if (el) el.textContent = t(key);
  });
  document.querySelector("#worklistFilterTitle")?.replaceChildren(document.createTextNode(t("worklist")));
}

function friendlyError(error) {
  const message = String(error?.message || error || t("apiError"));
  if (message.includes("401")) return currentLanguage === "en" ? "Session expired. Please sign in again." : "Oturum süresi doldu. Tekrar giriş yapın.";
  if (message.includes("503") || message.includes("502"))
    return currentLanguage === "en"
      ? "Medarix AI service is temporarily unavailable."
      : "Medarix yapay zekâ servisi şu anda kullanılamıyor.";
  return message;
}

function storeSession(data) {
  token = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 1800) * 1000;
  writeStoredItem("token", token);
  writeStoredItem("tokenExpiresAt", String(tokenExpiresAt));
  removeStoredItem("refreshToken");
}

async function refreshAccessToken() {
  const body = refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : "{}";
  const data = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
  }).then(async (response) => {
    if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
    return response.json();
  });
  storeSession(data);
  return data;
}

function scheduleSessionRefresh() {
  if (!tokenExpiresAt) return;
  const warningAt = tokenExpiresAt - 2 * 60 * 1000;
  const delay = Math.max(warningAt - Date.now(), 5000);
  setTimeout(async () => {
    const banner = $("sessionWarning");
    if (!token) return;
    if (banner) {
      banner.textContent = t("sessionExpiring");
      banner.classList.remove("hidden");
    }
    try {
      await refreshAccessToken();
      if (banner) banner.classList.add("hidden");
      scheduleSessionRefresh();
    } catch {
      logout();
    }
  }, delay);
}

const QUICK_REPORT_TEMPLATES = [
  {
    key: "quick-ct",
    modality: "CT",
    title: "CT Standart",
    content: "TEKNİK:\nKontrastsız/kontrastlı BT inceleme yapıldı.\n\nBULGULAR:\n\n\nSONUÇ:\n",
    source: "Hizli",
  },
  {
    key: "quick-mr",
    modality: "MR",
    title: "MR Standart",
    content: "TEKNİK:\nMultiplanar multisekans MR inceleme yapıldı.\n\nBULGULAR:\n\n\nSONUÇ:\n",
    source: "Hizli",
  },
  {
    key: "quick-xr",
    modality: "XR",
    title: "Direkt Grafi Standart",
    content: "BULGULAR:\nKemik yapılar ve eklem ilişkileri değerlendirildi.\n\nSONUÇ:\n",
    source: "Hizli",
  },
  {
    key: "quick-us",
    modality: "US",
    title: "US Standart",
    content: "TEKNİK:\nUltrasonografik inceleme yapıldı.\n\nBULGULAR:\n\n\nSONUÇ:\n",
    source: "Hizli",
  },
];
let readyReportTemplates = QUICK_REPORT_TEMPLATES;

function setStatus(message) {
  if ($("loginStatus")) $("loginStatus").textContent = message;
}

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: "include" });
  if (response.status === 401 && !path.includes("/auth/")) {
    try {
      await refreshAccessToken();
      headers.Authorization = `Bearer ${token}`;
      response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: "include" });
    } catch {
      logout();
      throw new Error("401: session expired");
    }
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status}: ${detail}`);
  }
  if (response.status === 204) {
    return {};
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function login() {
  const payload = {
    username: $("username").value,
    password: $("password").value,
  };
  const data = await api("/auth/login", { method: "POST", body: JSON.stringify(payload) });
  storeSession(data);
  const me = await api("/auth/me");
  currentUser = me;
  await loadReadyReportTemplates();
  showApp();
  updateAdminVisibility();
  updateUserProfile();
  applyTranslations();
  scheduleSessionRefresh();
  setStatus(`Oturum: ${me.display_name || me.username} (${me.roles.join(", ")})`);
  loadReportTemplates().catch(() => renderReportTemplateSelect());
}

function userInitials(user) {
  const name = user?.display_name || user?.username || "Radyoloji";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function updateUserProfile() {
  const displayName = currentUser?.display_name || currentUser?.username || "Kullanıcı";
  const username = currentUser?.username ? `@${currentUser.username}` : "-";
  const roles = currentUser?.roles?.join(", ") || "Oturum açılmadı";
  const initials = userInitials(currentUser);
  const roleHint = currentUser?.roles?.includes("admin")
    ? "Yönetici"
    : currentUser?.roles?.includes("radiologist")
      ? "Radyolog"
      : roles;

  $("userDisplayName").textContent = displayName;
  $("userAvatar").textContent = initials;
  if ($("userRoleHint")) $("userRoleHint").textContent = roleHint;

  if ($("userSettingsName")) $("userSettingsName").textContent = displayName;
  if ($("userSettingsUsername")) $("userSettingsUsername").textContent = username;
  if ($("userSettingsAvatar")) $("userSettingsAvatar").textContent = initials;
  if ($("userSettingsDisplayName")) $("userSettingsDisplayName").value = currentUser?.display_name || "";
  if ($("userSettingsEmail")) $("userSettingsEmail").value = currentUser?.email || "";
  if ($("userSettingsRoles")) $("userSettingsRoles").value = roles;
}

function resetUserProfile() {
  currentUser = null;
  closeUserMenu();
  $("userDisplayName").textContent = "Kullanıcı";
  $("userAvatar").textContent = "AD";
  if ($("userRoleHint")) $("userRoleHint").textContent = "Radyolog";
}

function openUserSettings() {
  closeUserMenu();
  updateUserProfile();
  if ($("userSettingsStatus")) $("userSettingsStatus").textContent = "Profil bilgilerini güncelleyebilirsin.";
  $("userSettingsDialog").showModal();
}

async function saveUserSettings() {
  const emailInput = $("userSettingsEmail");
  const payload = {
    display_name: $("userSettingsDisplayName").value.trim(),
    email: emailInput.value.trim() || null,
  };
  if (!payload.display_name) {
    $("userSettingsStatus").textContent = "Ad Soyad boş bırakılamaz.";
    return;
  }
  if (payload.email && !emailInput.checkValidity()) {
    $("userSettingsStatus").textContent = "Geçerli bir e-posta adresi gir.";
    emailInput.reportValidity();
    return;
  }

  $("saveUserSettingsBtn").disabled = true;
  $("userSettingsStatus").textContent = "Profil kaydediliyor...";
  try {
    currentUser = await api("/auth/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    updateUserProfile();
    $("userSettingsStatus").textContent = "Profil kaydedildi.";
  } finally {
    $("saveUserSettingsBtn").disabled = false;
  }
}

function toggleUserMenu() {
  const menu = $("userProfileMenu");
  const isOpen = !menu.classList.contains("hidden");
  menu.classList.toggle("hidden", isOpen);
  $("userProfileButton").setAttribute("aria-expanded", String(!isOpen));
}

function closeUserMenu() {
  if (!$("userProfileMenu")) return;
  $("userProfileMenu").classList.add("hidden");
  $("userProfileButton").setAttribute("aria-expanded", "false");
}

function initLanguageSelector() {
  document.documentElement.lang = currentLanguage;
  if ($("languageSelect")) {
    $("languageSelect").value = currentLanguage;
  }
  updateLanguageFlag();
}

function changeLanguage(language) {
  currentLanguage = language;
  writeStoredItem("language", language);
  document.documentElement.lang = language;
  updateLanguageFlag();
  applyTranslations();
}

function updateLanguageFlag() {
  const flag = document.querySelector(".language-flag");
  if (flag) flag.textContent = currentLanguage === "tr" ? "🇹🇷" : "🇬🇧";
}

function applyTheme(theme) {
  currentTheme = theme;
  const isLight = theme === "light";
  document.documentElement.classList.toggle("light", isLight);
  document.body.classList.toggle("light", isLight);
  writeStoredItem("theme", theme);
  if ($("themeBtn")) {
    $("themeBtn").dataset.theme = theme;
    $("themeBtn").setAttribute("aria-checked", String(theme === "light"));
  }
}

function toggleTheme() {
  applyTheme(currentTheme === "light" ? "dark" : "light");
}

function showApp() {
  $("loginView").classList.add("hidden");
  $("appShell").classList.remove("hidden");
}

function showLogin() {
  $("appShell").classList.add("hidden");
  $("loginView").classList.remove("hidden");
}

function updateAdminVisibility() {
  const isAdmin = currentUser?.roles?.includes("admin");
  $("systemSettingsBtn").classList.toggle("hidden", !isAdmin);
}

async function searchStudies() {
  const params = new URLSearchParams();
  if ($("patientTc").value) params.set("patient_tc", $("patientTc").value);
  if ($("firstName").value) params.set("first_name", $("firstName").value);
  if ($("lastName").value) params.set("last_name", $("lastName").value);
  if ($("accession").value) params.set("accession_number", $("accession").value);
  if ($("fromDate").value) params.set("from_date", $("fromDate").value);
  if ($("toDate").value) params.set("to_date", $("toDate").value);
  document.querySelectorAll('input[name="modality"]:checked').forEach((input) => {
    params.append("modality", input.value);
  });
  const studies = await api(`/studies?${params.toString()}`);
  renderStudies(studies);
}

function setTodayRange() {
  const today = new Date().toISOString().slice(0, 10);
  $("fromDate").value = today;
  $("toDate").value = today;
}

function clearSearch() {
  ["patientTc", "firstName", "lastName", "accession", "fromDate", "toDate"].forEach((id) => {
    $(id).value = "";
  });
  document.querySelectorAll('input[name="modality"]').forEach((input) => {
    input.checked = false;
  });
}

async function logout() {
  try {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
  } catch {
    /* ignore */
  }
  token = "";
  refreshToken = "";
  tokenExpiresAt = 0;
  currentUser = null;
  selectedStudy = null;
  selectedReport = null;
  currentRecordingId = null;
  removeStoredItem("token");
  removeStoredItem("refreshToken");
  removeStoredItem("tokenExpiresAt");
  updateAdminVisibility();
  resetUserProfile();
  updatePatientContextPanel();
  setStatus("Oturum açılmadı");
  showLogin();
}

function renderStudies(studies) {
  selectedStudy = null;
  selectedReport = null;
  updatePatientContextPanel();
  updateClinicalContextBar();
  $("studyCount").textContent = `${studies.length} inceleme`;
  const list = $("studyList");
  list.innerHTML = "";

  if (!studies.length) {
    renderEmptyStudyList("Filtreleri genişleterek tekrar sorgulayın veya PACS bağlantısını kontrol edin.");
    return;
  }

  list.classList.remove("empty");
  for (const study of studies) {
    const card = document.createElement("button");
    card.className = "study-card";
    card.type = "button";
    const patientLabel = studyPatientLabel(study);
    card.innerHTML = `
      <div class="study-card-head">
        <strong>${escapeHtml(patientLabel)}</strong>
        ${modalityBadge(study.modality)}
      </div>
      <span class="study-card-line">${escapeHtml(study.study_description || "Açıklama belirtilmedi")}</span>
      <div class="study-card-foot">
        <span class="study-card-line">${escapeHtml(study.accession_number || "Accession yok")}</span>
        <span class="status-chip status-${study.report_status || "draft"}">${escapeHtml(reportStatusLabel(study.report_status || study.status || "draft"))}</span>
      </div>
      <small class="study-card-line">${escapeHtml(study.study_date || "Tarih yok")}</small>
    `;
    card.onclick = () => selectStudy(study, card);
    list.appendChild(card);
  }
}

function studyPatientLabel(study) {
  return (
    study.patient_name ||
    study.patient_display_name ||
    study.patient_full_name ||
    study.patient_tc ||
    study.patient_id ||
    study.patient_identifier ||
    study.accession_number ||
    "Hasta bilgisi yok"
  );
}

function modalityClass(modality) {
  const code = String(modality || "").toUpperCase();
  return ["CT", "MR", "XR", "US", "MG", "NM"].includes(code) ? `mod-${code}` : "mod-XR";
}

function modalityBadge(modality) {
  const code = String(modality || "—").toUpperCase();
  return `<span class="modality-badge ${modalityClass(code)}">${escapeHtml(code)}</span>`;
}

function reportStatusLabel(status) {
  const map = {
    draft: "Taslak",
    preliminary: "Ön Rapor",
    signed: "İmzalı",
    amended: "Düzeltme",
  };
  return map[status] || status || "Taslak";
}

function applyReportStatusChip(status) {
  const chip = $("contextReportStatus");
  if (!chip) return;
  const value = status || "draft";
  chip.className = `status-chip status-${value}`;
  chip.textContent = reportStatusLabel(value);
}

function updateClinicalContextBar() {
  const bar = $("clinicalContextBar");
  if (!bar) return;
  if (!selectedStudy) {
    bar.classList.add("hidden");
    return;
  }
  bar.classList.remove("hidden");
  $("contextPatientName").textContent = studyPatientLabel(selectedStudy);
  $("contextAccession").textContent = selectedStudy.accession_number ? `#${selectedStudy.accession_number}` : "Accession yok";
  const modChip = $("contextModality");
  if (modChip) {
    modChip.textContent = selectedStudy.modality || "—";
    modChip.className = `context-chip modality-chip ${modalityClass(selectedStudy.modality)}`;
  }
  applyReportStatusChip($("reportStatusSelect")?.value || selectedReport?.status || "draft");
}

function updateReportMetrics() {
  const text = $("report")?.value || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  if ($("reportWordCount")) $("reportWordCount").textContent = `${words} kelime`;
  if ($("reportCharCount")) $("reportCharCount").textContent = `${text.length} karakter`;
}

function updateWorkflowSteps() {
  const hasTranscript = Boolean($("transcript")?.value.trim());
  const hasReport = Boolean($("report")?.value.trim());
  document.querySelectorAll(".workflow-step").forEach((step) => {
    step.classList.remove("active", "done");
    step.removeAttribute("aria-current");
    const key = step.dataset.step;
    if (key === "dictation") {
      if (!hasTranscript) step.classList.add("active");
      else step.classList.add("done");
    }
    if (key === "format") {
      if (hasTranscript && !hasReport) step.classList.add("active");
      else if (hasReport) step.classList.add("done");
    }
    if (key === "report") {
      if (hasReport) step.classList.add("active");
    }
    if (step.classList.contains("active")) {
      step.setAttribute("aria-current", "step");
    }
  });
}

function renderEmptyStudyList(message) {
  const list = $("studyList");
  list.classList.add("empty");
  list.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">📋</div>
      <strong>Sonuç bulunamadı</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function patientInitials(study) {
  const name = study?.patient_name || studyPatientLabel(study);
  if (!name || name === "Hasta bilgisi yok") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatStudyDate(value) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}.${month}.${year}`;
  }
  return text;
}

function setReportState(message, visible = Boolean(message)) {
  const chip = $("reportState");
  if (!chip) return;
  chip.textContent = message || "";
  chip.classList.toggle("hidden", !visible);
}

function updatePatientReportStatus(status) {
  const chip = $("patientReportStatus");
  if (!chip) return;
  const value = status || "draft";
  chip.className = `status-chip status-${value}`;
  chip.textContent = reportStatusLabel(value);
}

function updatePatientContextPanel() {
  const empty = $("patientContextEmpty");
  const filled = $("patientContextFilled");
  if (!empty || !filled) return;

  if (!selectedStudy) {
    empty.classList.remove("hidden");
    filled.classList.add("hidden");
    setReportState("", false);
    updateClinicalContextBar();
    updateWorkflowSteps();
    return;
  }

  empty.classList.add("hidden");
  filled.classList.remove("hidden");

  $("patientContextAvatar").textContent = patientInitials(selectedStudy);
  $("patientContextName").textContent = studyPatientLabel(selectedStudy);

  const tcEl = $("patientContextTc");
  if (selectedStudy.patient_tc) {
    tcEl.textContent = `TC ${selectedStudy.patient_tc}`;
    tcEl.classList.remove("hidden");
  } else {
    tcEl.textContent = "";
    tcEl.classList.add("hidden");
  }

  const details = [];
  if (selectedStudy.accession_number) {
    details.push({
      label: "Accession",
      value: selectedStudy.accession_number,
      mono: true,
    });
  }
  if (selectedStudy.modality) {
    details.push({ label: "Modalite", value: selectedStudy.modality, badge: true });
  }
  const studyDate = formatStudyDate(selectedStudy.study_date);
  if (studyDate) {
    details.push({ label: "Tarih", value: studyDate });
  }
  if (selectedStudy.study_description) {
    details.push({
      label: "İnceleme",
      value: selectedStudy.study_description,
      description: true,
    });
  }

  $("patientContextDetails").innerHTML = details
    .map((item) => {
      if (item.badge) return modalityBadge(item.value);
      const classes = ["patient-context-field"];
      if (item.description) classes.push("description");
      const valueClass = item.mono ? "patient-context-field-value mono" : "patient-context-field-value";
      return `
        <span class="${classes.join(" ")}">
          <span class="patient-context-field-label">${escapeHtml(item.label)}</span>
          <span class="${valueClass}">${escapeHtml(item.value)}</span>
        </span>
      `;
    })
    .join("");

  updatePatientReportStatus($("reportStatusSelect")?.value || selectedReport?.status || "draft");
  updateClinicalContextBar();
  updateWorkflowSteps();
}

function selectStudy(study, card) {
  selectedStudy = study;
  selectedReport = null;
  currentRecordingId = null;
  document.querySelectorAll(".study-card").forEach((item) => item.classList.remove("active"));
  card.classList.add("active");
  setReportState("", false);
  updatePatientContextPanel();
  loadStudyReport(study.id).catch((error) => {
    setReportState(friendlyError(error));
  });
}

async function loadStudyReport(studyId) {
  const report = await api(`/studies/${studyId}/report`);
  if (!report) {
    $("transcript").value = "";
    $("report").value = "";
    if ($("reportStatusSelect")) $("reportStatusSelect").value = "draft";
    updateReportMetrics();
    updateWorkflowSteps();
    updatePatientReportStatus("draft");
    setReportState("", false);
    return;
  }
  selectedReport = report;
  $("transcript").value = report.transcript || "";
  $("report").value = report.content || "";
  if ($("reportStatusSelect")) $("reportStatusSelect").value = report.status || "draft";
  updatePatientReportStatus(report.status);
  setReportState(`v${report.version} · ${reportStatusLabel(report.status)}`);
  updateReportMetrics();
  updateWorkflowSteps();
  applyReportStatusChip(report.status);
  updateClinicalContextBar();
}

function scheduleAutoSave() {
  if (!selectedStudy) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveReport(true).catch(() => {});
  }, 1500);
}

function showDiffDialog(transcript, report) {
  $("diffTranscript").textContent = transcript;
  $("diffReport").textContent = report;
  $("diffDialog").showModal();
}

async function formatReport() {
  const transcript = $("transcript").value.trim();
  if (!transcript) {
    $("report").value = currentLanguage === "en" ? "Transcript is empty." : "Transkript boş.";
    return;
  }
  const template = getSelectedReportTemplate()?.content || null;
  lastFormattedTranscript = transcript;
  setFormatLoading(true);
  try {
    const data = await api("/ai/format-report", {
      method: "POST",
      body: JSON.stringify({
        transcript,
        template,
        recording_id: currentRecordingId,
        study_id: selectedStudy?.id || null,
      }),
    });
    $("report").value = data.report;
    currentRecordingId = data.recording_id || currentRecordingId;
    if (data.saved_report) {
      selectedReport = data.saved_report;
      setReportState(`${t("saveDraft")} v${data.saved_report.version}`);
    }
    showDiffDialog(transcript, data.report);
    updateReportMetrics();
    updateWorkflowSteps();
  } finally {
    setFormatLoading(false);
  }
}

function setFormatLoading(isLoading) {
  const button = $("formatBtn");
  const loader = $("formatLoader");
  if (!button || !loader) return;
  button.disabled = isLoading;
  loader.classList.toggle("hidden", !isLoading);
}

async function loadReadyReportTemplates() {
  try {
    const response = await fetch("/static/report_templates.json");
    if (!response.ok) {
      throw new Error(`Hazır taslaklar yüklenemedi: ${response.status}`);
    }
    readyReportTemplates = await response.json();
  } catch (error) {
    console.warn(error);
    readyReportTemplates = QUICK_REPORT_TEMPLATES;
  }
  renderReportTemplateSelect();
}

async function loadReportTemplates() {
  await loadReadyReportTemplates();
  reportTemplates = await api("/report-templates");
  renderReportTemplateSelect();
  renderTemplateList();
}

function allReportTemplates() {
  return [
    ...readyReportTemplates,
    ...reportTemplates.map((template) => ({
      ...template,
      key: `custom-${template.id}`,
      source: "Kişisel",
    })),
  ];
}

function normalizeTemplateSearch(value) {
  return value.toLocaleLowerCase("tr-TR").trim();
}

function filteredReportTemplates() {
  const query = normalizeTemplateSearch($("reportTemplateSearch")?.value || "");
  if (!query) return allReportTemplates();
  return allReportTemplates().filter((template) => {
    const searchableText = normalizeTemplateSearch(
      `${template.modality} ${template.title} ${template.source} ${template.content}`,
    );
    return searchableText.includes(query);
  });
}

function renderReportTemplateSelect() {
  const select = $("reportTemplateSelect");
  const selectedValue = select.value;
  const allTemplates = allReportTemplates();
  const templates = filteredReportTemplates();
  const grouped = allTemplates.reduce((groups, template) => {
    groups[template.modality] = groups[template.modality] || [];
    groups[template.modality].push(template);
    return groups;
  }, {});

  select.innerHTML = '<option value="">Taslak seç...</option>';
  for (const modality of Object.keys(grouped).sort()) {
    const group = document.createElement("optgroup");
    group.label = modality;
    for (const template of grouped[modality]) {
      const option = document.createElement("option");
      option.value = template.key;
      option.textContent = `${template.modality} - ${template.title} (${template.source})`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
  select.value = selectedValue && allTemplates.some((template) => template.key === selectedValue) ? selectedValue : "";
  renderReportTemplateFlyout(templates);
  updateReportTemplatePickerLabel();
  if (!$("reportTemplateFlyout")?.classList.contains("hidden")) {
    positionTemplateFlyout();
  }
}

function getSelectedReportTemplate() {
  return allReportTemplates().find((item) => item.key === $("reportTemplateSelect").value);
}

function createFlyoutOption(template) {
  const option = document.createElement("button");
  option.type = "button";
  option.className = "flyout-option";
  if (template.key === $("reportTemplateSelect").value) {
    option.classList.add("active");
  }
  option.setAttribute("role", "menuitem");
  option.innerHTML = `<span class="flyout-option-title">${escapeHtml(template.title)}</span>`;
  option.onclick = () => selectReportTemplate(template.key);
  return option;
}

function closeFlyoutSubmenus() {
  if (flyoutSubmenuCloseTimer) {
    clearTimeout(flyoutSubmenuCloseTimer);
    flyoutSubmenuCloseTimer = null;
  }
  document.querySelectorAll(".flyout-item.is-open").forEach((item) => {
    item.classList.remove("is-open");
    item.querySelector(".flyout-trigger")?.setAttribute("aria-expanded", "false");
    resetFlyoutSubmenuPosition(item.querySelector(".flyout-submenu"));
  });
}

function isFlyoutHoverTarget(item, submenu, target) {
  if (!target) return false;
  return item.contains(target) || submenu.contains(target);
}

let flyoutSubmenuCloseTimer = null;

function positionFlyoutSubmenu(item, submenu) {
  if (!item || !submenu) return;
  const overlap = 8;
  const padding = 12;
  const itemRect = item.getBoundingClientRect();
  const submenuWidth = 220;

  submenu.style.width = `${submenuWidth}px`;
  submenu.style.position = "fixed";

  let left = itemRect.right - overlap;
  if (left + submenuWidth > window.innerWidth - padding) {
    left = itemRect.left - submenuWidth + overlap;
    submenu.classList.add("is-left");
  } else {
    submenu.classList.remove("is-left");
  }
  left = Math.max(padding, Math.min(left, window.innerWidth - padding - submenuWidth));
  submenu.style.left = `${left}px`;

  let top = itemRect.top - 4;
  const submenuHeight = submenu.offsetHeight;
  if (top + submenuHeight > window.innerHeight - padding) {
    top = Math.max(padding, window.innerHeight - padding - submenuHeight);
  }
  submenu.style.top = `${top}px`;
}

function resetFlyoutSubmenuPosition(submenu) {
  if (!submenu) return;
  submenu.style.top = "";
  submenu.style.left = "";
  submenu.style.width = "";
  submenu.style.position = "";
  submenu.classList.remove("is-left");
}

function bindFlyoutSubmenu(item) {
  const trigger = item.querySelector(".flyout-trigger");
  const submenu = item.querySelector(".flyout-submenu");
  if (!trigger || !submenu) return;

  const open = () => {
    if (flyoutSubmenuCloseTimer) {
      clearTimeout(flyoutSubmenuCloseTimer);
      flyoutSubmenuCloseTimer = null;
    }
    document.querySelectorAll(".flyout-item.is-open").forEach((other) => {
      if (other === item) return;
      other.classList.remove("is-open");
      other.querySelector(".flyout-trigger")?.setAttribute("aria-expanded", "false");
      resetFlyoutSubmenuPosition(other.querySelector(".flyout-submenu"));
    });
    item.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    positionFlyoutSubmenu(item, submenu);
  };

  const scheduleClose = () => {
    if (flyoutSubmenuCloseTimer) clearTimeout(flyoutSubmenuCloseTimer);
    flyoutSubmenuCloseTimer = setTimeout(() => {
      item.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      resetFlyoutSubmenuPosition(submenu);
      flyoutSubmenuCloseTimer = null;
    }, 180);
  };

  const cancelClose = () => {
    if (flyoutSubmenuCloseTimer) {
      clearTimeout(flyoutSubmenuCloseTimer);
      flyoutSubmenuCloseTimer = null;
    }
  };

  item.addEventListener("mouseenter", () => {
    cancelClose();
    open();
  });
  item.addEventListener("mouseleave", (event) => {
    if (isFlyoutHoverTarget(item, submenu, event.relatedTarget)) return;
    scheduleClose();
  });
  submenu.addEventListener("mouseenter", cancelClose);
  submenu.addEventListener("mouseleave", (event) => {
    if (isFlyoutHoverTarget(item, submenu, event.relatedTarget)) return;
    scheduleClose();
  });
  trigger.addEventListener("focus", open);
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
      submenu.querySelector(".flyout-option")?.focus();
    }
  });
}

function renderReportTemplateFlyout(templates) {
  const menu = $("reportTemplateMenu");
  if (!menu) return;
  menu.innerHTML = "";
  closeFlyoutSubmenus();

  const query = normalizeTemplateSearch($("reportTemplateSearch")?.value || "");
  if (!templates.length) {
    const empty = document.createElement("div");
    empty.className = "flyout-empty";
    empty.textContent = "Eşleşen taslak yok";
    menu.appendChild(empty);
    return;
  }

  if (query) {
    const label = document.createElement("div");
    label.className = "flyout-search-results-label";
    label.textContent = `${templates.length} sonuç`;
    menu.appendChild(label);
    for (const template of templates) {
      menu.appendChild(createFlyoutOption(template));
    }
    return;
  }

  const grouped = templates.reduce((groups, template) => {
    groups[template.modality] = groups[template.modality] || [];
    groups[template.modality].push(template);
    return groups;
  }, {});

  for (const modality of Object.keys(grouped).sort()) {
    const modalityTemplates = grouped[modality];
    const item = document.createElement("div");
    item.className = "flyout-item has-submenu";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "flyout-trigger";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `
      <span class="flyout-trigger-label">
        <span class="flyout-mod ${modalityClass(modality)}">${escapeHtml(modality)}</span>
        <span class="flyout-count">${modalityTemplates.length}</span>
      </span>
      <span class="flyout-chevron" aria-hidden="true">›</span>
    `;

    const submenu = document.createElement("div");
    submenu.className = "flyout-submenu";
    submenu.setAttribute("role", "menu");
    submenu.setAttribute("aria-label", `${modality} taslakları`);
    for (const template of modalityTemplates) {
      submenu.appendChild(createFlyoutOption(template));
    }

    item.appendChild(trigger);
    item.appendChild(submenu);
    bindFlyoutSubmenu(item);
    menu.appendChild(item);
  }
}

function updateReportTemplatePickerLabel() {
  const label = $("reportTemplatePickerLabel");
  if (!label) return;
  const template = getSelectedReportTemplate();
  label.textContent = template ? `${template.modality} - ${template.title} (${template.source})` : "Taslak seç...";
}

function selectReportTemplate(templateKey) {
  $("reportTemplateSelect").value = templateKey;
  updateReportTemplatePickerLabel();
  closeReportTemplateFlyout();
  applySelectedTemplate();
}

function resetTemplateFlyoutPosition() {
  const flyout = $("reportTemplateFlyout");
  if (!flyout) return;
  flyout.classList.remove("is-floating");
  flyout.style.top = "";
  flyout.style.left = "";
  flyout.style.width = "";
  closeFlyoutSubmenus();
}

function positionTemplateFlyout() {
  const btn = $("reportTemplatePickerBtn");
  const flyout = $("reportTemplateFlyout");
  if (!btn || !flyout || flyout.classList.contains("hidden")) return;

  flyout.classList.add("is-floating");
  const gap = 6;
  const padding = 12;
  const rect = btn.getBoundingClientRect();
  const width = Math.min(200, Math.max(rect.width, 168), window.innerWidth - padding * 2);

  flyout.style.width = `${width}px`;
  let left = Math.min(rect.left, window.innerWidth - padding - width);
  left = Math.max(padding, left);
  flyout.style.left = `${left}px`;

  flyout.classList.remove("hidden");
  const flyoutHeight = flyout.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom - gap - padding;
  const spaceAbove = rect.top - gap - padding;

  if (spaceBelow >= flyoutHeight || spaceBelow >= spaceAbove) {
    flyout.style.top = `${Math.min(rect.bottom + gap, window.innerHeight - padding - flyoutHeight)}px`;
  } else {
    flyout.style.top = `${Math.max(padding, rect.top - gap - flyoutHeight)}px`;
  }
}

function openReportTemplateFlyout() {
  $("reportTemplateFlyout").classList.remove("hidden");
  $("reportTemplatePickerBtn").setAttribute("aria-expanded", "true");
  renderReportTemplateSelect();
  positionTemplateFlyout();
  $("reportTemplateSearch").focus();
}

function closeReportTemplateFlyout() {
  if (!$("reportTemplateFlyout")) return;
  $("reportTemplateFlyout").classList.add("hidden");
  $("reportTemplatePickerBtn").setAttribute("aria-expanded", "false");
  resetTemplateFlyoutPosition();
}

function toggleReportTemplateFlyout() {
  if ($("reportTemplateFlyout").classList.contains("hidden")) {
    openReportTemplateFlyout();
  } else {
    closeReportTemplateFlyout();
  }
}

function applySelectedTemplate() {
  const template = getSelectedReportTemplate();
  if (!template) {
    return;
  }
}

async function openTemplates() {
  await loadReportTemplates();
  $("templateTitle").value = "";
  $("templateContent").value = "";
  $("templatesStatus").textContent = "Yeni taslak oluştur veya mevcut taslaklarını gör.";
  $("templatesDialog").showModal();
}

async function saveTemplate() {
  const payload = {
    modality: $("templateModality").value,
    title: $("templateTitle").value,
    content: $("templateContent").value,
  };
  if (!payload.title.trim() || !payload.content.trim()) {
    $("templatesStatus").textContent = "Taslak adı ve içerik gerekli.";
    return;
  }

  await api("/report-templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  $("templateTitle").value = "";
  $("templateContent").value = "";
  $("templatesStatus").textContent = "Taslak kaydedildi.";
  await loadReportTemplates();
}

async function deleteTemplate(templateId) {
  await api(`/report-templates/${templateId}`, {
    method: "DELETE",
  });
  $("templatesStatus").textContent = "Taslak silindi.";
  await loadReportTemplates();
}

function renderTemplateList() {
  const list = $("templateList");
  if (!list) return;
  list.innerHTML = "";
  list.classList.toggle("empty", !reportTemplates.length);
  if (!reportTemplates.length) {
    list.textContent = "Henüz kişisel taslak yok.";
    return;
  }

  for (const template of reportTemplates) {
    const card = document.createElement("div");
    card.className = "template-card";
    card.innerHTML = `
      <div class="template-card-header">
        <strong>${escapeHtml(template.modality)} - ${escapeHtml(template.title)}</strong>
        <button type="button" class="danger compact-button" data-delete-template="${escapeHtml(template.id)}">Sil</button>
      </div>
      <span>${escapeHtml(template.content.slice(0, 140))}${template.content.length > 140 ? "..." : ""}</span>
    `;
    list.appendChild(card);
  }
  list.querySelectorAll("[data-delete-template]").forEach((button) => {
    button.onclick = () => deleteTemplate(button.dataset.deleteTemplate).catch((error) => {
      $("templatesStatus").textContent = `Taslak silinemedi: ${error.message}`;
    });
  });
}

async function startAudioRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setAudioStatus("Tarayıcı mikrofon kaydını desteklemiyor.");
    return;
  }

  audioChunks = [];
  audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(audioStream);
  startWaveform(audioStream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    transcribeRecordedAudio().catch((error) => {
      setAudioStatus(`Transkripsiyon başarısız: ${error.message}`);
      resetRecordingControls();
    });
  };

  mediaRecorder.start();
  $("recordAudioBtn").disabled = true;
  $("stopAudioBtn").disabled = false;
  $("uploadAudioBtn").disabled = true;
  $("recordAudioBtn").classList.add("recording");
  setTranscriptionLoading(false);
  setAudioStatus("Kayıt alınıyor...");
}

function startWaveform(stream) {
  audioContext = new AudioContext();
  waveformAnalyser = audioContext.createAnalyser();
  waveformAnalyser.fftSize = 2048;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(waveformAnalyser);
  drawWaveform();
}

function drawWaveform() {
  const canvas = $("audioWaveform");
  const canvasContext = canvas.getContext("2d");
  const data = new Uint8Array(waveformAnalyser.frequencyBinCount);

  waveformAnalyser.getByteTimeDomainData(data);
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.lineWidth = 3;
  canvasContext.strokeStyle = getComputedStyle(document.body).getPropertyValue("--accent").trim();
  canvasContext.beginPath();

  const sliceWidth = canvas.width / data.length;
  let x = 0;
  for (let i = 0; i < data.length; i += 1) {
    const y = (data[i] / 128) * (canvas.height / 2);
    if (i === 0) {
      canvasContext.moveTo(x, y);
    } else {
      canvasContext.lineTo(x, y);
    }
    x += sliceWidth;
  }

  canvasContext.lineTo(canvas.width, canvas.height / 2);
  canvasContext.stroke();
  waveformAnimationId = requestAnimationFrame(drawWaveform);
}

function stopAudioRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    setAudioStatus("Ses hazırlanıyor...");
    mediaRecorder.stop();
    stopWaveform();
    stopAudioStream();
    $("stopAudioBtn").disabled = true;
  }
}

function setAudioStatus(message = "", statusClass = "") {
  const feedback = $("audioFeedback");
  const status = $("audioStatus");
  if (!feedback || !status) return;
  feedback.className = "audio-feedback muted";
  if (statusClass) feedback.classList.add(statusClass);
  status.textContent = message;
  if (statusClass === "ready-check") {
    feedback.title = "Transkripsiyon hazır";
    feedback.setAttribute("aria-label", "Transkripsiyon hazır");
  } else {
    feedback.removeAttribute("title");
    feedback.removeAttribute("aria-label");
  }
}

function setTranscriptionLoading(isLoading) {
  const feedback = $("audioFeedback");
  const loader = $("transcriptionLoader");
  if (!loader) return;
  loader.classList.toggle("hidden", !isLoading);
  if (feedback) {
    feedback.classList.toggle("is-loading", isLoading);
  }
}

async function transcribeAudioFile(file, filename) {
  const formData = new FormData();
  formData.append("file", file, filename);
  if (selectedStudy?.id) {
    formData.append("study_id", selectedStudy.id);
  }

  setAudioStatus("");
  setTranscriptionLoading(true);
  const data = await api("/ai/transcribe", {
    method: "POST",
    body: formData,
  }).finally(() => setTranscriptionLoading(false));

  currentRecordingId = data.recording_id || null;
  $("transcript").value = data.text || "";
  if (data.text) {
    setAudioStatus("", "ready-check");
  } else {
    setAudioStatus("Konuşma algılanmadı.");
  }
}

async function transcribeRecordedAudio() {
  const mimeType = mediaRecorder?.mimeType || "audio/webm";
  const blob = new Blob(audioChunks, { type: mimeType });
  await transcribeAudioFile(blob, "dictation.webm");
  resetRecordingControls();
}

async function transcribeUploadedAudio() {
  const input = $("audioFileInput");
  const file = input.files?.[0];
  if (!file) return;
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    setAudioStatus("Önce kaydı durdur.");
    input.value = "";
    return;
  }

  $("recordAudioBtn").disabled = true;
  $("uploadAudioBtn").disabled = true;
  $("stopAudioBtn").disabled = true;
  try {
    await transcribeAudioFile(file, file.name || "uploaded-audio");
  } finally {
    $("recordAudioBtn").disabled = false;
    $("uploadAudioBtn").disabled = false;
    $("stopAudioBtn").disabled = true;
    input.value = "";
  }
}

function resetRecordingControls() {
  $("recordAudioBtn").disabled = false;
  $("stopAudioBtn").disabled = true;
  $("uploadAudioBtn").disabled = false;
  $("recordAudioBtn").classList.remove("recording");
  setTranscriptionLoading(false);
  stopWaveform();
  stopAudioStream();
  mediaRecorder = null;
}

function stopAudioStream() {
  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
  }
  audioStream = null;
}

function stopWaveform() {
  if (waveformAnimationId) {
    cancelAnimationFrame(waveformAnimationId);
  }
  waveformAnimationId = null;
  waveformAnalyser = null;
  if (audioContext) {
    audioContext.close().catch(() => {});
  }
  audioContext = null;
  clearWaveform();
}

function clearWaveform() {
  const canvas = $("audioWaveform");
  const canvasContext = canvas.getContext("2d");
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.strokeStyle = getComputedStyle(document.body).getPropertyValue("--muted").trim();
  canvasContext.lineWidth = 1;
  canvasContext.beginPath();
  canvasContext.moveTo(0, canvas.height / 2);
  canvasContext.lineTo(canvas.width, canvas.height / 2);
  canvasContext.stroke();
}

async function saveReport(silent = false) {
  if (!selectedStudy) {
    if (!silent) setReportState(currentLanguage === "en" ? "Select a study first" : "Önce inceleme seç");
    return;
  }
  const payload = {
    content: $("report").value,
    transcript: $("transcript").value,
    status: $("reportStatusSelect")?.value || "draft",
  };
  const data = await api(`/studies/${selectedStudy.id}/report`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  selectedReport = data;
  if (!silent) setReportState(`${t("saveDraft")} v${data.version}`);
  return data;
}

async function sendReportToPacs() {
  if (!selectedStudy) {
    setReportState("Önce inceleme seç");
    return;
  }
  if (!$("report").value.trim()) {
    setReportState("Rapor boş");
    return;
  }

  const savedReport = await saveReport();
  const data = await api(`/reports/${savedReport.id}/send-to-pacs`, { method: "POST", body: "{}" });
  selectedReport = data.report;
  setReportState(`PACS'a gönderildi: ${data.pacs_status.status}`);
}

async function downloadReportPdf() {
  const content = $("report").value.trim();
  if (!content) {
    setReportState("İndirilecek rapor yok");
    return;
  }

  const payload = {
    content,
    patient_label: selectedStudy ? studyPatientLabel(selectedStudy) : null,
    accession_number: selectedStudy?.accession_number || null,
    modality: selectedStudy?.modality || null,
    study_date: selectedStudy?.study_date || null,
    study_description: selectedStudy?.study_description || null,
  };
  const response = await fetch("/api/v1/reports/pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`${response.status}: ${await response.text()}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rapor-${payload.accession_number || "rapor"}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setReportState("PDF indirildi");
}

async function loadAudit() {
  const events = await api("/admin/audit");
  $("auditLog").textContent = JSON.stringify(events, null, 2);
  $("auditStatus").textContent = `${events.length} denetim olayı yüklendi.`;
  if (!$("auditDialog").open) {
    $("auditDialog").showModal();
  }
}

async function loadSettingsAudit() {
  const events = await api("/admin/audit");
  if ($("settingsAuditLog")) {
    $("settingsAuditLog").textContent = JSON.stringify(events, null, 2);
  }
  if ($("settingsAuditStatus")) {
    $("settingsAuditStatus").textContent = `${events.length} denetim olayı yüklendi.`;
  }
}

let settingsSearchQuery = "";
let settingsDirty = false;
let settingsSnapshot = "";

const SETTINGS_NAV = {
  __overview: { label: "Genel Bakış", icon: "◉", description: "Servis durumu ve sistem özeti" },
  "Yapay Zeka Servisleri": { label: "Yapay Zeka", icon: "AI", description: "LLM ve transkripsiyon servisleri" },
  "PACS / DICOM": { label: "PACS / DICOM", icon: "PX", description: "Görüntü arşivi ve DICOM geçidi" },
  "Kimlik Doğrulama": { label: "Kimlik Doğrulama", icon: "ID", description: "LDAP ve oturum yapılandırması" },
  Güvenlik: { label: "Güvenlik", icon: "SC", description: "Oturum, denetim ve şifreleme" },
  "Veri Saklama": { label: "Veri Saklama", icon: "DB", description: "Ses ve rapor saklama politikası" },
  __users: { label: "Kullanıcı Yönetimi", icon: "US", description: "Kullanıcı, rol ve grup yönetimi" },
  __audit: { label: "SOC / Denetim", icon: "AU", description: "Güvenlik ve klinik denetim kayıtları" },
};

const NUMERIC_SETTING_KEYS = new Set([
  "pacs.port",
  "security.session_minutes",
  "security.refresh_token_days",
  "security.audit_retention_days",
  "storage.recording_retention_days",
]);

const BOOLEAN_SETTING_KEYS = new Set(["auth.ldap_enabled"]);

const SELECT_SETTING_OPTIONS = {
  "ai.transcription_language": [
    { value: "tr", label: "Türkçe (tr)" },
    { value: "en", label: "English (en)" },
    { value: "auto", label: "Otomatik algılama" },
  ],
};

function settingsCategoryMeta(category) {
  return SETTINGS_NAV[category] || { label: category, icon: "•", description: "" };
}

function markSettingsDirty() {
  settingsDirty = true;
  $("resetSettingsBtn")?.classList.remove("hidden");
  const pill = $("settingsStatus");
  if (pill) {
    pill.textContent = "Kaydedilmemiş değişiklikler var";
    pill.classList.add("dirty");
  }
}

function snapshotCurrentSettings() {
  syncRenderedSystemSettings();
  const updates = {};
  currentSettings.forEach((group) => {
    group.settings.forEach((setting) => {
      updates[setting.key] = setting.value;
    });
  });
  settingsSnapshot = JSON.stringify(updates);
}

function clearSettingsDirty() {
  settingsDirty = false;
  snapshotCurrentSettings();
  $("resetSettingsBtn")?.classList.add("hidden");
  const pill = $("settingsStatus");
  if (pill) pill.classList.remove("dirty");
}

function restoreDirtyUiState() {
  if (!settingsDirty) return;
  $("resetSettingsBtn")?.classList.remove("hidden");
  const pill = $("settingsStatus");
  if (pill) {
    pill.textContent = "Kaydedilmemiş değişiklikler var";
    pill.classList.add("dirty");
  }
}

function bindSettingsChangeTracking() {
  document.querySelectorAll("[data-setting-key]").forEach((input) => {
    input.oninput = () => markSettingsDirty();
    input.onchange = () => markSettingsDirty();
  });
}

function filteredSettingsInGroup(group) {
  const query = settingsSearchQuery.trim().toLocaleLowerCase("tr-TR");
  if (!query) return group.settings;
  return group.settings.filter((setting) => {
    const haystack = `${setting.label} ${setting.key} ${setting.description || ""}`.toLocaleLowerCase("tr-TR");
    return haystack.includes(query);
  });
}

function renderSettingControl(setting) {
  const value = escapeHtml(setting.value ?? "");
  if (BOOLEAN_SETTING_KEYS.has(setting.key)) {
    const checked = ["true", "1", "yes", "on"].includes(String(setting.value).toLowerCase());
    return `
      <label class="setting-toggle">
        <input type="checkbox" data-setting-key="${setting.key}" data-boolean-setting="true" ${checked ? "checked" : ""} />
        <span class="setting-toggle-track"><span class="setting-toggle-thumb"></span></span>
        <span>${checked ? "Etkin" : "Kapalı"}</span>
      </label>
    `;
  }
  if (SELECT_SETTING_OPTIONS[setting.key]) {
    const options = SELECT_SETTING_OPTIONS[setting.key]
      .map((opt) => `<option value="${opt.value}" ${opt.value === setting.value ? "selected" : ""}>${opt.label}</option>`)
      .join("");
    return `<select data-setting-key="${setting.key}">${options}</select>`;
  }
  const inputType = setting.is_secret ? "password" : NUMERIC_SETTING_KEYS.has(setting.key) ? "number" : "text";
  const extra = NUMERIC_SETTING_KEYS.has(setting.key) ? 'min="1"' : "";
  return `
    <input
      type="${inputType}"
      data-setting-key="${setting.key}"
      ${modelDatalist(setting.key)}
      value="${value}"
      ${extra}
    />
    ${modelDatalistElement(setting.key)}
  `;
}

function renderSettingField(setting) {
  return `
    <article class="setting-card" data-setting-card="${setting.key}">
      <div class="setting-card-head">
        <div>
          <strong>${escapeHtml(setting.label)}</strong>
          <code class="setting-key">${escapeHtml(setting.key)}</code>
        </div>
        ${urlStatusDot(setting.key)}
      </div>
      ${renderSettingControl(setting)}
      <p class="setting-description">${escapeHtml(setting.description || "")}</p>
    </article>
  `;
}

async function renderSettingsOverview(content) {
  content.innerHTML = `
    <section class="settings-overview">
      <div class="settings-overview-header">
        <div>
          <h3>Genel Bakış</h3>
          <p>Bağlı servislerin anlık durumu ve sistem bilgisi.</p>
        </div>
        <button id="refreshHealthBtn" type="button" class="ghost">Durumu Yenile</button>
      </div>
      <div id="settingsHealthCards" class="settings-health-grid">
        <div class="settings-health-card loading">Servis durumu kontrol ediliyor...</div>
      </div>
    </section>
  `;
  $("refreshHealthBtn").onclick = () => loadSettingsHealth().catch((error) => {
    $("settingsHealthCards").innerHTML = `<div class="settings-health-card error">${escapeHtml(friendlyError(error))}</div>`;
  });
  await loadSettingsHealth();
}

async function loadSettingsHealth() {
  const container = $("settingsHealthCards");
  if (!container) return;
  container.innerHTML = `<div class="settings-health-card loading">Servis durumu kontrol ediliyor...</div>`;
  const health = await fetch("/healthz/deps").then(async (response) => {
    if (!response.ok) throw new Error(`${response.status}: health check failed`);
    return response.json();
  });
  const deps = health.dependencies || {};
  const cards = [
    { key: "database", label: "PostgreSQL", icon: "DB" },
    { key: "ollama", label: "Dil Modeli", icon: "AI" },
    { key: "whisper", label: "Transkripsiyon", icon: "MX" },
    { key: "dicomweb", label: "DICOM / PACS", icon: "PX" },
  ];
  container.innerHTML = `
    <article class="settings-health-card info">
      <span class="settings-health-icon">SYS</span>
      <div>
        <strong>${escapeHtml(health.service || "Medarix")}</strong>
        <span>${escapeHtml(health.environment || "development")} ortamı</span>
      </div>
      <span class="health-badge ok">Aktif</span>
    </article>
    ${cards
      .map((card) => {
        const dep = deps[card.key] || {};
        const ok = Boolean(dep.ok);
        return `
          <article class="settings-health-card ${ok ? "ok" : "error"}">
            <span class="settings-health-icon">${card.icon}</span>
            <div>
              <strong>${card.label}</strong>
              <span>${escapeHtml(dep.error || (ok ? "Bağlantı başarılı" : "Bağlantı başarısız"))}</span>
            </div>
            <span class="health-badge ${ok ? "ok" : "error"}">${ok ? "Aktif" : "Pasif"}</span>
          </article>
        `;
      })
      .join("")}
  `;
}

async function openSystemSettings() {
  currentSettings = await api("/admin/system-settings");
  if (!activeSettingsCategory) activeSettingsCategory = "__overview";
  settingsSearchQuery = "";
  if ($("settingsSearchInput")) $("settingsSearchInput").value = "";
  renderSystemSettings(currentSettings);
  $("settingsStatus").textContent = "Değişiklikler denetim kaydına yazılır.";
  $("settingsStatus").classList.remove("dirty");
  $("settingsDialog").showModal();
  clearSettingsDirty();
  if (activeSettingsCategory === "Yapay Zeka Servisleri") {
    checkAiServiceUrls();
  }
}

function renderSystemSettings(groups) {
  const container = $("settingsGroups");
  container.innerHTML = "";
  if (!groups.length) {
    container.textContent = "Ayar bulunamadı.";
    return;
  }

  const usersCategory = "__users";
  const auditCategory = "__audit";
  const overviewCategory = "__overview";
  const categories = [overviewCategory, ...groups.map((g) => g.category), usersCategory, auditCategory];
  if (!activeSettingsCategory || !categories.includes(activeSettingsCategory)) {
    activeSettingsCategory = overviewCategory;
  }

  const layout = document.createElement("div");
  layout.className = "settings-layout";

  const nav = document.createElement("nav");
  nav.className = "settings-nav";
  nav.setAttribute("aria-label", "Ayar kategorileri");

  for (const category of categories) {
    if (category === overviewCategory || category === usersCategory || category === auditCategory || groups.some((g) => g.category === category)) {
      const meta = settingsCategoryMeta(category);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `settings-nav-item ${category === activeSettingsCategory ? "active" : ""}`;
      button.innerHTML = `
        <span class="settings-nav-icon">${meta.icon}</span>
        <span class="settings-nav-copy">
          <strong>${meta.label}</strong>
          <small>${meta.description}</small>
        </span>
      `;
      button.onclick = () => {
        syncRenderedSystemSettings();
        activeSettingsCategory = category;
        settingsSearchQuery = "";
        if ($("settingsSearchInput")) $("settingsSearchInput").value = "";
        renderSystemSettings(currentSettings);
        if (activeSettingsCategory === "Yapay Zeka Servisleri") checkAiServiceUrls();
      };
      nav.appendChild(button);
    }
  }
  layout.appendChild(nav);

  const content = document.createElement("div");
  content.className = "settings-content";

  if (activeSettingsCategory === overviewCategory) {
    $("saveSettingsBtn").classList.add("hidden");
    $("settingsHeaderSubtitle").textContent = settingsCategoryMeta(overviewCategory).description;
    renderSettingsOverview(content).catch((error) => {
      content.innerHTML = `<div class="settings-empty">${escapeHtml(friendlyError(error))}</div>`;
    });
    layout.appendChild(content);
    container.appendChild(layout);
    return;
  }

  if (activeSettingsCategory === usersCategory) {
    $("saveSettingsBtn").classList.add("hidden");
    $("settingsHeaderSubtitle").textContent = settingsCategoryMeta(usersCategory).description;
    content.innerHTML = `
      <section class="settings-panel user-admin-panel">
        <div class="settings-panel-header">
          <div>
            <h3>Kullanıcı Yönetimi</h3>
            <p>Kullanıcı, rol ve grup yönetimi.</p>
          </div>
          <button id="refreshUserAdminBtn" type="button" class="ghost">Yenile</button>
        </div>
        <div class="user-admin-grid">
          <section class="user-admin-card">
            <h4>Kullanıcı Oluştur</h4>
            <input id="newUserUsername" placeholder="Kullanıcı adı" autocomplete="off" />
            <input id="newUserDisplayName" placeholder="Ad Soyad" autocomplete="off" />
            <input id="newUserEmail" placeholder="E-posta" autocomplete="off" />
            <input id="newUserPassword" type="password" placeholder="Geçici şifre" autocomplete="new-password" />
            <div>
              <strong>Roller</strong>
              <div id="newUserRoles" class="user-admin-options"></div>
            </div>
            <div>
              <strong>Gruplar</strong>
              <div id="newUserGroups" class="user-admin-options empty">Grup yok.</div>
            </div>
            <button id="createAdminUserBtn" type="button">Kullanıcı Oluştur</button>
          </section>
          <section class="user-admin-card">
            <h4>Grup Oluştur</h4>
            <input id="newGroupName" placeholder="Grup adı" autocomplete="off" />
            <input id="newGroupDescription" placeholder="Açıklama" autocomplete="off" />
            <button id="createAdminGroupBtn" type="button">Grup Oluştur</button>
            <h4>Gruplar</h4>
            <div id="adminGroupList" class="admin-list empty">Grup yok.</div>
          </section>
        </div>
        <section class="user-admin-card">
          <h4>Kullanıcılar</h4>
          <div id="adminUserList" class="admin-list empty">Kullanıcılar yükleniyor...</div>
        </section>
        <small id="userAdminStatus" class="muted">Kullanıcı yönetimi hazır.</small>
      </section>
    `;
    layout.appendChild(content);
    container.appendChild(layout);
    bindUserAdminPanel();
    loadUserAdmin().catch((error) => {
      $("userAdminStatus").textContent = error.message;
    });
    return;
  }

  if (activeSettingsCategory === auditCategory) {
    $("saveSettingsBtn").classList.add("hidden");
    $("settingsHeaderSubtitle").textContent = settingsCategoryMeta(auditCategory).description;
    content.innerHTML = `
      <section class="settings-panel audit-settings-panel">
        <div class="settings-panel-header">
          <div>
            <h3>SOC / Denetim</h3>
            <p>Güvenlik ve klinik denetim kayıtları.</p>
          </div>
          <button id="settingsRefreshAuditBtn" type="button" class="ghost">Denetimi Yenile</button>
        </div>
        <pre id="settingsAuditLog">Denetim kayıtları yükleniyor...</pre>
        <small id="settingsAuditStatus" class="muted">Denetim kayıtları yükleniyor.</small>
      </section>
    `;
    layout.appendChild(content);
    container.appendChild(layout);
    $("settingsRefreshAuditBtn").onclick = () => loadSettingsAudit().catch((error) => {
      $("settingsAuditLog").textContent = error.message;
    });
    loadSettingsAudit().catch((error) => {
      $("settingsAuditLog").textContent = error.message;
    });
    return;
  }

  $("saveSettingsBtn").classList.remove("hidden");
  const group = groups.find((item) => item.category === activeSettingsCategory);
  const meta = settingsCategoryMeta(activeSettingsCategory);
  $("settingsHeaderSubtitle").textContent = meta.description;
  const visibleSettings = filteredSettingsInGroup(group);

  const section = document.createElement("section");
  section.className = "settings-panel";
  section.innerHTML = `
    <div class="settings-panel-header">
      <div>
        <h3>${escapeHtml(group.category)}</h3>
        <p>${escapeHtml(meta.description)}</p>
      </div>
      ${group.category === "Yapay Zeka Servisleri" ? aiServiceActions() : ""}
      ${group.category === "PACS / DICOM" ? pacsServiceActions() : ""}
    </div>
    ${
      visibleSettings.length
        ? `<div class="settings-grid">${visibleSettings.map((setting) => renderSettingField(setting)).join("")}</div>`
        : `<div class="settings-empty">Aramanızla eşleşen ayar bulunamadı.</div>`
    }
  `;
  content.appendChild(section);
  layout.appendChild(content);
  container.appendChild(layout);
  bindSettingsChangeTracking();
  document.querySelectorAll("[data-boolean-setting]").forEach((input) => {
    input.onchange = () => {
      const label = input.closest(".setting-toggle")?.querySelector("span:last-child");
      if (label) label.textContent = input.checked ? "Etkin" : "Kapalı";
      markSettingsDirty();
    };
  });
  restoreDirtyUiState();
}

function pacsServiceActions() {
  return `
    <div class="settings-actions">
      <button type="button" class="ghost" onclick="testPacsConnection()">PACS Bağlantısını Test Et</button>
    </div>
  `;
}

async function testPacsConnection() {
  $("settingsStatus").textContent = "PACS / DICOMweb bağlantısı test ediliyor...";
  try {
    const health = await fetch("/healthz/deps").then((r) => r.json());
    const ok = health.dependencies?.dicomweb?.ok;
    $("settingsStatus").textContent = ok ? "PACS / DICOMweb bağlantısı aktif." : "PACS / DICOMweb bağlantısı başarısız.";
    $("settingsStatus").classList.toggle("dirty", !ok);
  } catch (error) {
    $("settingsStatus").textContent = friendlyError(error);
  }
}

async function resetSettingsChanges() {
  if (!settingsSnapshot) return;
  const snapshot = JSON.parse(settingsSnapshot);
  currentSettings.forEach((group) => {
    group.settings.forEach((setting) => {
      if (snapshot[setting.key] !== undefined) setting.value = snapshot[setting.key];
    });
  });
  renderSystemSettings(currentSettings);
  clearSettingsDirty();
  $("settingsStatus").textContent = "Değişiklikler geri alındı.";
}

function urlStatusDot(key) {
  if (key === "ai.text_base_url") {
    return '<span id="textModelUrlStatus" class="status-dot unknown" title="Dil modeli URL kontrol edilmedi"></span>';
  }
  if (key === "ai.transcription_base_url") {
    return '<span id="transcriptionUrlStatus" class="status-dot unknown" title="Transkripsiyon URL kontrol edilmedi"></span>';
  }
  return "";
}

function modelDatalist(key) {
  if (key === "ai.text_model") return 'list="textModelOptions"';
  if (key === "ai.transcription_model") return 'list="transcriptionModelOptions"';
  return "";
}

function modelDatalistElement(key) {
  if (key === "ai.text_model") return '<datalist id="textModelOptions"></datalist>';
  if (key === "ai.transcription_model") return '<datalist id="transcriptionModelOptions"></datalist>';
  return "";
}

function aiServiceActions() {
  return `
    <div class="settings-actions">
      <button type="button" class="ghost settings-action-btn" onclick="fetchAiModels('text')">Dil Modellerini Getir</button>
      <button type="button" class="ghost settings-action-btn" onclick="fetchAiModels('transcription')">Transkripsiyon Modellerini Getir</button>
      <button type="button" class="ghost settings-action-btn" onclick="checkAiServiceUrls(); loadSettingsHealth().catch(() => {})">Servisleri Kontrol Et</button>
    </div>
  `;
}

function collectSystemSettings() {
  syncRenderedSystemSettings();
  const updates = {};
  currentSettings.forEach((group) => {
    group.settings.forEach((setting) => {
      updates[setting.key] = setting.value;
    });
  });
  return updates;
}

function syncRenderedSystemSettings() {
  document.querySelectorAll("[data-setting-key]").forEach((input) => {
    const setting = currentSettings
      .flatMap((group) => group.settings)
      .find((item) => item.key === input.dataset.settingKey);
    if (!setting) return;
    if (input.dataset.booleanSetting === "true") {
      setting.value = input.checked ? "true" : "false";
      return;
    }
    setting.value = input.value;
  });
}

function bindUserAdminPanel() {
  $("refreshUserAdminBtn").onclick = () => loadUserAdmin().catch((error) => {
    $("userAdminStatus").textContent = error.message;
  });
  $("createAdminUserBtn").onclick = () => createAdminUser().catch((error) => {
    $("userAdminStatus").textContent = `Kullanıcı oluşturulamadı: ${error.message}`;
  });
  $("createAdminGroupBtn").onclick = () => createAdminGroup().catch((error) => {
    $("userAdminStatus").textContent = `Grup oluşturulamadı: ${error.message}`;
  });
  renderUserAdminPanel();
}

async function loadUserAdmin() {
  const [users, roles, groups] = await Promise.all([
    api("/admin/users"),
    api("/admin/roles"),
    api("/admin/groups"),
  ]);
  userAdminState = { users, roles, groups };
  renderUserAdminPanel();
  $("userAdminStatus").textContent = "Kullanıcı, rol ve grup bilgileri yüklendi.";
}

function renderUserAdminPanel() {
  if (!$("newUserRoles")) return;
  $("newUserRoles").innerHTML = userAdminState.roles
    .map(
      (role) => `
        <label class="option-pill">
          <input type="checkbox" name="newUserRole" value="${escapeHtml(role.name)}" ${role.name === "viewer" ? "checked" : ""} />
          <span>${escapeHtml(role.label)}</span>
        </label>
      `
    )
    .join("");

  $("newUserGroups").classList.toggle("empty", !userAdminState.groups.length);
  $("newUserGroups").innerHTML = userAdminState.groups.length
    ? userAdminState.groups
        .map(
          (group) => `
            <label class="option-pill">
              <input type="checkbox" name="newUserGroup" value="${escapeHtml(group.id)}" />
              <span>${escapeHtml(group.name)}</span>
            </label>
          `
        )
        .join("")
    : "Grup yok.";

  $("adminGroupList").classList.toggle("empty", !userAdminState.groups.length);
  $("adminGroupList").innerHTML = userAdminState.groups.length
    ? userAdminState.groups
        .map((group) => `<div><strong>${escapeHtml(group.name)}</strong><span>${escapeHtml(group.description || "Açıklama yok")}</span></div>`)
        .join("")
    : "Grup yok.";

  $("adminUserList").classList.toggle("empty", !userAdminState.users.length);
  $("adminUserList").innerHTML = userAdminState.users.length
    ? userAdminState.users
        .map(
          (user) => `
            <div>
              <strong>${escapeHtml(user.display_name || user.username)}</strong>
              <span>${escapeHtml(user.username)} · ${escapeHtml(user.roles.join(", ") || "rol yok")}</span>
              <small>${escapeHtml(user.groups.map((group) => group.name).join(", ") || "grup yok")}</small>
            </div>
          `
        )
        .join("")
    : "Kullanıcı yok.";
}

async function createAdminUser() {
  const payload = {
    username: $("newUserUsername").value,
    display_name: $("newUserDisplayName").value,
    email: $("newUserEmail").value,
    password: $("newUserPassword").value,
    roles: Array.from(document.querySelectorAll('input[name="newUserRole"]:checked')).map((input) => input.value),
    group_ids: Array.from(document.querySelectorAll('input[name="newUserGroup"]:checked')).map((input) => input.value),
  };
  await api("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  ["newUserUsername", "newUserDisplayName", "newUserEmail", "newUserPassword"].forEach((id) => {
    $(id).value = "";
  });
  $("userAdminStatus").textContent = "Kullanıcı oluşturuldu.";
  await loadUserAdmin();
}

async function createAdminGroup() {
  const payload = {
    name: $("newGroupName").value,
    description: $("newGroupDescription").value,
  };
  await api("/admin/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  $("newGroupName").value = "";
  $("newGroupDescription").value = "";
  $("userAdminStatus").textContent = "Grup oluşturuldu.";
  await loadUserAdmin();
}

async function saveSystemSettings(event) {
  event.preventDefault();
  await saveCurrentSystemSettings();
  clearSettingsDirty();
  $("settingsStatus").textContent = "Kaydedildi. Servisler yeni değerleri sonraki istekte kullanacak.";
}

async function saveCurrentSystemSettings() {
  await api("/admin/system-settings", {
    method: "PUT",
    body: JSON.stringify({ settings: collectSystemSettings() }),
  });
}

async function checkAiServiceUrls() {
  fetchAiModels("text", { preserveModel: true, quiet: true }).catch(() => {});
  fetchAiModels("transcription", { preserveModel: true, quiet: true }).catch(() => {});
}

async function fetchAiModels(kind, options = {}) {
  const isText = kind === "text";
  const dot = $(isText ? "textModelUrlStatus" : "transcriptionUrlStatus");
  const datalist = $(isText ? "textModelOptions" : "transcriptionModelOptions");
  const modelInput = document.querySelector(`[data-setting-key="${isText ? "ai.text_model" : "ai.transcription_model"}"]`);
  const label = isText ? "dil modeli" : "transkripsiyon";

  if (dot) setUrlStatus(dot, "checking", `${label} URL kontrol ediliyor`);
  if (!options.quiet) $("settingsStatus").textContent = `${label} URL kontrol ediliyor ve modeller getiriliyor...`;

  try {
    await saveCurrentSystemSettings();
    const data = await api(`/ai/models/${isText ? "text" : "transcription"}`);
    const models = data.models || [];
    if (datalist) {
      datalist.innerHTML = models.map((model) => `<option value="${escapeHtml(model)}"></option>`).join("");
    }
    if (modelInput && models.length && (!modelInput.value || !options.preserveModel)) {
      modelInput.value = models[0];
    }
    if (dot) setUrlStatus(dot, "ok", `${label} URL aktif`);
    $("settingsStatus").textContent = `${models.length} ${label} modeli getirildi.`;
    return models;
  } catch (error) {
    if (dot) setUrlStatus(dot, "error", `${label} URL pasif`);
    if (!options.quiet) $("settingsStatus").textContent = `${label} getirme başarısız: ${error.message}`;
    throw error;
  }
}

function setUrlStatus(dot, state, title) {
  dot.classList.remove("unknown", "checking", "ok", "error");
  dot.classList.add(state);
  dot.title = title;
}

async function openArchive() {
  $("archiveDialog").showModal();
  await loadArchive();
}

async function loadArchive() {
  const params = new URLSearchParams();
  if (selectedStudy?.id) params.set("study_id", selectedStudy.id);
  const items = await api(`/recordings?${params.toString()}`);
  const list = $("archiveList");
  list.innerHTML = "";
  if (!items.length) {
    list.classList.add("empty");
    list.textContent = currentLanguage === "en" ? "No recordings found." : "Kayıt bulunamadı.";
    $("archiveStatus").textContent = "0 kayıt";
    return;
  }
  list.classList.remove("empty");
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "archive-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.filename)}</strong>
        <span>${escapeHtml(new Date(item.created_at).toLocaleString("tr-TR"))}</span>
      </div>
      <div class="archive-item-actions">
        ${item.has_audio ? `<button type="button" class="ghost" data-play="${item.id}">Dinle</button>` : ""}
        <button type="button" class="ghost" data-restore="${item.id}">Yükle</button>
      </div>
    `;
    list.appendChild(row);
  }
  list.querySelectorAll("[data-play]").forEach((button) => {
    button.onclick = () => playArchiveAudio(button.dataset.play);
  });
  list.querySelectorAll("[data-restore]").forEach((button) => {
    button.onclick = () => restoreArchiveRecording(button.dataset.restore).catch((error) => {
      $("archiveStatus").textContent = friendlyError(error);
    });
  });
  $("archiveStatus").textContent = `${items.length} kayıt listelendi.`;
}

async function playArchiveAudio(recordingId) {
  const response = await fetch(`/api/v1/recordings/${recordingId}/audio`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`${response.status}: audio fetch failed`);
  const blob = await response.blob();
  const player = $("archiveAudioPlayer");
  player.classList.remove("hidden");
  player.src = URL.createObjectURL(blob);
  player.load();
  player.play().catch(() => {});
}

async function restoreArchiveRecording(recordingId) {
  const data = await api(`/recordings/${recordingId}/restore`, { method: "POST", body: "{}" });
  $("transcript").value = data.transcript || "";
  $("report").value = data.structured_report || "";
  currentRecordingId = data.id;
  $("archiveStatus").textContent = currentLanguage === "en" ? "Recording restored." : "Kayıt editöre yüklendi.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

$("loginBtn").onclick = () => login().catch((error) => setStatus(error.message));
$("searchBtn").onclick = () => searchStudies().catch((error) => setStatus(error.message));
$("todayBtn").onclick = () => setTodayRange();
$("clearSearchBtn").onclick = () => clearSearch();
$("templatesBtn").onclick = () => openTemplates().catch((error) => ($("templatesStatus").textContent = error.message));
$("archiveBtn").onclick = () => openArchive().catch((error) => ($("archiveStatus").textContent = friendlyError(error)));
$("refreshArchiveBtn").onclick = () => loadArchive().catch((error) => ($("archiveStatus").textContent = friendlyError(error)));
$("shortcutsBtn").onclick = () => $("shortcutsDialog").showModal();
$("transcript").oninput = () => {
  scheduleAutoSave();
  updateWorkflowSteps();
};
$("report").oninput = () => {
  scheduleAutoSave();
  updateReportMetrics();
  updateWorkflowSteps();
};
$("reportStatusSelect").onchange = () => {
  scheduleAutoSave();
  applyReportStatusChip($("reportStatusSelect").value);
  updatePatientReportStatus($("reportStatusSelect").value);
  updateClinicalContextBar();
};
$("toggleFiltersBtn")?.addEventListener("click", () => {
  const panel = $("worklistFilters");
  const btn = $("toggleFiltersBtn");
  if (!panel || !btn) return;
  const collapsed = panel.classList.toggle("collapsed");
  btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
});
$("userProfileButton").onclick = (event) => {
  event.stopPropagation();
  toggleUserMenu();
};
$("userSettingsMenuBtn").onclick = () => openUserSettings();
$("saveUserSettingsBtn").onclick = () => saveUserSettings().catch((error) => {
  $("userSettingsStatus").textContent = `Profil kaydedilemedi: ${error.message}`;
});
$("logoutMenuBtn").onclick = () => logout();
$("reportTemplatePickerBtn").onclick = (event) => {
  event.stopPropagation();
  toggleReportTemplateFlyout();
};
$("reportTemplateSearch").oninput = () => renderReportTemplateSelect();
$("reportTemplateSelect").onchange = () => applySelectedTemplate();
window.addEventListener("resize", () => {
  if (!$("reportTemplateFlyout")?.classList.contains("hidden")) positionTemplateFlyout();
  document.querySelectorAll(".flyout-item.is-open").forEach((item) => {
    positionFlyoutSubmenu(item, item.querySelector(".flyout-submenu"));
  });
});
document.querySelector(".report")?.addEventListener("scroll", () => {
  if (!$("reportTemplateFlyout")?.classList.contains("hidden")) positionTemplateFlyout();
  document.querySelectorAll(".flyout-item.is-open").forEach((item) => {
    positionFlyoutSubmenu(item, item.querySelector(".flyout-submenu"));
  });
}, { passive: true });
document.querySelector(".flyout-menu")?.addEventListener("scroll", () => {
  document.querySelectorAll(".flyout-item.is-open").forEach((item) => {
    positionFlyoutSubmenu(item, item.querySelector(".flyout-submenu"));
  });
}, { passive: true });
$("applyTemplateBtn").onclick = () => applySelectedTemplate();
$("saveTemplateBtn").onclick = () => saveTemplate().catch((error) => ($("templatesStatus").textContent = error.message));
$("recordAudioBtn").onclick = () => startAudioRecording().catch((error) => setAudioStatus(error.message));
$("stopAudioBtn").onclick = () => stopAudioRecording();
$("uploadAudioBtn").onclick = () => $("audioFileInput").click();
$("audioFileInput").onchange = () => transcribeUploadedAudio().catch((error) => setAudioStatus(`Transkripsiyon başarısız: ${error.message}`));
$("formatBtn").onclick = () => formatReport().catch((error) => setReportState(friendlyError(error)));
$("downloadPdfBtn").onclick = () => downloadReportPdf().catch((error) => setReportState(error.message));
$("sendPacsBtn").onclick = () => sendReportToPacs().catch((error) => setReportState(error.message));
$("refreshAuditBtn").onclick = (event) => {
  event.preventDefault();
  loadAudit().catch((error) => ($("auditLog").textContent = error.message));
};
$("themeBtn").onclick = () => toggleTheme();
$("systemSettingsBtn").onclick = () => openSystemSettings().catch((error) => setStatus(error.message));
$("saveSettingsBtn").onclick = (event) => saveSystemSettings(event).catch((error) => ($("settingsStatus").textContent = friendlyError(error)));
$("resetSettingsBtn").onclick = () => resetSettingsChanges().catch((error) => ($("settingsStatus").textContent = friendlyError(error)));
$("settingsSearchInput")?.addEventListener("input", (event) => {
  syncRenderedSystemSettings();
  settingsSearchQuery = event.target.value;
  if (activeSettingsCategory === "__overview") activeSettingsCategory = currentSettings[0]?.category || "Yapay Zeka Servisleri";
  renderSystemSettings(currentSettings);
});
$("languageSelect").onchange = (event) => changeLanguage(event.target.value);

document.addEventListener("click", (event) => {
  if (!$("userProfileMenu").classList.contains("hidden") && !event.target.closest(".sidebar-user")) {
    closeUserMenu();
  }
  if (!$("reportTemplateFlyout").classList.contains("hidden") && !event.target.closest(".template-combobox") && !event.target.closest(".template-flyout") && !event.target.closest(".flyout-submenu")) {
    closeReportTemplateFlyout();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeUserMenu();
    closeReportTemplateFlyout();
  }
  if (event.key === "?") {
    $("shortcutsDialog").showModal();
    return;
  }
  if (event.target.matches("input, textarea, select")) return;
  if (event.key.toLowerCase() === "s") saveReport().catch(console.error);
  if (event.key.toLowerCase() === "r") $("transcript").focus();
});

if (token) {
  api("/auth/me")
    .then((me) => {
      currentUser = me;
      showApp();
      updateAdminVisibility();
      updateUserProfile();
      applyTranslations();
      scheduleSessionRefresh();
      setStatus(`Oturum: ${me.display_name || me.username} (${me.roles.join(", ")})`);
      loadReportTemplates().catch(() => renderReportTemplateSelect());
    })
    .catch(() => {
      token = "";
      removeStoredItem("token");
      currentUser = null;
      updateAdminVisibility();
      resetUserProfile();
      showLogin();
    });
} else {
  showLogin();
}

loadReadyReportTemplates();
initLanguageSelector();
applyTranslations();
applyTheme(currentTheme);
clearWaveform();
updateReportMetrics();
updateWorkflowSteps();
