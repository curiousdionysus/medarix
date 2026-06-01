"""Study imaging availability (local archive + Orthanc) and PACS web viewer URLs."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from uuid import UUID

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Series, Study
from app.services.orthanc_http import orthanc_basic_auth

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StudyImagingInfo:
    has_images: bool
    image_count: int
    pacs_viewer_url: str | None
    images_in_archive: bool


def build_pacs_viewer_url(
    template: str,
    *,
    accession_number: str | None,
    study_instance_uid: str | None,
) -> str | None:
    raw = (template or "").strip()
    if not raw:
        return None
    accession = (accession_number or "").strip()
    uid = (study_instance_uid or "").strip()
    if "{accession}" in raw and not accession:
        return None
    if "{study_instance_uid}" in raw and not uid:
        return None
    url = (
        raw.replace("{accession}", accession)
        .replace("{AccessionNumber}", accession)
        .replace("{study_instance_uid}", uid)
        .replace("{StudyInstanceUID}", uid)
    )
    return url.strip() or None


def _orthanc_rest_base(dicomweb_base_url: str) -> str | None:
    base = (dicomweb_base_url or "").strip().rstrip("/")
    if not base:
        return None
    if base.endswith("/dicom-web"):
        return base[: -len("/dicom-web")]
    return base


def _orthanc_has_study(
    orthanc_base: str,
    *,
    accession_number: str | None,
    study_instance_uid: str | None,
) -> bool:
    auth = orthanc_basic_auth()
    query: dict[str, str] = {}
    if study_instance_uid:
        query["StudyInstanceUID"] = study_instance_uid
    elif accession_number:
        query["AccessionNumber"] = accession_number
    else:
        return False
    try:
        with httpx.Client(timeout=4.0, auth=auth) as client:
            response = client.post(
                f"{orthanc_base}/tools/find",
                json={"Level": "Study", "Query": query, "Expand": False},
            )
            response.raise_for_status()
            return bool(response.json())
    except httpx.HTTPError as exc:
        logger.debug("Orthanc find failed for %s: %s", query, exc)
        return False


def _local_image_counts(db: Session, study_ids: list[UUID]) -> dict[UUID, int]:
    if not study_ids:
        return {}
    rows = db.execute(
        select(Series.study_id, func.coalesce(func.sum(Series.image_count), 0))
        .where(Series.study_id.in_(study_ids))
        .group_by(Series.study_id)
    ).all()
    return {study_id: int(count or 0) for study_id, count in rows}


def enrich_studies_imaging(
    db: Session,
    studies: list[Study],
    system_settings: dict[str, str],
) -> dict[UUID, StudyImagingInfo]:
    if not studies:
        return {}

    study_ids = [s.id for s in studies]
    local_counts = _local_image_counts(db, study_ids)
    viewer_template = system_settings.get("pacs.web_viewer_url_template", "")
    orthanc_base = _orthanc_rest_base(system_settings.get("pacs.dicomweb_base_url", ""))

    orthanc_hits: dict[UUID, bool] = {sid: False for sid in study_ids}
    if orthanc_base:
        to_check = [
            s
            for s in studies
            if (s.accession_number or s.study_instance_uid)
            and local_counts.get(s.id, 0) == 0
        ]
        if to_check:
            with ThreadPoolExecutor(max_workers=min(8, len(to_check))) as pool:
                futures = {
                    pool.submit(
                        _orthanc_has_study,
                        orthanc_base,
                        accession_number=s.accession_number,
                        study_instance_uid=s.study_instance_uid,
                    ): s.id
                    for s in to_check
                }
                for future in as_completed(futures):
                    study_id = futures[future]
                    try:
                        orthanc_hits[study_id] = future.result()
                    except Exception:
                        orthanc_hits[study_id] = False

    result: dict[UUID, StudyImagingInfo] = {}
    for study in studies:
        local = local_counts.get(study.id, 0)
        in_orthanc = orthanc_hits.get(study.id, False) or local > 0
        has_images = in_orthanc
        viewer_url = build_pacs_viewer_url(
            viewer_template,
            accession_number=study.accession_number,
            study_instance_uid=study.study_instance_uid,
        )
        result[study.id] = StudyImagingInfo(
            has_images=has_images,
            image_count=local,
            pacs_viewer_url=viewer_url,
            images_in_archive=in_orthanc,
        )
    return result
