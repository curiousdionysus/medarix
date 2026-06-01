import pytest
from fastapi import HTTPException

from app.core.upload_validation import validate_audio_upload


def test_validate_audio_upload_accepts_webm():
    validate_audio_upload("dictation.webm", "audio/webm")


def test_validate_audio_upload_rejects_executable():
    with pytest.raises(HTTPException) as exc:
        validate_audio_upload("malware.exe", "application/octet-stream")
    assert exc.value.status_code == 415


def test_validate_audio_upload_rejects_unknown_type():
    with pytest.raises(HTTPException) as exc:
        validate_audio_upload("file.txt", "text/plain")
    assert exc.value.status_code == 415
