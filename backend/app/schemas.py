from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import ReportStatus


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str = ""


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    display_name: str | None = None
    email: str | None = None
    roles: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class UserProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=256)
    email: str | None = Field(default=None, max_length=256)


class AdminGroupCreate(BaseModel):
    name: str
    description: str | None = None


class AdminGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    created_at: datetime


class AdminUserCreate(BaseModel):
    username: str
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = None
    email: str | None = None
    roles: list[str] = Field(default_factory=list)
    group_ids: list[UUID] = Field(default_factory=list)


class AdminUserOut(BaseModel):
    id: UUID
    username: str
    display_name: str | None = None
    email: str | None = None
    auth_provider: str
    is_active: bool
    roles: list[str] = Field(default_factory=list)
    groups: list[AdminGroupOut] = Field(default_factory=list)
    created_at: datetime


class AdminRoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    label: str
    description: str | None = None
    is_builtin: bool = False
    permissions: list[str] = Field(default_factory=list)
    user_count: int = 0


class AdminRoleCreate(BaseModel):
    label: str = Field(min_length=1, max_length=128)
    slug: str | None = Field(default=None, max_length=64)
    description: str | None = None
    permissions: list[str] = Field(default_factory=list)


class AdminRoleUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = None
    permissions: list[str] | None = None


class PermissionGroupOut(BaseModel):
    key: str
    label: str
    permissions: list[dict]


class AuthVerifyRequest(BaseModel):
    """Optional draft LDAP settings and test user credentials."""

    settings: dict[str, str] = Field(default_factory=dict)
    test_username: str | None = None
    test_password: str | None = None


class AuthVerifyCheck(BaseModel):
    id: str
    label: str
    ok: bool
    detail: str | None = None


class AuthVerifyResponse(BaseModel):
    ok: bool
    mode: str
    message: str
    checks: list[AuthVerifyCheck] = Field(default_factory=list)


class StudySearchParams(BaseModel):
    patient: str | None = None
    accession_number: str | None = None
    modality: str | None = None
    from_date: date | None = None
    to_date: date | None = None


class StudyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    study_instance_uid: str
    accession_number: str | None
    modality: str | None
    study_date: date | None
    study_description: str | None
    status: str
    priority: str | None = "routine"
    report_status: ReportStatus | None = None
    patient_name: str | None = None
    patient_tc: str | None = None


class SeriesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    series_instance_uid: str
    modality: str | None
    series_number: int | None
    body_part: str | None
    image_count: int


class InstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sop_instance_uid: str
    instance_number: int | None
    storage_uri: str | None
    dicom_tags: dict


class ReportCreate(BaseModel):
    content: str
    transcript: str | None = None
    status: ReportStatus = ReportStatus.draft


class ReportUpdate(BaseModel):
    content: str
    transcript: str | None = None
    status: ReportStatus = ReportStatus.draft


class ReportPdfRequest(BaseModel):
    content: str
    patient_label: str | None = None
    accession_number: str | None = None
    modality: str | None = None
    study_date: str | None = None
    study_description: str | None = None


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    study_id: UUID
    author_id: UUID
    status: ReportStatus
    content: str
    transcript: str | None = None
    version: int
    signed_at: datetime | None
    created_at: datetime


class ReportPacsSendResponse(BaseModel):
    report: ReportOut
    pacs_status: dict


class LicenseActivateRequest(BaseModel):
    key: str


class LicenseIssueRequest(BaseModel):
    licensed_to: str
    seats: int = 0
    valid_days: int = 365
    edition: str = "enterprise"


class ReportTemplateCreate(BaseModel):
    modality: str
    title: str
    content: str


class ReportTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    modality: str
    title: str
    content: str
    created_at: datetime
    updated_at: datetime


class PacsQueryRequest(BaseModel):
    patient_id: str | None = None
    accession_number: str | None = None
    modality: str | None = None
    study_date: str | None = None


class PacsRetrieveRequest(BaseModel):
    study_instance_uid: str
    destination_ae_title: str | None = None


class TranscriptionResponse(BaseModel):
    text: str
    model: str
    recording_id: UUID


class FormatReportRequest(BaseModel):
    transcript: str
    template: str | None = None
    recording_id: UUID | None = None
    study_id: UUID | None = None


class FormatReportResponse(BaseModel):
    report: str
    model: str
    recording_id: UUID
    saved_report: ReportOut | None = None


class DictationRecordingOut(BaseModel):
    id: UUID
    study_id: UUID | None
    filename: str
    content_type: str | None
    transcript: str | None
    structured_report: str | None
    has_audio: bool
    created_at: datetime


class DictationRecordingRestore(BaseModel):
    id: UUID
    transcript: str | None
    structured_report: str | None
    study_id: UUID | None


class SystemSettingOut(BaseModel):
    key: str
    value: str
    category: str
    label: str
    description: str | None = None
    is_secret: bool = False


class SystemSettingUpdate(BaseModel):
    value: str


class SystemSettingsUpdate(BaseModel):
    settings: dict[str, str]


class SystemSettingsGroup(BaseModel):
    category: str
    settings: list[SystemSettingOut]


class ActivityItem(BaseModel):
    id: str
    action: str
    resource_type: str
    occurred_at: datetime
    actor_name: str | None = None
    summary: str


class ModalityCount(BaseModel):
    modality: str
    count: int


class TrendBar(BaseModel):
    date: str
    created: int
    signed: int


class DashboardMetrics(BaseModel):
    reports_today: int
    reports_signed_today: int
    pending_dictations: int
    transcription_queue: int
    avg_turnaround_minutes: float | None = None
    studies_total: int
    reports_by_status: dict[str, int] = Field(default_factory=dict)
    recent_activity: list[ActivityItem] = Field(default_factory=list)
    modality_breakdown: list[ModalityCount] = Field(default_factory=list)
    weekly_trend: list[TrendBar] = Field(default_factory=list)


class ProductivityRow(BaseModel):
    user_id: str
    display_name: str
    reports_created: int
    reports_signed: int
    avg_turnaround_minutes: float | None = None
    ai_formats: int


class AnalyticsKpis(BaseModel):
    total_reports: int
    signed_rate: float
    avg_turnaround_minutes: float | None = None
    ai_usage_count: int
    transcriptions: int
    active_radiologists: int


class TrendPoint(BaseModel):
    date: str
    reports: int
    signed: int
    transcriptions: int


class PatientSummary(BaseModel):
    id: UUID
    patient_name: str | None = None
    patient_tc: str | None = None
    study_count: int
    last_study_date: date | None = None
    modalities: list[str] = Field(default_factory=list)


class PatientTimelineEntry(BaseModel):
    study_id: UUID
    accession_number: str | None = None
    modality: str | None = None
    study_date: date | None = None
    study_description: str | None = None
    report_status: ReportStatus | None = None


class ReportVersionOut(BaseModel):
    id: UUID
    report_id: UUID
    version: int
    status: ReportStatus
    content: str
    transcript: str | None = None
    author_id: UUID | None = None
    author_name: str | None = None
    created_at: datetime


class AiAssistantMessage(BaseModel):
    role: str
    content: str


class AiAssistantRequest(BaseModel):
    messages: list[AiAssistantMessage]
    report_context: str | None = None


class AiAssistantResponse(BaseModel):
    reply: str
    model: str


class AiSuggestionRequest(BaseModel):
    text: str
    kind: str = "improve"


class AiSuggestionResponse(BaseModel):
    result: str
    model: str
    kind: str
