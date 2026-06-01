"""Sync Modality Worklist items from PACS into Medarix studies."""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from pydicom import Dataset
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Patient, Study
from app.services.mwl_client import MwlConnectionError, MwlQueryParams, find_modality_worklist
from app.services.patient_crypto import build_name_search, encrypt_value, patient_hash

logger = logging.getLogger(__name__)

_DICOM_DATE_RE = re.compile(r"^(\d{4})(\d{2})(\d{2})")


@dataclass(frozen=True)
class MwlItem:
    patient_id: str
    patient_name: str | None
    patient_sex: str | None
    patient_birth_date: date | None
    accession_number: str | None
    study_instance_uid: str
    modality: str | None
    study_date: date | None
    study_description: str | None
    priority: str


@dataclass(frozen=True)
class MwlSyncResult:
    fetched: int
    created: int
    updated: int
    skipped: int
    errors: list[str]


def _decode_str(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        text = value.decode("utf-8", errors="replace").strip()
    else:
        text = str(value).strip()
    return text or None


def _parse_dicom_date(value: object | None) -> date | None:
    text = _decode_str(value)
    if not text:
        return None
    token = text.split("-", 1)[0]
    match = _DICOM_DATE_RE.match(token)
    if not match:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def _parse_patient_name(value: object | None) -> str | None:
    text = _decode_str(value)
    if not text:
        return None
    return text.replace("^", " ").strip()


def _parse_priority(ds: Dataset) -> str:
    for tag in ("StudyPriorityID", "RequestedProcedurePriority"):
        raw = _decode_str(getattr(ds, tag, None))
        if not raw:
            continue
        upper = raw.upper()
        if upper in {"STAT", "S"}:
            return "stat"
        if upper in {"URGENT", "HIGH", "U", "H"}:
            return "urgent"
    return "routine"


def _scheduled_step(ds: Dataset) -> Dataset | None:
    seq = getattr(ds, "ScheduledProcedureStepSequence", None)
    if not seq:
        return None
    try:
        return seq[0]
    except (IndexError, TypeError):
        return None


def _synthetic_study_uid(patient_id: str, accession: str | None, procedure_id: str | None) -> str:
    key = "|".join(
        part
        for part in (patient_id.strip(), (accession or "").strip(), (procedure_id or "").strip())
        if part
    )
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return f"2.25.{int(digest[:32], 16)}"


def parse_mwl_dataset(ds: Dataset) -> MwlItem | None:
    patient_id = _decode_str(getattr(ds, "PatientID", None))
    if not patient_id:
        return None

    step = _scheduled_step(ds)
    accession = _decode_str(getattr(ds, "AccessionNumber", None))
    procedure_id = _decode_str(getattr(ds, "RequestedProcedureID", None))
    study_uid = _decode_str(getattr(ds, "StudyInstanceUID", None)) or _synthetic_study_uid(
        patient_id, accession, procedure_id
    )

    modality = _decode_str(getattr(ds, "Modality", None))
    if step is not None:
        modality = _decode_str(getattr(step, "Modality", None)) or modality
        study_date = _parse_dicom_date(getattr(step, "ScheduledProcedureStepStartDate", None))
        study_description = _decode_str(getattr(step, "ScheduledProcedureStepDescription", None))
    else:
        study_date = _parse_dicom_date(getattr(ds, "StudyDate", None))
        study_description = _decode_str(getattr(ds, "RequestedProcedureDescription", None))

    if not study_description:
        study_description = _decode_str(getattr(ds, "RequestedProcedureDescription", None))

    return MwlItem(
        patient_id=patient_id,
        patient_name=_parse_patient_name(getattr(ds, "PatientName", None)),
        patient_sex=_decode_str(getattr(ds, "PatientSex", None)),
        patient_birth_date=_parse_dicom_date(getattr(ds, "PatientBirthDate", None)),
        accession_number=accession,
        study_instance_uid=study_uid[:128],
        modality=(modality or "OT")[:32].upper(),
        study_date=study_date,
        study_description=study_description,
        priority=_parse_priority(ds),
    )


def _resolve_sync_window(
    system_settings: dict[str, str],
    from_date: date | None,
    to_date: date | None,
) -> tuple[date, date]:
    today = datetime.now(timezone.utc).date()
    if from_date and to_date:
        return from_date, to_date
    days = int(system_settings.get("pacs.mwl_sync_days", "7") or "7")
    days = max(0, min(days, 90))
    return today - timedelta(days=days), today + timedelta(days=days)


def _upsert_patient(db: Session, item: MwlItem) -> Patient:
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


def _upsert_study(db: Session, patient: Patient, item: MwlItem) -> tuple[Study, bool]:
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
            study_description=item.study_description,
            status="scheduled",
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
    if item.study_description:
        study.study_description = item.study_description
    study.priority = item.priority
    if study.status in {"", "available"}:
        study.status = "scheduled"
    return study, created


def sync_worklist_from_pacs(
    db: Session,
    system_settings: dict[str, str],
    *,
    from_date: date | None = None,
    to_date: date | None = None,
    modality: str | None = None,
    patient_id: str | None = None,
    accession_number: str | None = None,
) -> MwlSyncResult:
    host = (system_settings.get("pacs.host") or "").strip()
    port_raw = (system_settings.get("pacs.port") or "").strip()
    local_ae = (system_settings.get("pacs.ae_title") or "MEDARIX").strip()
    called_ae = (system_settings.get("pacs.called_ae_title") or "").strip()

    if not host or not port_raw or not called_ae:
        raise MwlConnectionError("PACS sunucusu, port veya çağrılan AE başlığı yapılandırılmamış.")

    try:
        port = int(port_raw)
    except ValueError as exc:
        raise MwlConnectionError(f"Geçersiz PACS portu: {port_raw}") from exc

    window_from, window_to = _resolve_sync_window(system_settings, from_date, to_date)
    params = MwlQueryParams(
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

    datasets = find_modality_worklist(params)
    created = updated = skipped = 0
    errors: list[str] = []

    for index, dataset in enumerate(datasets):
        try:
            item = parse_mwl_dataset(dataset)
            if not item:
                skipped += 1
                continue
            patient = _upsert_patient(db, item)
            _, is_new = _upsert_study(db, patient, item)
            if is_new:
                created += 1
            else:
                updated += 1
        except Exception as exc:  # noqa: BLE001 — collect row errors, continue batch
            logger.exception("MWL kaydı işlenemedi (index=%s)", index)
            errors.append(str(exc))
            skipped += 1

    db.commit()
    logger.info(
        "MWL sync: fetched=%s created=%s updated=%s skipped=%s errors=%s",
        len(datasets),
        created,
        updated,
        skipped,
        len(errors),
    )
    return MwlSyncResult(
        fetched=len(datasets),
        created=created,
        updated=updated,
        skipped=skipped,
        errors=errors[:20],
    )
