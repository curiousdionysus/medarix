"""Aggregation queries powering the Dashboard and Analytics modules."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    DictationRecording,
    Report,
    ReportStatus,
    Study,
    User,
)


def _start_of_today() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _interval_to_minutes(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, timedelta):
        return round(value.total_seconds() / 60.0, 1)
    try:
        return round(float(value) / 60.0, 1)
    except (TypeError, ValueError):
        return None


def _user_name_map(db: Session, user_ids: set[UUID]) -> dict[UUID, str]:
    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    rows = db.execute(select(User.id, User.display_name, User.username).where(User.id.in_(ids))).all()
    return {row[0]: (row[1] or row[2]) for row in rows}


_ACTION_LABELS = {
    "report.create": "rapor oluşturdu",
    "report.update": "raporu güncelledi",
    "report.sign": "raporu imzaladı",
    "report.send_to_pacs": "raporu PACS'e gönderdi",
    "report.download_pdf": "rapor PDF indirdi",
    "ai.transcribe": "ses kaydını yazıya döktü",
    "ai.format_report": "AI ile rapor düzenledi",
    "study.search": "çalışma arama yaptı",
    "study.open": "çalışma açtı",
    "auth.login": "sisteme giriş yaptı",
    "report_template.create": "şablon oluşturdu",
}


def _summarize(action: str, actor: str | None) -> str:
    label = _ACTION_LABELS.get(action, action)
    who = actor or "Sistem"
    return f"{who} {label}"


def recent_activity(db: Session, limit: int = 12) -> list[dict]:
    events = list(
        db.scalars(select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(limit))
    )
    names = _user_name_map(db, {e.actor_user_id for e in events if e.actor_user_id})
    items = []
    for e in events:
        actor = names.get(e.actor_user_id) if e.actor_user_id else None
        items.append(
            {
                "id": str(e.id),
                "action": e.action,
                "resource_type": e.resource_type,
                "occurred_at": e.occurred_at,
                "actor_name": actor,
                "summary": _summarize(e.action, actor),
            }
        )
    return items


def modality_breakdown(db: Session) -> list[dict]:
    rows = db.execute(
        select(Study.modality, func.count(Study.id))
        .group_by(Study.modality)
        .order_by(func.count(Study.id).desc())
    ).all()
    return [{"modality": (row[0] or "—"), "count": row[1]} for row in rows]


def weekly_trend(db: Session, days: int = 7) -> list[dict]:
    start = _start_of_today() - timedelta(days=days - 1)
    created_rows = dict(
        db.execute(
            select(func.date(Report.created_at), func.count(Report.id))
            .where(Report.created_at >= start)
            .group_by(func.date(Report.created_at))
        ).all()
    )
    signed_rows = dict(
        db.execute(
            select(func.date(Report.signed_at), func.count(Report.id))
            .where(Report.signed_at >= start)
            .group_by(func.date(Report.signed_at))
        ).all()
    )
    out = []
    for i in range(days):
        day = (start + timedelta(days=i)).date()
        out.append(
            {
                "date": day.isoformat(),
                "created": int(created_rows.get(day, 0)),
                "signed": int(signed_rows.get(day, 0)),
            }
        )
    return out


def dashboard_metrics(db: Session) -> dict:
    today = _start_of_today()

    reports_today = db.scalar(select(func.count(Report.id)).where(Report.created_at >= today)) or 0
    reports_signed_today = (
        db.scalar(select(func.count(Report.id)).where(Report.signed_at >= today)) or 0
    )
    pending_dictations = (
        db.scalar(
            select(func.count(DictationRecording.id)).where(
                DictationRecording.structured_report.is_(None)
            )
        )
        or 0
    )

    # Studies that do not yet have a report = reporting/transcription queue.
    reported_study_ids = select(Report.study_id.distinct())
    transcription_queue = (
        db.scalar(select(func.count(Study.id)).where(Study.id.notin_(reported_study_ids))) or 0
    )

    avg_turnaround = _interval_to_minutes(
        db.scalar(
            select(func.avg(Report.signed_at - Report.created_at)).where(
                Report.signed_at.isnot(None)
            )
        )
    )

    studies_total = db.scalar(select(func.count(Study.id))) or 0

    status_rows = db.execute(
        select(Report.status, func.count(Report.id)).group_by(Report.status)
    ).all()
    reports_by_status = {
        (row[0].value if isinstance(row[0], ReportStatus) else str(row[0])): row[1]
        for row in status_rows
    }

    return {
        "reports_today": int(reports_today),
        "reports_signed_today": int(reports_signed_today),
        "pending_dictations": int(pending_dictations),
        "transcription_queue": int(transcription_queue),
        "avg_turnaround_minutes": avg_turnaround,
        "studies_total": int(studies_total),
        "reports_by_status": reports_by_status,
        "recent_activity": recent_activity(db),
        "modality_breakdown": modality_breakdown(db),
        "weekly_trend": weekly_trend(db),
    }


def productivity(db: Session, days: int = 30) -> list[dict]:
    start = _start_of_today() - timedelta(days=days)

    created_rows = dict(
        db.execute(
            select(Report.author_id, func.count(Report.id))
            .where(Report.created_at >= start)
            .group_by(Report.author_id)
        ).all()
    )
    signed_rows = dict(
        db.execute(
            select(Report.author_id, func.count(Report.id))
            .where(Report.signed_at >= start)
            .group_by(Report.author_id)
        ).all()
    )
    turnaround_rows = dict(
        db.execute(
            select(Report.author_id, func.avg(Report.signed_at - Report.created_at))
            .where(Report.signed_at.isnot(None), Report.created_at >= start)
            .group_by(Report.author_id)
        ).all()
    )
    ai_rows = dict(
        db.execute(
            select(AuditEvent.actor_user_id, func.count(AuditEvent.id))
            .where(AuditEvent.action == "ai.format_report", AuditEvent.occurred_at >= start)
            .group_by(AuditEvent.actor_user_id)
        ).all()
    )

    author_ids = set(created_rows) | set(signed_rows) | set(ai_rows)
    names = _user_name_map(db, {a for a in author_ids if a})

    rows = []
    for uid in author_ids:
        if not uid:
            continue
        rows.append(
            {
                "user_id": str(uid),
                "display_name": names.get(uid, "Bilinmeyen"),
                "reports_created": int(created_rows.get(uid, 0)),
                "reports_signed": int(signed_rows.get(uid, 0)),
                "avg_turnaround_minutes": _interval_to_minutes(turnaround_rows.get(uid)),
                "ai_formats": int(ai_rows.get(uid, 0)),
            }
        )
    rows.sort(key=lambda r: r["reports_created"], reverse=True)
    return rows


def kpis(db: Session, days: int = 30) -> dict:
    start = _start_of_today() - timedelta(days=days)
    total_reports = db.scalar(select(func.count(Report.id)).where(Report.created_at >= start)) or 0
    signed = (
        db.scalar(
            select(func.count(Report.id)).where(
                Report.signed_at.isnot(None), Report.created_at >= start
            )
        )
        or 0
    )
    avg_turnaround = _interval_to_minutes(
        db.scalar(
            select(func.avg(Report.signed_at - Report.created_at)).where(
                Report.signed_at.isnot(None), Report.created_at >= start
            )
        )
    )
    ai_usage = (
        db.scalar(
            select(func.count(AuditEvent.id)).where(
                AuditEvent.action.in_(["ai.format_report", "ai.transcribe"]),
                AuditEvent.occurred_at >= start,
            )
        )
        or 0
    )
    transcriptions = (
        db.scalar(
            select(func.count(DictationRecording.id)).where(DictationRecording.created_at >= start)
        )
        or 0
    )
    active_radiologists = (
        db.scalar(
            select(func.count(func.distinct(Report.author_id))).where(Report.created_at >= start)
        )
        or 0
    )
    return {
        "total_reports": int(total_reports),
        "signed_rate": round((signed / total_reports * 100) if total_reports else 0.0, 1),
        "avg_turnaround_minutes": avg_turnaround,
        "ai_usage_count": int(ai_usage),
        "transcriptions": int(transcriptions),
        "active_radiologists": int(active_radiologists),
    }


def trends(db: Session, days: int = 14) -> list[dict]:
    start = _start_of_today() - timedelta(days=days - 1)
    created = dict(
        db.execute(
            select(func.date(Report.created_at), func.count(Report.id))
            .where(Report.created_at >= start)
            .group_by(func.date(Report.created_at))
        ).all()
    )
    signed = dict(
        db.execute(
            select(func.date(Report.signed_at), func.count(Report.id))
            .where(Report.signed_at >= start)
            .group_by(func.date(Report.signed_at))
        ).all()
    )
    trans = dict(
        db.execute(
            select(func.date(DictationRecording.created_at), func.count(DictationRecording.id))
            .where(DictationRecording.created_at >= start)
            .group_by(func.date(DictationRecording.created_at))
        ).all()
    )
    out = []
    for i in range(days):
        day = (start + timedelta(days=i)).date()
        out.append(
            {
                "date": day.isoformat(),
                "reports": int(created.get(day, 0)),
                "signed": int(signed.get(day, 0)),
                "transcriptions": int(trans.get(day, 0)),
            }
        )
    return out
