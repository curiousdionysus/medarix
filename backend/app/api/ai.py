from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.license_guard import require_enterprise_license
from app.core.config import get_settings
from app.core.upload_validation import validate_audio_upload
from app.db.session import get_db
from app.models import ReportStatus, Study, User
from app.schemas import (
    AiAssistantRequest,
    AiAssistantResponse,
    AiSuggestionRequest,
    AiSuggestionResponse,
    FormatReportRequest,
    FormatReportResponse,
    TranscriptionResponse,
)
from app.services.ai_gateway import ai_gateway
from app.services.audit import record_audit_event
from app.services.rbac import require_permission
from app.services.recording_storage import save_audio_recording, save_structured_report
from app.services.report_service import upsert_study_report
from app.services.system_settings import get_settings_map, is_setting_enabled


router = APIRouter(prefix="/ai", tags=["ai"])
_settings = get_settings()


def _require_ai_enabled(system_settings: dict[str, str]) -> None:
    if not is_setting_enabled(system_settings, "ai.enabled"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Yapay zeka servisleri yönetim panelinden devre dışı bırakıldı.",
        )


@router.get("/models/text")
async def text_models(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "ai:use")
    system_settings = get_settings_map(db)
    _require_ai_enabled(system_settings)
    return {"models": await ai_gateway.list_text_models(system_settings["ai.text_base_url"])}


@router.get("/models/transcription")
async def transcription_models(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "ai:use")
    system_settings = get_settings_map(db)
    _require_ai_enabled(system_settings)
    return {"models": await ai_gateway.list_transcription_models(system_settings["ai.transcription_base_url"])}


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    request: Request,
    file: UploadFile = File(...),
    study_id: UUID | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TranscriptionResponse:
    require_permission(current_user, "ai:use")
    system_settings = get_settings_map(db)
    _require_ai_enabled(system_settings)
    validate_audio_upload(file.filename, file.content_type)
    content = await file.read()
    if len(content) > _settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ses dosyası boyutu izin verilen üst sınırı aşıyor.",
        )
    text = await ai_gateway.transcribe_audio(
        system_settings["ai.transcription_base_url"],
        system_settings["ai.transcription_model"],
        system_settings.get("ai.transcription_language", "tr"),
        file.filename or "recording.webm",
        content,
        file.content_type,
    )
    recording = save_audio_recording(
        db,
        user_id=current_user.id,
        study_id=study_id,
        filename=file.filename or "recording.webm",
        content_type=file.content_type,
        audio_data=content,
        transcript=text,
    )
    record_audit_event(
        db,
        request=request,
        action="ai.transcribe",
        resource_type="dictation_recording",
        resource_id=recording.id,
        actor=current_user,
        metadata={
            "filename": file.filename,
            "content_type": file.content_type,
            "bytes": len(content),
            "model": system_settings["ai.transcription_model"],
            "language": system_settings.get("ai.transcription_language", "tr"),
            "study_id": str(study_id) if study_id else None,
        },
    )
    return TranscriptionResponse(
        text=text,
        model=system_settings["ai.transcription_model"],
        recording_id=recording.id,
    )


@router.post("/format-report", response_model=FormatReportResponse)
async def format_report(
    request: Request,
    payload: FormatReportRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FormatReportResponse:
    require_permission(current_user, "ai:use")
    system_settings = get_settings_map(db)
    _require_ai_enabled(system_settings)
    report = await ai_gateway.format_report(
        system_settings["ai.text_base_url"],
        system_settings["ai.text_model"],
        payload.transcript,
        payload.template,
    )
    recording = save_structured_report(
        db,
        user_id=current_user.id,
        study_id=payload.study_id,
        transcript=payload.transcript,
        structured_report=report,
        recording_id=payload.recording_id,
    )
    saved_report = None
    if payload.study_id and db.get(Study, payload.study_id):
        saved_report = upsert_study_report(
            db,
            study_id=payload.study_id,
            author=current_user,
            content=report,
            transcript=payload.transcript,
            status=ReportStatus.draft,
        )
    record_audit_event(
        db,
        request=request,
        action="ai.format_report",
        resource_type="dictation_recording",
        resource_id=recording.id,
        actor=current_user,
        metadata={
            "study_id": str(payload.study_id) if payload.study_id else None,
            "model": system_settings["ai.text_model"],
        },
    )
    return FormatReportResponse(
        report=report,
        model=system_settings["ai.text_model"],
        recording_id=recording.id,
        saved_report=saved_report,
    )


@router.post("/suggestions", response_model=AiSuggestionResponse)
async def suggestions(
    request: Request,
    payload: AiSuggestionRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AiSuggestionResponse:
    require_permission(current_user, "ai:use")
    require_enterprise_license(db)
    if not payload.text.strip():
        return AiSuggestionResponse(result="", model="", kind=payload.kind)
    system_settings = get_settings_map(db)
    _require_ai_enabled(system_settings)
    result = await ai_gateway.suggest(
        system_settings["ai.text_base_url"],
        system_settings["ai.text_model"],
        payload.text,
        payload.kind,
    )
    record_audit_event(
        db,
        request=request,
        action="ai.suggestion",
        resource_type="ai",
        actor=current_user,
        metadata={"kind": payload.kind, "model": system_settings["ai.text_model"]},
    )
    return AiSuggestionResponse(result=result, model=system_settings["ai.text_model"], kind=payload.kind)


@router.post("/assistant", response_model=AiAssistantResponse)
async def assistant(
    request: Request,
    payload: AiAssistantRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AiAssistantResponse:
    require_permission(current_user, "ai:use")
    require_enterprise_license(db)
    system_settings = get_settings_map(db)
    _require_ai_enabled(system_settings)
    reply = await ai_gateway.assistant_reply(
        system_settings["ai.text_base_url"],
        system_settings["ai.text_model"],
        [m.model_dump() for m in payload.messages],
        payload.report_context,
    )
    record_audit_event(
        db,
        request=request,
        action="ai.assistant",
        resource_type="ai",
        actor=current_user,
        metadata={"model": system_settings["ai.text_model"], "turns": len(payload.messages)},
    )
    return AiAssistantResponse(reply=reply, model=system_settings["ai.text_model"])
