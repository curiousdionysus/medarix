import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, Integer, LargeBinary, String, Text, Time, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RoleName(str, enum.Enum):
    """Built-in role slugs (DB ``roles.slug``). Custom roles use arbitrary slugs."""

    radiologist = "radiologist"
    reporter = "reporter"
    technician = "technician"
    admin = "admin"
    viewer = "viewer"
    external_consultant = "external_consultant"


class ReportStatus(str, enum.Enum):
    draft = "draft"
    preliminary = "preliminary"
    signed = "signed"
    amended = "amended"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(256))
    email: Mapped[str | None] = mapped_column(String(256))
    auth_provider: Mapped[str] = mapped_column(String(32), default="local")
    password_hash: Mapped[str | None] = mapped_column(Text)
    ldap_dn: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    roles: Mapped[list["UserRole"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    groups: Mapped[list["UserGroup"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    label: Mapped[str] = mapped_column(String(128), default="")
    description: Mapped[str | None] = mapped_column(Text)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    permissions: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["UserRole"]] = relationship(back_populates="role", cascade="all, delete-orphan")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True)

    user: Mapped[User] = relationship(back_populates="roles")
    role: Mapped[Role] = relationship(back_populates="users")


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    members: Mapped[list["UserGroup"]] = relationship(back_populates="group", cascade="all, delete-orphan")


class UserGroup(Base):
    __tablename__ = "user_groups"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id"), primary_key=True)

    user: Mapped[User] = relationship(back_populates="groups")
    group: Mapped[Group] = relationship(back_populates="members")


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    patient_id_enc: Mapped[str | None] = mapped_column(Text)
    name_enc: Mapped[str | None] = mapped_column(Text)
    name_search: Mapped[str | None] = mapped_column(Text, index=True)
    birth_date: Mapped[datetime | None] = mapped_column(Date)
    sex: Mapped[str | None] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    studies: Mapped[list["Study"]] = relationship(back_populates="patient")


class Study(Base):
    __tablename__ = "studies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    study_instance_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    accession_number: Mapped[str | None] = mapped_column(String(64), index=True)
    modality: Mapped[str | None] = mapped_column(String(32), index=True)
    study_date: Mapped[date | None] = mapped_column(Date, index=True)
    study_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    study_description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="available")
    priority: Mapped[str] = mapped_column(String(16), default="routine")
    source_pacs_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient: Mapped[Patient] = relationship(back_populates="studies")
    series: Mapped[list["Series"]] = relationship(back_populates="study")
    reports: Mapped[list["Report"]] = relationship(back_populates="study")

    __table_args__ = (Index("idx_studies_date_modality", "study_date", "modality"),)


class Series(Base):
    __tablename__ = "series"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("studies.id"), index=True)
    series_instance_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    modality: Mapped[str | None] = mapped_column(String(32))
    series_number: Mapped[int | None] = mapped_column(Integer)
    body_part: Mapped[str | None] = mapped_column(String(64))
    image_count: Mapped[int] = mapped_column(Integer, default=0)

    study: Mapped[Study] = relationship(back_populates="series")
    instances: Mapped[list["Instance"]] = relationship(back_populates="series")


class Instance(Base):
    __tablename__ = "instances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    series_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("series.id"), index=True)
    sop_instance_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    instance_number: Mapped[int | None] = mapped_column(Integer)
    storage_uri: Mapped[str | None] = mapped_column(Text)
    dicom_tags: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    series: Mapped[Series] = relationship(back_populates="instances")

    __table_args__ = (Index("idx_instances_tags_gin", "dicom_tags", postgresql_using="gin"),)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    study_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("studies.id"), index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus), default=ReportStatus.draft)
    content: Mapped[str] = mapped_column(Text)
    transcript: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    study: Mapped[Study] = relationship(back_populates="reports")


class ReportVersion(Base):
    __tablename__ = "report_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("reports.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    status: Mapped[ReportStatus] = mapped_column(Enum(ReportStatus), default=ReportStatus.draft)
    content: Mapped[str] = mapped_column(Text)
    transcript: Mapped[str | None] = mapped_column(Text)
    author_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (Index("idx_report_versions_report", "report_id", "version"),)


class DictationRecording(Base):
    __tablename__ = "dictation_recordings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    study_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("studies.id"), index=True)
    filename: Mapped[str] = mapped_column(String(256))
    content_type: Mapped[str | None] = mapped_column(String(128))
    audio_data: Mapped[bytes | None] = mapped_column(LargeBinary)
    transcript: Mapped[str | None] = mapped_column(Text)
    structured_report: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class ReportTemplate(Base):
    __tablename__ = "report_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    modality: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(128))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (Index("idx_report_templates_owner_modality", "owner_id", "modality"),)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    action: Mapped[str] = mapped_column(String(128), index=True)
    resource_type: Mapped[str] = mapped_column(String(64), index=True)
    resource_id: Mapped[str | None] = mapped_column(String(128), index=True)
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    integrity_hash: Mapped[str] = mapped_column(String(128))

    __table_args__ = (
        UniqueConstraint("id", "integrity_hash", name="uq_audit_integrity_anchor"),
        Index("idx_audit_metadata_gin", "metadata", postgresql_using="gin"),
    )


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(64), index=True)
    label: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text)
    is_secret: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
