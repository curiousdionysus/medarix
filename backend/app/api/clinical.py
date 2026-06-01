from datetime import date
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Patient, Report, ReportStatus, ReportTemplate, Series, Study, User
from app.schemas import (
    ReportCreate,
    ReportOut,
    ReportPacsSendResponse,
    ReportPdfRequest,
    ReportTemplateCreate,
    ReportTemplateOut,
    ReportUpdate,
    ReportVersionOut,
    SeriesOut,
    StudyOut,
)
from app.services.audit import record_audit_event
from app.services.clinical_helpers import serialize_study
from app.services.dicom_gateway import dicom_gateway
from app.core.http_utils import safe_content_disposition_filename
from app.services.patient_crypto import escape_ilike_pattern, patient_hash
from app.services.pdf_report import build_report_pdf
from app.services.rbac import require_permission
from app.services.report_service import (
    get_latest_report,
    latest_status_map,
    list_report_versions,
    snapshot_report_version,
    upsert_study_report,
)
from app.services.system_settings import get_settings_map, is_setting_enabled


router = APIRouter(tags=["clinical"])


@router.get("/report-templates", response_model=list[ReportTemplateOut])
def list_report_templates(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ReportTemplateOut]:
    require_permission(current_user, "template:write")
    return list(
        db.scalars(
            select(ReportTemplate)
            .where(ReportTemplate.owner_id == current_user.id)
            .order_by(ReportTemplate.modality, ReportTemplate.title)
        )
    )


