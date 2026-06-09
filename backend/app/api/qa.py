"""Report Quality Assurance API — isolated from existing report write paths."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Report, User
from app.schemas import ReportQAAuditEntryOut, ReportQAOut, ReportQAValidateRequest, ReportQAScoresOut
from app.services.audit import record_audit_event
from app.services.qa.flags import is_qa_enabled
from app.services.qa.persistence import get_latest_qa_for_report, get_qa_audit_log
from app.services.qa.service import run_report_qa, serialize_qa_validation
from app.services.rbac import require_permission
from app.services.system_settings import get_settings_map


router = APIRouter(prefix="/reports", tags=["report-qa"])


def _require_qa_enabled(system_settings: dict[str, str]) -> None:
    if not is_qa_enabled(system_settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Rapor kalite denetimi (QA) yönetim panelinden devre dışı.",
        )


def _to_qa_out(data: dict) -> ReportQAOut:
    scores = data["scores"]
    return ReportQAOut(
        validation_id=data["validation_id"],
        report_id=data.get("report_id"),
        dictation_recording_id=data.get("dictation_recording_id"),
        study_id=data.get("study_id"),
        scores=ReportQAScoresOut(**scores),
        findings=data.get("findings") or [],
        traceability=data.get("traceability") or [],
        reviewer_findings=data.get("reviewer_findings"),
        risk_level=data["risk_level"],
        overall_score=data["overall_score"],
        primary_model=data.get("primary_model"),
        review_model=data.get("review_model"),
        status=data["status"],
        created_at=data["created_at"],
    )


@router.post("/validate", response_model=ReportQAOut)
async def validate_report(
    request: Request,
    payload: ReportQAValidateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportQAOut:
    require_permission(current_user, "qa:run")
    system_settings = get_settings_map(db)
    _require_qa_enabled(system_settings)

    row = await run_report_qa(
        db,
        system_settings=system_settings,
        transcript=payload.transcript,
        report=payload.report,
        actor=current_user,
        report_id=payload.report_id,
        dictation_recording_id=payload.recording_id,
        study_id=payload.study_id,
        transcription_confidence=payload.transcription_confidence or 0.97,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="QA devre dışı.")

    record_audit_event(
        db,
        request=request,
        action="qa.validate",
        resource_type="report_qa",
        resource_id=row.id,
        actor=current_user,
        metadata={"overall_score": row.overall_score, "risk_level": row.risk_level},
    )
    return _to_qa_out(serialize_qa_validation(row))


@router.get("/{report_id}/qa", response_model=ReportQAOut)
def get_report_qa(
    report_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportQAOut:
    require_permission(current_user, "qa:view")
    system_settings = get_settings_map(db)
    _require_qa_enabled(system_settings)

    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    row = get_latest_qa_for_report(db, report_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QA sonucu bulunamadı.")
    return _to_qa_out(serialize_qa_validation(row))


@router.get("/{report_id}/audit", response_model=list[ReportQAAuditEntryOut])
def get_report_qa_audit(
    report_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ReportQAAuditEntryOut]:
    require_permission(current_user, "qa:view")
    system_settings = get_settings_map(db)
    _require_qa_enabled(system_settings)

    row = get_latest_qa_for_report(db, report_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QA sonucu bulunamadı.")

    entries = get_qa_audit_log(db, row.id)
    return [
        ReportQAAuditEntryOut(
            id=e.id,
            event_type=e.event_type,
            payload=e.payload,
            integrity_hash=e.integrity_hash,
            created_at=e.created_at,
        )
        for e in entries
    ]
