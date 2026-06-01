from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.license_guard import require_enterprise_license
from app.core.config import get_settings
from app.db.session import get_db
from app.models import User
from app.schemas import PacsQueryRequest, PacsRetrieveRequest, PacsWorklistSyncRequest, PacsWorklistSyncResponse
from app.services.audit import record_audit_event
from app.services.dicom_gateway import dicom_gateway
from app.services.pacs_qr_client import PacsConnectionError
from app.services.pacs_query_sync import sync_studies_from_pacs_query
from app.services.orthanc_http import orthanc_basic_auth
from app.services.rbac import require_permission
from app.services.system_settings import get_settings_map, is_setting_enabled


router = APIRouter(prefix="/pacs", tags=["pacs"])
_settings = get_settings()

_HOP_BY_HOP_HEADERS = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "host",
    }
)

_PROXY_REQUEST_HEADERS = frozenset(
    {
        "accept",
        "accept-encoding",
        "accept-language",
        "content-type",
        "if-match",
        "if-none-match",
        "origin",
        "referer",
    }
)


def _require_pacs_enabled(system_settings: dict[str, str]) -> None:
    if not is_setting_enabled(system_settings, "pacs.enabled"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PACS / DICOM entegrasyonu yönetim panelinden devre dışı bırakıldı.",
        )


@router.post("/query")
def query_pacs(
    request: Request,
    payload: PacsQueryRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    require_permission(current_user, "pacs:query")
    require_enterprise_license(db)
    system_settings = get_settings_map(db)
    _require_pacs_enabled(system_settings)
    try:
        result = dicom_gateway.query_studies(payload, system_settings)
    except PacsConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    record_audit_event(
        db,
        request=request,
        action="pacs.query",
        resource_type="pacs",
        actor=current_user,
        metadata={**payload.model_dump(exclude_none=True), "count": len(result)},
    )
    return result


@router.post("/worklist/sync", response_model=PacsWorklistSyncResponse)
def sync_worklist(
    request: Request,
    payload: PacsWorklistSyncRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PacsWorklistSyncResponse:
    """C-FIND (Study Root Q/R) ile PACS sorgula ve sonuçları iş listesine yaz."""
    require_permission(current_user, "pacs:query")
    require_enterprise_license(db)
    system_settings = get_settings_map(db)
    _require_pacs_enabled(system_settings)
    try:
        result = sync_studies_from_pacs_query(
            db,
            system_settings,
            from_date=payload.from_date,
            to_date=payload.to_date,
            modality=payload.modality,
            patient_id=payload.patient_id,
            accession_number=payload.accession_number,
        )
    except PacsConnectionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    record_audit_event(
        db,
        request=request,
        action="pacs.query_sync",
        resource_type="pacs",
        actor=current_user,
        metadata={
            "mode": "study_root_c_find",
            "fetched": result.fetched,
            "created": result.created,
            "updated": result.updated,
            "skipped": result.skipped,
            "error_count": len(result.errors),
        },
    )
    return PacsWorklistSyncResponse(
        fetched=result.fetched,
        created=result.created,
        updated=result.updated,
        skipped=result.skipped,
        errors=result.errors,
    )


@router.post("/retrieve")
def retrieve_study(
    request: Request,
    payload: PacsRetrieveRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "pacs:retrieve")
    require_enterprise_license(db)
    system_settings = get_settings_map(db)
    _require_pacs_enabled(system_settings)
    result = dicom_gateway.retrieve_study(payload, system_settings)
    record_audit_event(
        db,
        request=request,
        action="pacs.retrieve",
        resource_type="study",
        resource_id=payload.study_instance_uid,
        actor=current_user,
    )
    return result


@router.api_route("/dicomweb/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"])
async def dicomweb_proxy(
    path: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    require_permission(current_user, "image:view")
    system_settings = get_settings_map(db)
    _require_pacs_enabled(system_settings)

    base_url = system_settings.get("pacs.dicomweb_base_url", _settings.dicomweb_base_url).rstrip("/")
    query = str(request.url.query)
    target_url = f"{base_url}/{path}" if path else base_url
    if query:
        target_url = f"{target_url}?{query}"

    forward_headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() in _PROXY_REQUEST_HEADERS
    }

    record_audit_event(
        db,
        request=request,
        action="dicomweb.proxy",
        resource_type="pacs",
        actor=current_user,
        metadata={"path": path, "method": request.method},
    )

    try:
        async with httpx.AsyncClient(timeout=120.0, auth=orthanc_basic_auth()) as client:
            async with client.stream(
                request.method,
                target_url,
                headers=forward_headers,
                content=await request.body(),
            ) as upstream:
                response_headers = {
                    key: value
                    for key, value in upstream.headers.items()
                    if key.lower() not in _HOP_BY_HOP_HEADERS
                }

                async def body_iter():
                    async for chunk in upstream.aiter_bytes():
                        yield chunk

                return StreamingResponse(
                    body_iter(),
                    status_code=upstream.status_code,
                    headers=response_headers,
                    media_type=upstream.headers.get("content-type"),
                )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"DICOMweb proxy hatası: {exc}",
        ) from exc


@router.get("/viewer-url/{study_instance_uid}")
def viewer_url(
    request: Request,
    study_instance_uid: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "image:view")
    system_settings = get_settings_map(db)
    _require_pacs_enabled(system_settings)
    record_audit_event(db, request=request, action="image.viewer_launch", resource_type="study", resource_id=study_instance_uid, actor=current_user)
    return {"viewer_url": dicom_gateway.dicomweb_viewer_url(study_instance_uid, system_settings)}
