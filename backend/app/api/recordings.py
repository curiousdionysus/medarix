from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.http_utils import safe_content_disposition_filename
from app.db.session import get_db
from app.models import DictationRecording, User
from app.schemas import DictationRecordingOut, DictationRecordingRestore
from app.services.audit import record_audit_event
from app.services.rbac import require_permission


router = APIRouter(prefix="/recordings", tags=["recordings"])


def _recording_out(recording: DictationRecording) -> DictationRecordingOut:
    return DictationRecordingOut(
        id=recording.id,
        study_id=recording.study_id,
        filename=recording.filename,
        content_type=recording.content_type,
        transcript=recording.transcript,
        structured_report=recording.structured_report,
        has_audio=bool(recording.audio_data),
        created_at=recording.created_at,
    )


@router.get("", response_model=list[DictationRecordingOut])
def list_recordings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    study_id: UUID | None = None,
    limit: int = 50,
) -> list[DictationRecordingOut]:
    require_permission(current_user, "recording:read")
    query = (
        select(DictationRecording)
        .where(DictationRecording.user_id == current_user.id)
        .order_by(DictationRecording.created_at.desc())
        .limit(min(limit, 200))
    )
    if study_id:
        query = query.where(DictationRecording.study_id == study_id)
    return [_recording_out(item) for item in db.scalars(query)]


@router.get("/{recording_id}", response_model=DictationRecordingOut)
def get_recording(
    recording_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DictationRecordingOut:
    require_permission(current_user, "recording:read")
    recording = db.scalar(
        select(DictationRecording).where(
            DictationRecording.id == recording_id,
            DictationRecording.user_id == current_user.id,
        )
    )
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")
    return _recording_out(recording)


@router.get("/{recording_id}/audio")
def get_recording_audio(
    recording_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    require_permission(current_user, "recording:read")
    recording = db.scalar(
        select(DictationRecording).where(
            DictationRecording.id == recording_id,
            DictationRecording.user_id == current_user.id,
        )
    )
    if not recording or not recording.audio_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio not found")
    return Response(
        content=recording.audio_data,
        media_type=recording.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'inline; filename="{safe_content_disposition_filename(recording.filename, fallback="recording.webm")}"'
            )
        },
    )


@router.post("/{recording_id}/restore", response_model=DictationRecordingRestore)
def restore_recording(
    request: Request,
    recording_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> DictationRecordingRestore:
    require_permission(current_user, "recording:write")
    recording = db.scalar(
        select(DictationRecording).where(
            DictationRecording.id == recording_id,
            DictationRecording.user_id == current_user.id,
        )
    )
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")
    record_audit_event(
        db,
        request=request,
        action="recording.restore",
        resource_type="dictation_recording",
        resource_id=recording.id,
        actor=current_user,
    )
    return DictationRecordingRestore(
        id=recording.id,
        transcript=recording.transcript,
        structured_report=recording.structured_report,
        study_id=recording.study_id,
    )
