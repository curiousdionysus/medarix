from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.branding import build_public_branding
from app.services.system_settings import get_settings_map

router = APIRouter(tags=["branding"])


@router.get("/branding")
def get_public_branding(db: Annotated[Session, Depends(get_db)]) -> dict:
    """Oturum gerektirmez; giriş sayfası ve SPA teması için kurumsal kimlik."""
    return build_public_branding(get_settings_map(db))
