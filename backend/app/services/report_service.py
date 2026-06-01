from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Report, ReportStatus, ReportVersion, Study, User


def get_latest_report(db: Session, study_id: UUID) -> Report | None:
    return db.scalar(
        select(Report)
        .where(Report.study_id == study_id)
        .order_by(Report.version.desc(), Report.created_at.desc())
        .limit(1)
    )


def snapshot_report_version(db: Session, report: Report, author_id: UUID | None = None) -> ReportVersion:
    """Persist an immutable snapshot of the report's current state."""
    snapshot = ReportVersion(
        report_id=report.id,
        version=report.version,
        status=report.status,
        content=report.content,
        transcript=report.transcript,
        author_id=author_id or report.author_id,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def latest_status_map(db: Session, study_ids: list[UUID]) -> dict[UUID, ReportStatus]:
    """Return the latest report status per study id."""
    if not study_ids:
        return {}
    rows = db.execute(
        select(Report.study_id, Report.status, Report.version)
        .where(Report.study_id.in_(study_ids))
        .order_by(Report.study_id, Report.version.desc())
    ).all()
    result: dict[UUID, ReportStatus] = {}
    for study_id, status, _version in rows:
        if study_id not in result:
            result[study_id] = status
    return result


def list_report_versions(db: Session, report_id: UUID) -> list[ReportVersion]:
    return list(
        db.scalars(
            select(ReportVersion)
            .where(ReportVersion.report_id == report_id)
            .order_by(ReportVersion.version.desc(), ReportVersion.created_at.desc())
        )
    )


def upsert_study_report(
    db: Session,
    *,
    study_id: UUID,
    author: User,
    content: str,
    transcript: str | None = None,
    status: ReportStatus = ReportStatus.draft,
) -> Report:
    if not db.get(Study, study_id):
        raise ValueError("Study not found")

    latest = get_latest_report(db, study_id)
    if latest and latest.status == ReportStatus.draft and latest.author_id == author.id:
        latest.content = content
        if transcript is not None:
            latest.transcript = transcript
        latest.version += 1
        latest.status = status
        db.commit()
        db.refresh(latest)
        snapshot_report_version(db, latest, author.id)
        return latest

    next_version = db.scalar(select(func.max(Report.version)).where(Report.study_id == study_id)) or 0
    report = Report(
        study_id=study_id,
        author_id=author.id,
        status=status,
        content=content,
        transcript=transcript,
        version=next_version + 1,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    snapshot_report_version(db, report, author.id)
    return report
