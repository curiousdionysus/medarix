"""Sync studies from PACS Query/Retrieve (Study Root C-FIND) into Medarix DB."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

from pydicom import Dataset
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Patient, Study
from app.services.dicom_util import decode_str, parse_dicom_date, parse_dicom_time, parse_modality, parse_patient_name
from app.services.pacs_qr_client import PacsConnectionError, PacsQueryParams, find_studies
from app.services.patient_crypto import build_name_search, encrypt_value, patient_hash

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PacsStudyItem:
    patient_id: str
    patient_name: str | None
    patient_sex: str | None
    patient_birth_date: date | None
    accession_number: str | None
    study_instance_uid: str
    modality: str | None
    study_date: date | None
    study_time: time | None
    study_description: str | None
    priority: str


@dataclass(frozen=True)
class PacsQuerySyncResult:
    fetched: int
    created: int
    updated: int
    skipped: int
    errors: list[str]


def parse_study_find_dataset(ds: Dataset) -> PacsStudyItem | None:
    study_uid = decode_str(getattr(ds, "StudyInstanceUID", None))
    patient_id = decode_str(getattr(ds, "PatientID", None))
    if not study_uid or not patient_id:
        return None

    return PacsStudyItem(
        patient_id=patient_id,
        patient_name=parse_patient_name(getattr(ds, "PatientName", None)),
        patient_sex=decode_str(getattr(ds, "PatientSex", None)),
        patient_birth_date=parse_dicom_date(getattr(ds, "PatientBirthDate", None)),
        accession_number=decode_str(getattr(ds, "AccessionNumber", None)),
        study_instance_uid=study_uid[:128],
        modality=parse_modality(getattr(ds, "ModalitiesInStudy", None))
        or parse_modality(getattr(ds, "Modality", None))
        or "OT",
        study_date=parse_dicom_date(getattr(ds, "StudyDate", None)),
        study_time=parse_dicom_time(getattr(ds, "StudyTime", None)),
        study_description=decode_str(getattr(ds, "StudyDescription", None)),
        priority="routine",
    )


def _resolve_sync_window(
    system_settings: dict[str, str],
    from_date: date | None,
    to_date: date | None,
) -> tuple[date, date]:
    today = datetime.now(timezone.utc).date()
    if from_date and to_date:
        return from_date, to_date
    days = int(
        system_settings.get("pacs.query_sync_days")
        or system_settings.get("pacs.mwl_sync_days", "7")
        or "7"
    )
    days = max(0, min(days, 90))
    return today - timedelta(days=days), today + timedelta(days=days)


def _pacs_connection_settings(system_settings: dict[str, str]) -> tuple[str, int, str, str]:
    host = (system_settings.get("pacs.host") or "").strip()
    port_raw = (system_settings.get("pacs.port") or "").strip()
    local_ae = (system_settings.get("pacs.ae_title") or "MEDARIX").strip()
    called_ae = (system_settings.get("pacs.called_ae_title") or "").strip()
    if not host or not port_raw or not called_ae:
        raise PacsConnectionError("PACS sunucusu, port veya çağrılan AE başlığı yapılandırılmamış.")
    try:
        port = int(port_raw)
    except ValueError as exc:
        raise PacsConnectionError(f"Geçersiz PACS portu: {port_raw}") from exc
    return host, port, local_ae, called_ae


def _upsert_patient(db: Session, item: PacsStudyItem) -> Patient:
    phash = patient_hash(item.patient_id)
    patient = db.scalar(select(Patient).where(Patient.patient_hash == phash))
    name_search = build_name_search(None, None, item.patient_name)
    if patient:
        if name_search and not patient.name_search:
            patient.name_search = name_search
        if item.patient_name and not patient.name_enc:
            patient.name_enc = encrypt_value(item.patient_name)
        if not patient.patient_id_enc:
            patient.patient_id_enc = encrypt_value(item.patient_id)
        if item.patient_sex and not patient.sex:
            patient.sex = item.patient_sex[:16]
        if item.patient_birth_date and not patient.birth_date:
            patient.birth_date = item.patient_birth_date
        return patient

    patient = Patient(
        patient_hash=phash,
        patient_id_enc=encrypt_value(item.patient_id),
        name_enc=encrypt_value(item.patient_name) if item.patient_name else None,
        name_search=name_search,
        birth_date=item.patient_birth_date,
        sex=item.patient_sex[:16] if item.patient_sex else None,
    )
    db.add(patient)
    db.flush()
    return patient


def _upsert_study(db: Session, patient: Patient, item: PacsStudyItem) -> tuple[Study, bool]:
    study = db.scalar(select(Study).where(Study.study_instance_uid == item.study_instance_uid))
    created = study is None
    if not study and item.accession_number:
        study = db.scalar(select(Study).where(Study.accession_number == item.accession_number))

    if not study:
        study = Study(
            patient_id=patient.id,
            study_instance_uid=item.study_instance_uid,
            accession_number=item.accession_number,
            modality=item.modality,
            study_date=item.study_date,
            study_time=item.study_time,
            study_description=item.study_description,
            status="available",
            priority=item.priority,
        )
        db.add(study)
        return study, True

    study.patient_id = patient.id
    if item.accession_number:
        study.accession_number = item.accession_number
    if item.modality:
        study.modality = item.modality
    if item.study_date:
        study.study_date = item.study_date
    if item.study_time:
        study.study_time = item.study_time
    if item.study_description:
        study.study_description = item.study_description
    study.priority = item.priority
    if study.status == "scheduled":
        study.status = "available"
    return study, created


def sync_studies_from_pacs_query(
    db: Session,
    system_settings: dict[str, str],
    *,
    from_date: date | None = None,
    to_date: date | None = None,
    modality: str | None = None,
    patient_id: str | None = None,
    accession_number: str | None = None,
) -> PacsQuerySyncResult:
    host, port, local_ae, called_ae = _pacs_connection_settings(system_settings)
    window_from, window_to = _resolve_sync_window(system_settings, from_date, to_date)

    params = PacsQueryParams(
        local_ae_title=local_ae,
        called_ae_title=called_ae,
        host=host,
        port=port,
        from_date=window_from,
        to_date=window_to,
        modality=modality,
        patient_id=patient_id,
        accession_number=accession_number,
    )

    datasets = find_studies(params)
    created = updated = skipped = 0
    errors: list[str] = []

    for index, dataset in enumerate(datasets):
        try:
            item = parse_study_find_dataset(dataset)
            if not item:
                skipped += 1
                continue
            patient = _upsert_patient(db, item)
            _, is_new = _upsert_study(db, patient, item)
            if is_new:
                created += 1
            else:
                updated += 1
        except Exception as exc:  # noqa: BLE001
            logger.exception("PACS C-FIND kaydı işlenemedi (index=%s)", index)
            errors.append(str(exc))
            skipped += 1

    db.commit()
    logger.info(
        "PACS Q/R sync: fetched=%s created=%s updated=%s skipped=%s errors=%s",
        len(datasets),
        created,
        updated,
        skipped,
        len(errors),
    )
    return PacsQuerySyncResult(
        fetched=len(datasets),
        created=created,
        updated=updated,
        skipped=skipped,
        errors=errors[:20],
    )
