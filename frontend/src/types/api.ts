// TypeScript mirrors of backend schemas (backend/app/schemas.py).

export type RoleName =
  | "radiologist"
  | "reporter"
  | "technician"
  | "admin"
  | "viewer"
  | "external_consultant";

/** Any role slug, including custom roles from Yönetim → Roller. */
export type RoleSlug = RoleName | (string & {});

export type ReportStatus = "draft" | "preliminary" | "signed" | "amended";

export type StudyPriority = "routine" | "urgent" | "stat";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
  expires_in: number;
}

export interface UserOut {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  roles: RoleSlug[];
  permissions: string[];
}

export interface StudyOut {
  id: string;
  study_instance_uid: string;
  accession_number?: string | null;
  modality?: string | null;
  study_date?: string | null;
  study_description?: string | null;
  status: string;
  priority?: StudyPriority | null;
  report_status?: ReportStatus | null;
  patient_name?: string | null;
  patient_tc?: string | null;
}

export interface ReportOut {
  id: string;
  study_id: string;
  author_id: string;
  status: ReportStatus;
  content: string;
  transcript?: string | null;
  version: number;
  signed_at?: string | null;
  created_at: string;
}

export interface ReportVersionOut {
  id: string;
  report_id: string;
  version: number;
  status: ReportStatus;
  content: string;
  transcript?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  created_at: string;
}

export interface ReportTemplateOut {
  id: string;
  owner_id: string;
  modality: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DictationRecordingOut {
  id: string;
  study_id?: string | null;
  filename: string;
  content_type?: string | null;
  transcript?: string | null;
  structured_report?: string | null;
  has_audio: boolean;
  created_at: string;
}

export interface TranscriptionResponse {
  text: string;
  model: string;
  recording_id: string;
}

export interface FormatReportResponse {
  report: string;
  model: string;
  recording_id?: string | null;
  saved_report?: ReportOut | null;
}

export interface AiAssistantMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiAssistantResponse {
  reply: string;
  model: string;
}

export interface AiSuggestionResponse {
  result: string;
  model: string;
  kind: string;
}

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: PermissionDef[];
}

export interface AdminRoleOut {
  id: string;
  slug: string;
  label: string;
  description?: string | null;
  is_builtin: boolean;
  permissions: string[];
  user_count: number;
}

export interface AdminRoleCreate {
  label: string;
  slug?: string;
  description?: string;
  permissions: string[];
}

export interface AdminRoleUpdate {
  label?: string;
  description?: string;
  permissions?: string[];
}

export interface AdminGroupOut {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface AdminUserOut {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  auth_provider: string;
  is_active: boolean;
  roles: RoleSlug[];
  groups: AdminGroupOut[];
  created_at: string;
}

export interface LicenseFeature {
  key: string;
  label: string;
}

export interface LicenseInfo {
  edition: "standard" | "enterprise";
  raw_edition: string;
  is_enterprise: boolean;
  valid: boolean;
  licensed_to: string;
  seats: string;
  activated_at: string;
  expires_at: string;
  enterprise_features: LicenseFeature[];
  standard_features: LicenseFeature[];
}

export interface AuditEvent {
  id: number;
  occurred_at: string;
  actor_user_id?: string | null;
  actor_username?: string | null;
  actor_display_name?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  ip_address?: string | null;
  metadata: Record<string, unknown>;
  integrity_hash: string;
}

export interface SystemSettingOut {
  key: string;
  value: string;
  category: string;
  label: string;
  description?: string | null;
  is_secret: boolean;
}

export interface SystemSettingsGroup {
  category: string;
  settings: SystemSettingOut[];
}

export interface HealthDependency {
  ok: boolean;
  status_code?: number;
  error?: string;
}

export interface HealthDeps {
  status: string;
  service: string;
  environment: string;
  dependencies: Record<string, HealthDependency>;
}

// Analytics (new backend endpoints)
export interface DashboardMetrics {
  reports_today: number;
  reports_signed_today: number;
  pending_dictations: number;
  transcription_queue: number;
  avg_turnaround_minutes: number | null;
  studies_total: number;
  reports_by_status: Record<string, number>;
  recent_activity: ActivityItem[];
  modality_breakdown: { modality: string; count: number }[];
  weekly_trend: { date: string; created: number; signed: number }[];
}

export interface ActivityItem {
  id: string;
  action: string;
  resource_type: string;
  occurred_at: string;
  actor_name?: string | null;
  summary: string;
}

export interface ProductivityRow {
  user_id: string;
  display_name: string;
  reports_created: number;
  reports_signed: number;
  avg_turnaround_minutes: number | null;
  ai_formats: number;
}

export interface AnalyticsKpis {
  total_reports: number;
  signed_rate: number;
  avg_turnaround_minutes: number | null;
  ai_usage_count: number;
  transcriptions: number;
  active_radiologists: number;
}

export interface TrendPoint {
  date: string;
  reports: number;
  signed: number;
  transcriptions: number;
}

export interface PatientSummary {
  id: string;
  patient_name?: string | null;
  patient_tc?: string | null;
  study_count: number;
  last_study_date?: string | null;
  modalities: string[];
}

export interface PatientTimelineEntry {
  study_id: string;
  accession_number?: string | null;
  modality?: string | null;
  study_date?: string | null;
  study_description?: string | null;
  report_status?: ReportStatus | null;
}
