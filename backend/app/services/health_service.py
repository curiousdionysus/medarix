import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.system_settings import get_settings_map


settings = get_settings()


async def check_dependency(url: str, path: str = "/models") -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{url.rstrip('/')}{path}")
            return {"ok": response.status_code < 500, "status_code": response.status_code}
    except httpx.HTTPError as exc:
        return {"ok": False, "error": str(exc)}


def check_database(db: Session) -> dict:
    try:
        db.execute(text("select 1"))
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


async def build_health(db: Session) -> dict:
    system_settings = get_settings_map(db)
    text_url = system_settings.get("ai.text_base_url", settings.ollama_base_url)
    whisper_url = system_settings.get("ai.transcription_base_url", settings.whisper_base_url)
    dicomweb_url = system_settings.get("pacs.dicomweb_base_url", settings.dicomweb_base_url)

    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "dependencies": {
            "database": check_database(db),
            "ollama": await check_dependency(text_url),
            "whisper": await check_dependency(whisper_url),
            "dicomweb": await check_dependency(dicomweb_url.replace("/dicom-web", ""), "/system"),
        },
    }