@router.post("/report-templates", response_model=ReportTemplateOut, status_code=status.HTTP_201_CREATED)
def create_report_template(
    request: Request,
    payload: ReportTemplateCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportTemplateOut:
    require_permission(current_user, "template:write")
    template = ReportTemplate(
        owner_id=current_user.id,
        modality=payload.modality.strip().upper(),
        title=payload.title.strip(),
        content=payload.content.strip(),
    )
    if not template.modality or not template.title or not template.content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template modality, title and content are required")
    db.add(template)
    db.commit()
    db.refresh(template)
    record_audit_event(
        db,
        request=request,
        action="report_template.create",
        resource_type="report_template",
        resource_id=template.id,
        actor=current_user,
        metadata={"modality": template.modality, "title": template.title},
    )
    return template


@router.delete("/report-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report_template(
    request: Request,
    template_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    require_permission(current_user, "report:delete")
    template = db.scalar(
        select(ReportTemplate).where(
            ReportTemplate.id == template_id,
            ReportTemplate.owner_id == current_user.id,
        )
    )
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    metadata = {"modality": template.modality, "title": template.title}
    db.delete(template)
    db.commit()
    record_audit_event(
        db,
        request=request,
        action="report_template.delete",
        resource_type="report_template",
        resource_id=template_id,
        actor=current_user,
        metadata=metadata,
    )


@router.get("/studies", response_model=list[StudyOut])
def list_studies(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    accession_number: str | None = None,
    patient_tc: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    modality: Annotated[list[str] | None, Query()] = None,
    limit: int = 50,
) -> list[StudyOut]:
    require_permission(current_user, "study:read")
    query = (
        select(Study)
        .join(Patient, Study.patient_id == Patient.id)
        .options(joinedload(Study.patient))
        .order_by(Study.study_date.desc().nullslast())
        .limit(min(limit, 200))
    )
    if accession_number:
        query = query.where(Study.accession_number == accession_number)
    if modality:
        query = query.where(Study.modality.in_(modality))
    if from_date:
        query = query.where(Study.study_date >= from_date)
    if to_date:
        query = query.where(Study.study_date <= to_date)
    if patient_tc:
        query = query.where(Patient.patient_hash == patient_hash(patient_tc))
    if first_name:
        pattern = f"%{escape_ilike_pattern(first_name)}%"
        query = query.where(Patient.name_search.ilike(pattern, escape="\\"))
    if last_name:
        pattern = f"%{escape_ilike_pattern(last_name)}%"
        query = query.where(Patient.name_search.ilike(pattern, escape="\\"))

    studies = list(db.scalars(query))
    search_metadata = {
        "patient_tc": bool(patient_tc),
        "first_name": bool(first_name),
        "last_name": bool(last_name),
        "accession_number": accession_number,
        "from_date": from_date.isoformat() if from_date else None,
        "to_date": to_date.isoformat() if to_date else None,
        "modality": modality or [],
        "count": len(studies),
    }
    record_audit_event(
        db,
        request=request,
        action="study.search",
        resource_type="study",
        actor=current_user,
        metadata=search_metadata,
    )
    status_map = latest_status_map(db, [study.id for study in studies])
    return [serialize_study(study, study.patient, status_map.get(study.id)) for study in studies]


@router.get("/studies/{study_id}", response_model=StudyOut)
def get_study(
    request: Request,
    study_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StudyOut:
    require_permission(current_user, "study:read")
    study = db.scalar(select(Study).where(Study.id == study_id).options(joinedload(Study.patient)))
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study not found")
    record_audit_event(db, request=request, action="study.open", resource_type="study", resource_id=study.id, actor=current_user)
    latest = get_latest_report(db, study.id)
    return serialize_study(study, study.patient, latest.status if latest else None)


@router.get("/studies/{study_id}/series", response_model=list[SeriesOut])
def list_series(
    study_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SeriesOut]:
    require_permission(current_user, "image:view")
    return list(db.scalars(select(Series).where(Series.study_id == study_id).order_by(Series.series_number)))


@router.get("/studies/{study_id}/report", response_model=ReportOut | None)
def get_study_report(
    request: Request,
    study_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportOut | None:
    require_permission(current_user, "report:read")
    report = get_latest_report(db, study_id)
    record_audit_event(db, request=request, action="report.read", resource_type="study", resource_id=study_id, actor=current_user)
    return report


@router.post("/studies/{study_id}/report", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(
    request: Request,
    study_id: UUID,
    payload: ReportCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportOut:
    require_permission(current_user, "report:write")
    try:
        report = upsert_study_report(
            db,
            study_id=study_id,
            author=current_user,
            content=payload.content,
            transcript=payload.transcript,
            status=payload.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    record_audit_event(db, request=request, action="report.create", resource_type="report", resource_id=report.id, actor=current_user)
    return report


@router.put("/studies/{study_id}/report", response_model=ReportOut)
def update_study_report(
    request: Request,
    study_id: UUID,
    payload: ReportUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportOut:
    require_permission(current_user, "report:write")
    try:
        report = upsert_study_report(
            db,
            study_id=study_id,
            author=current_user,
            content=payload.content,
            transcript=payload.transcript,
            status=payload.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    record_audit_event(db, request=request, action="report.update", resource_type="report", resource_id=report.id, actor=current_user)
    return report


@router.post("/reports/{report_id}/sign", response_model=ReportOut)
def sign_report(
    request: Request,
    report_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportOut:
    require_permission(current_user, "report:sign")
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report.status = ReportStatus.signed
    report.signed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)
    snapshot_report_version(db, report, current_user.id)
    record_audit_event(db, request=request, action="report.sign", resource_type="report", resource_id=report.id, actor=current_user)
    return report


@router.get("/reports/{report_id}/versions", response_model=list[ReportVersionOut])
def get_report_versions(
    report_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ReportVersionOut]:
    require_permission(current_user, "report:read")
    versions = list_report_versions(db, report_id)
    author_ids = {v.author_id for v in versions if v.author_id}
    names: dict = {}
    if author_ids:
        rows = db.execute(
            select(User.id, User.display_name, User.username).where(User.id.in_(author_ids))
        ).all()
        names = {row[0]: (row[1] or row[2]) for row in rows}
    return [
        ReportVersionOut(
            id=v.id,
            report_id=v.report_id,
            version=v.version,
            status=v.status,
            content=v.content,
            transcript=v.transcript,
            author_id=v.author_id,
            author_name=names.get(v.author_id),
            created_at=v.created_at,
        )
        for v in versions
    ]


@router.post("/reports/{report_id}/send-to-pacs", response_model=ReportPacsSendResponse)
def send_report_to_pacs(
    request: Request,
    report_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "report:sign")
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    study = db.get(Study, report.study_id)
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study not found")

    system_settings = get_settings_map(db)
    if not is_setting_enabled(system_settings, "pacs.enabled"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PACS / DICOM entegrasyonu yönetim panelinden devre dışı bırakıldı.",
        )

    report.status = ReportStatus.signed
    report.signed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)

    pacs_status = dicom_gateway.store_report(
        report,
        study,
        system_settings,
        current_user.display_name or current_user.username,
    )
    record_audit_event(
        db,
        request=request,
        action="report.send_to_pacs",
        resource_type="report",
        resource_id=report.id,
        actor=current_user,
        metadata=pacs_status,
    )
    return {"report": report, "pacs_status": pacs_status}


@router.post("/reports/pdf")
def download_report_pdf(
    request: Request,
    payload: ReportPdfRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    require_permission(current_user, "report:read")
    if not payload.content.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Report content is empty")

    pdf = build_report_pdf(payload, current_user.display_name or current_user.username)
    filename_part = payload.accession_number or "rapor"
    filename = f"rapor-{filename_part}.pdf".replace("/", "-").replace("\\", "-")
    record_audit_event(
        db,
        request=request,
        action="report.download_pdf",
        resource_type="report",
        actor=current_user,
        metadata={"accession_number": payload.accession_number, "modality": payload.modality},
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_content_disposition_filename(filename, fallback="rapor.pdf")}"'
            )
        },
    )
