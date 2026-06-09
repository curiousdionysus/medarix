from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.license_guard import require_enterprise_license
from app.db.session import get_db
from app.models import User
from app.schemas import AnalyticsKpis, DashboardMetrics, ProductivityRow, TrendPoint
from app.services import analytics_service
from app.services.rbac import require_permission


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardMetrics)
def dashboard(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    require_permission(current_user, "analytics:view")
    require_enterprise_license(db)
    return analytics_service.dashboard_metrics(db)


@router.get("/productivity", response_model=list[ProductivityRow])
def productivity(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days: int = 30,
) -> list[dict]:
    require_permission(current_user, "analytics:view")
    require_enterprise_license(db)
    return analytics_service.productivity(db, days=days)


@router.get("/kpis", response_model=AnalyticsKpis)
def kpis(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days: int = 30,
) -> dict:
    require_permission(current_user, "analytics:view")
    require_enterprise_license(db)
    return analytics_service.kpis(db, days=days)


@router.get("/qa-summary")
def qa_summary(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days: int = 30,
) -> dict:
    require_permission(current_user, "analytics:view")
    require_permission(current_user, "qa:view")
    require_enterprise_license(db)
    return analytics_service.qa_summary(db, days=days)


@router.get("/trends", response_model=list[TrendPoint])
def trends(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days: int = 14,
) -> list[dict]:
    require_permission(current_user, "analytics:view")
    require_enterprise_license(db)
    return analytics_service.trends(db, days=days)
