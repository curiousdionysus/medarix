from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services import license as license_service


router = APIRouter(prefix="/license", tags=["license"])


@router.get("")
def current_license(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Edition/feature info for the signed-in user (used for client-side feature gating)."""
    return license_service.get_license(db)
