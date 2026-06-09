"""Persist QA validation results and immutable audit log entries."""

from __future__ import annotations

import hashlib
import hmac
import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import ReportQAAuditLog, ReportQAValidation, User
from app.services.qa.types import QAValidationResult


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _audit_hmac(payload: dict, secret: str) -> str:
    body = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


def save_qa_validation(
    db: Session,
    *,
    result: QAValidationResult,
    transcript: str,
    report: str,
    actor: User | None,
    report_id: UUID | None = None,
    dictation_recording_id: UUID | None = None,
    study_id: UUID | None = None,
) -> ReportQAValidation:
    row = ReportQAValidation(
        report_id=report_id,
        dictation_recording_id=dictation_recording_id,
        study_id=study_id,
        created_by=actor.id if actor else None,
        transcript_text=transcript,
        report_text=report,
        transcript_hash=_content_hash(transcript),
        report_hash=_content_hash(report),
        findings=result.findings_dicts(),
        scores=result.scores.to_dict(),
        traceability=result.traceability_dicts(),
        reviewer_findings=result.reviewer_findings,
        risk_level=result.scores.risk_level,
        overall_score=result.scores.overall_score,
        primary_model=result.primary_model,
        review_model=result.review_model,
        status="completed",
    )
    db.add(row)
    db.flush()

    _append_audit(db, row.id, "validation_completed", {
        "overall_score": row.overall_score,
        "risk_level": row.risk_level,
        "finding_count": len(row.findings),
        "primary_model": row.primary_model,
        "review_model": row.review_model,
    })
    db.commit()
    db.refresh(row)
    return row


def _append_audit(db: Session, validation_id: UUID, event_type: str, payload: dict) -> ReportQAAuditLog:
    secret = get_settings().audit_hmac_secret
    integrity_hash = _audit_hmac({"validation_id": str(validation_id), "event_type": event_type, **payload}, secret)
    entry = ReportQAAuditLog(
        validation_id=validation_id,
        event_type=event_type,
        payload=payload,
        integrity_hash=integrity_hash,
    )
    db.add(entry)
    return entry


def get_latest_qa_for_report(db: Session, report_id: UUID) -> ReportQAValidation | None:
    return db.scalar(
        select(ReportQAValidation)
        .where(ReportQAValidation.report_id == report_id)
        .order_by(ReportQAValidation.created_at.desc())
        .limit(1)
    )


def get_qa_audit_log(db: Session, validation_id: UUID) -> list[ReportQAAuditLog]:
    return list(
        db.scalars(
            select(ReportQAAuditLog)
            .where(ReportQAAuditLog.validation_id == validation_id)
            .order_by(ReportQAAuditLog.created_at.asc())
        )
    )
