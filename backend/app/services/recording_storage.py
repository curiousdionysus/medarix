from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import DictationRecording, Study
from app.services.system_settings import get_setting


def retention_days(db: Session) -> int:
    raw = get_setting(db, "storage.recording_retention_days")
    try:
        days = int(raw)
    except (TypeError, ValueError):
        days = 90
    return max(1, min(days, 3650))


def purge_expired_recordings(db: Session) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days(db))
    result = db.execute(delete(DictationRecording).where(DictationRecording.created_at < cutoff))
    db.commit()
    return result.rowcount or 0


def save_audio_recording(
    db: Session,
    *,
    user_id: UUID,
    study_id: UUID | None,
    filename: str,
    content_type: str | None,
    audio_data: bytes,
    transcript: str,
) -> DictationRecording:
    if study_id and not db.get(Study, study_id):
        study_id = None

    recording = DictationRecording(
        user_id=user_id,
        study_id=study_id,
        filename=filename,
        content_type=content_type,
        audio_data=audio_data,
        transcript=transcript,
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)
    purge_expired_recordings(db)
    return recording


def save_structured_report(
    db: Session,
    *,
    user_id: UUID,
    study_id: UUID | None,
    transcript: str,
    structured_report: str,
    recording_id: UUID | None = None,
) -> DictationRecording:
    if study_id and not db.get(Study, study_id):
        study_id = None

    recording: DictationRecording | None = None
    if recording_id:
        recording = db.scalar(
            select(DictationRecording).where(
                DictationRecording.id == recording_id,
                DictationRecording.user_id == user_id,
            )
        )

    if recording:
        recording.transcript = transcript
        recording.structured_report = structured_report
        if study_id:
            recording.study_id = study_id
    else:
        recording = DictationRecording(
            user_id=user_id,
            study_id=study_id,
            filename="transcript-only",
            content_type="text/plain",
            audio_data=None,
            transcript=transcript,
            structured_report=structured_report,
        )
        db.add(recording)

    db.commit()
    db.refresh(recording)
    purge_expired_recordings(db)
    return recording
