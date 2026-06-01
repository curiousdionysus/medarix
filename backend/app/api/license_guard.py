"""Server-side Enterprise license checks (aligns with SPA EnterpriseGuard)."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.services.license import EDITION_ENTERPRISE, get_license


def require_enterprise_license(db: Session) -> None:
    license_info = get_license(db)
    if license_info.get("is_enterprise"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Bu özellik Medarix Enterprise lisansı gerektirir.",
    )
