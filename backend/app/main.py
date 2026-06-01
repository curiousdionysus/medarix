from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import admin, ai, analytics, auth, branding, clinical, dicom, licensing, patients, recordings
from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.config_validation import validate_settings
from app.core.security_headers import SecurityHeadersMiddleware
from app.db.base import Base
from app.db.migrate import apply_sql_migrations
from app.db.session import SessionLocal, engine
from app.models import User
from app.services.health_service import build_health
from app.services.patient_maintenance import ensure_patient_encryption
from app.services.rbac import require_permission
from app.services.permissions import ensure_builtin_roles
from app.services.recording_storage import purge_expired_recordings


settings = get_settings()
static_dir = Path(__file__).parent / "static"
spa_dir = Path(__file__).parent / "spa"
spa_index = spa_dir / "index.html"
spa_enabled = spa_index.exists()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Hospital-grade radiology reporting API",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Cookie"],
)

app.include_router(branding.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(clinical.router, prefix=settings.api_prefix)
app.include_router(dicom.router, prefix=settings.api_prefix)
app.include_router(ai.router, prefix=settings.api_prefix)
app.include_router(recordings.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
app.include_router(analytics.router, prefix=settings.api_prefix)
app.include_router(patients.router, prefix=settings.api_prefix)
app.include_router(licensing.router, prefix=settings.api_prefix)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

if spa_enabled:
    spa_assets = spa_dir / "assets"
    if spa_assets.exists():
        app.mount("/assets", StaticFiles(directory=spa_assets), name="spa-assets")


@app.on_event("startup")
def create_schema_for_pilot() -> None:
    validate_settings(settings)
    Base.metadata.create_all(bind=engine)
    apply_sql_migrations()
    with SessionLocal() as db:
        ensure_builtin_roles(db)
        ensure_patient_encryption(db)
        purge_expired_recordings(db)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok", "service": settings.app_name}


@app.get("/healthz/deps")
async def healthz_deps(
    current_user: User = Depends(get_current_user),
) -> dict:
    if not settings.expose_health_deps and settings.environment.lower() not in {"development", "dev", "local"}:
        require_permission(current_user, "*")
    with SessionLocal() as db:
        report = await build_health(db)
    if not settings.expose_health_deps and settings.environment.lower() not in {"development", "dev", "local"}:
        return {"status": report.get("status", "unknown")}
    return report


if spa_enabled:

    if settings.allow_legacy_ui:

        @app.get("/legacy", include_in_schema=False)
        def legacy_index() -> FileResponse:
            return FileResponse(static_dir / "index.html")

    @app.get("/", include_in_schema=False)
    def spa_root() -> FileResponse:
        return FileResponse(spa_index)

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "healthz", "static/", "assets/")):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (spa_dir / full_path).resolve()
        spa_root_resolved = spa_dir.resolve()
        if not str(candidate).startswith(str(spa_root_resolved)):
            raise HTTPException(status_code=404, detail="Not found")
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(spa_index)

else:

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(static_dir / "index.html")
