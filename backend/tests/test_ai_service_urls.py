from app.services.ai_service_urls import (
    resolve_dicomweb_base_url,
    resolve_text_base_url,
    resolve_transcription_base_url,
)


def test_rewrite_whisper_localhost():
    assert resolve_transcription_base_url("http://127.0.0.1:10300/v1") == "http://whisper:8000/v1"


def test_rewrite_ollama_localhost():
    assert resolve_text_base_url("http://127.0.0.1:11434/v1") == "http://ollama:11434/v1"


def test_passthrough_docker_url():
    assert resolve_transcription_base_url("http://whisper:8000/v1") == "http://whisper:8000/v1"


def test_rewrite_orthanc_localhost():
    assert resolve_dicomweb_base_url("http://127.0.0.1:8042/dicom-web") == "http://orthanc:8042/dicom-web"
