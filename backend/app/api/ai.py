from typing import Annotated
from uuid import UUID

import httpx
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
    ReportQAOut,
    ReportQAScoresOut,
    TranscriptionResponse,
)
from app.services.qa.service import run_report_qa, serialize_qa_validation
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


def _raise_llm_error(exc: Exception) -> None:
    if isinstance(exc, httpx.ConnectError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Ollama dil modeli sunucusuna bağlanılamadı. "
                "medarix-ai konteynerinin çalıştığını doğrulayın."
            ),
        ) from exc
    if isinstance(exc, httpx.ReadTimeout):
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=(
                "Dil modeli yanıt vermedi (zaman aşımı). CPU modunda uzun raporlar birkaç dakika sürebilir; "
                "biraz bekleyip tekrar deneyin veya metni kısaltın. "
                "Gerekirse MEDARIX_OLLAMA_REQUEST_TIMEOUT_SECONDS değerini artırın."
            ),
        ) from exc
    if isinstance(exc, httpx.HTTPStatusError):
        if exc.response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Seçili dil modeli Ollama'da yüklü değil. "
                    "Kurulum: docker exec medarix-ai ollama pull llama3.1:latest — "
                    "ardından Yönetim → Sistem Ayarları'nda bu modeli seçin."
                ),
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Dil modeli sunucusu hata döndürdü: {exc.response.status_code}",
        ) from exc
    raise exc


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
    try:
        text = await ai_gateway.transcribe_audio(
            system_settings["ai.transcription_base_url"],
            system_settings["ai.transcription_model"],
            system_settings.get("ai.transcription_language", "tr"),
            file.filename or "recording.webm",
            content,
            file.content_type,
        )
    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Transkripsiyon sunucusuna (Whisper) bağlanılamadı. "
                "Docker ortamında Sistem Ayarları → Transkripsiyon URL: http://whisper:8000/v1 olmalıdır."
            ),
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Transkripsiyon sunucusu hata döndürdü: {exc.response.status_code}",
        ) from exc
    except httpx.ReadTimeout as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Transkripsiyon zaman aşımına uğradı. Daha kısa kayıt deneyin veya Whisper modelini küçültün.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc) or "Transkripsiyon boş döndü. Kayıtta konuşma algılanmadı.",
        ) from exc
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
    try:
        report = await ai_gateway.format_report(
            system_settings["ai.text_base_url"],
            system_settings["ai.text_model"],
            payload.transcript,
            payload.template,
        )
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        _raise_llm_error(exc)
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
    qa_row = await run_report_qa(
        db,
        system_settings=system_settings,
        transcript=payload.transcript,
        report=report,
        actor=current_user,
        report_id=saved_report.id if saved_report else None,
        dictation_recording_id=recording.id,
        study_id=payload.study_id,
    )
    qa_out: ReportQAOut | None = None
    if qa_row:
        data = serialize_qa_validation(qa_row)
        qa_out = ReportQAOut(
            validation_id=data["validation_id"],
            report_id=data.get("report_id"),
            dictation_recording_id=data.get("dictation_recording_id"),
            study_id=data.get("study_id"),
            scores=ReportQAScoresOut(**data["scores"]),
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
        record_audit_event(
            db,
            request=request,
            action="qa.auto_validate",
            resource_type="report_qa",
            resource_id=qa_row.id,
            actor=current_user,
            metadata={"overall_score": qa_row.overall_score, "risk_level": qa_row.risk_level},
        )
    return FormatReportResponse(
        report=report,
        model=system_settings["ai.text_model"],
        recording_id=recording.id,
        saved_report=saved_report,
        qa=qa_out,
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
    try:
        result = await ai_gateway.suggest(
            system_settings["ai.text_base_url"],
            system_settings["ai.text_model"],
            payload.text,
            payload.kind,
        )
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        _raise_llm_error(exc)
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
    try:
        reply = await ai_gateway.assistant_reply(
            system_settings["ai.text_base_url"],
            system_settings["ai.text_model"],
            [m.model_dump() for m in payload.messages],
            payload.report_context,
        )
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        _raise_llm_error(exc)
    record_audit_event(
        db,
        request=request,
        action="ai.assistant",
        resource_type="ai",
        actor=current_user,
        metadata={"model": system_settings["ai.text_model"], "turns": len(payload.messages)},
    )
    return AiAssistantResponse(reply=reply, model=system_settings["ai.text_model"])
