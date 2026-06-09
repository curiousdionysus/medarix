"""High-level QA execution and API serialization."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models import ReportQAValidation, User
from app.services.qa.flags import is_qa_enabled, is_secondary_review_enabled, is_traceability_enabled
from app.services.qa.persistence import save_qa_validation
from app.services.qa.validator import validate_report_qa


async def run_report_qa(
    db: Session,
    *,
    system_settings: dict[str, str],
    transcript: str,
    report: str,
    actor: User | None,
    report_id: UUID | None = None,
    dictation_recording_id: UUID | None = None,
    study_id: UUID | None = None,
    transcription_confidence: float = 0.97,
) -> ReportQAValidation | None:
    if not is_qa_enabled(system_settings):
        return None

    review_model = system_settings.get("qa.review_model") or system_settings.get("ai.text_model", "")
    result = await validate_report_qa(
        transcript=transcript,
        report=report,
        transcription_confidence=transcription_confidence,
        enable_traceability=is_traceability_enabled(system_settings),
        enable_secondary_review=is_secondary_review_enabled(system_settings),
        text_base_url=system_settings.get("ai.text_base_url"),
        primary_model=system_settings.get("ai.text_model"),
        review_model=review_model,
    )
    return save_qa_validation(
        db,
        result=result,
        transcript=transcript,
        report=report,
        actor=actor,
        report_id=report_id,
        dictation_recording_id=dictation_recording_id,
        study_id=study_id,
    )


def serialize_qa_validation(row: ReportQAValidation) -> dict:
    return {
        "validation_id": row.id,
        "report_id": row.report_id,
        "dictation_recording_id": row.dictation_recording_id,
        "study_id": row.study_id,
        "scores": row.scores,
        "findings": row.findings,
        "traceability": row.traceability,
        "reviewer_findings": row.reviewer_findings,
        "risk_level": row.risk_level,
        "overall_score": row.overall_score,
        "primary_model": row.primary_model,
        "review_model": row.review_model,
        "status": row.status,
        "created_at": row.created_at,
    }
