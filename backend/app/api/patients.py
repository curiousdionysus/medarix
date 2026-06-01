from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Patient, Study, User
from app.schemas import PatientSummary, PatientTimelineEntry
from app.services.patient_crypto import decrypt_value, escape_ilike_pattern
from app.services.rbac import require_permission
from app.services.report_service import latest_status_map


router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=list[PatientSummary])
def list_patients(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    search: str | None = None,
    limit: int = 50,
) -> list[PatientSummary]:
    require_permission(current_user, "study:read")
    query = (
        select(Patient)
        .options(selectinload(Patient.studies))
        .order_by(Patient.created_at.desc())
        .limit(min(limit, 200))
    )
    if search:
        pattern = f"%{escape_ilike_pattern(search)}%"
        query = query.where(Patient.name_search.ilike(pattern, escape="\\"))

    patients = list(db.scalars(query))
    summaries: list[PatientSummary] = []
    for patient in patients:
        studies = patient.studies
        dates = [s.study_date for s in studies if s.study_date]
        modalities = sorted({s.modality for s in studies if s.modality})
        summaries.append(
            PatientSummary(
                id=patient.id,
                patient_name=decrypt_value(patient.name_enc),
                patient_tc=decrypt_value(patient.patient_id_enc),
                study_count=len(studies),
                last_study_date=max(dates) if dates else None,
                modalities=modalities,
            )
        )
    summaries.sort(key=lambda p: p.last_study_date or date.min, reverse=True)
    return summaries


@router.get("/{patient_id}/timeline", response_model=list[PatientTimelineEntry])
def patient_timeline(
    patient_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[PatientTimelineEntry]:
    require_permission(current_user, "study:read")
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    studies = list(
        db.scalars(
            select(Study)
            .where(Study.patient_id == patient_id)
            .order_by(Study.study_date.desc().nullslast(), Study.created_at.desc())
        )
    )
    status_map = latest_status_map(db, [s.id for s in studies])
    return [
        PatientTimelineEntry(
            study_id=s.id,
            accession_number=s.accession_number,
            modality=s.modality,
            study_date=s.study_date,
            study_description=s.study_description,
            report_status=status_map.get(s.id),
        )
        for s in studies
    ]
