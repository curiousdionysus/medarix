"""DICOM Query/Retrieve (Study Root C-FIND / C-MOVE)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date

from pydicom import Dataset

logger = logging.getLogger(__name__)


class PacsConnectionError(RuntimeError):
    """Raised when association or Q/R operation fails."""


@dataclass(frozen=True)
class PacsQueryParams:
    local_ae_title: str
    called_ae_title: str
    host: str
    port: int
    from_date: date
    to_date: date
    modality: str | None = None
    patient_id: str | None = None
    accession_number: str | None = None
    study_instance_uid: str | None = None


@dataclass(frozen=True)
class PacsMoveParams:
    local_ae_title: str
    called_ae_title: str
    host: str
    port: int
    study_instance_uid: str
    move_destination_ae: str


def _format_dicom_date(value: date) -> str:
    return value.strftime("%Y%m%d")


def _build_study_find_dataset(params: PacsQueryParams) -> Dataset:
    ds = Dataset()
    ds.QueryRetrieveLevel = "STUDY"
    ds.PatientName = ""
    ds.PatientID = params.patient_id or ""
    ds.PatientBirthDate = ""
    ds.PatientSex = ""
    ds.StudyDate = f"{_format_dicom_date(params.from_date)}-{_format_dicom_date(params.to_date)}"
    ds.StudyTime = ""
    ds.AccessionNumber = params.accession_number or ""
    ds.StudyID = ""
    ds.StudyInstanceUID = params.study_instance_uid or ""
    ds.StudyDescription = ""
    ds.ModalitiesInStudy = params.modality or ""
    ds.NumberOfStudyRelatedSeries = ""
    ds.NumberOfStudyRelatedInstances = ""
    ds.ReferringPhysicianName = ""
    return ds


def find_studies(params: PacsQueryParams) -> list[Dataset]:
    """Study Root C-FIND — Query/Retrieve study level."""
    try:
        from pynetdicom import AE
        from pynetdicom.sop_class import StudyRootQueryRetrieveInformationModelFind
    except ImportError as exc:  # pragma: no cover
        raise PacsConnectionError("pynetdicom is not installed") from exc

    logger.info(
        "PACS C-FIND (STUDY): local_ae=%s called_ae=%s host=%s port=%s dates=%s..%s",
        params.local_ae_title,
        params.called_ae_title,
        params.host,
        params.port,
        params.from_date,
        params.to_date,
    )

    ae = AE(ae_title=params.local_ae_title[:16])
    ae.add_requested_context(StudyRootQueryRetrieveInformationModelFind)
    assoc = ae.associate(
        params.host,
        params.port,
        ae_title=params.called_ae_title[:16],
        max_pdu=16382,
    )
    if not assoc.is_established:
        reason = assoc.acceptor.primitive.result if assoc.acceptor else "unknown"
        assoc.release()
        raise PacsConnectionError(
            f"PACS ile DICOM association kurulamadı ({params.host}:{params.port}, "
            f"called AE={params.called_ae_title}): {reason}"
        )

    query_ds = _build_study_find_dataset(params)
    results: list[Dataset] = []
    try:
        for status, identifier in assoc.send_c_find(query_ds, StudyRootQueryRetrieveInformationModelFind):
            if status is None:
                continue
            status_code = int(getattr(status, "Status", 0) or 0)
            if status_code in (0xFF00, 0xFF01) and identifier is not None:
                results.append(identifier)
            elif status_code not in (0x0000, 0xFF00, 0xFF01):
                raise PacsConnectionError(f"C-FIND başarısız (status=0x{status_code:04X})")
    finally:
        assoc.release()

    logger.info("PACS C-FIND (STUDY) tamamlandı: %s çalışma", len(results))
    return results


def move_study(params: PacsMoveParams) -> dict:
    """Study Root C-MOVE — retrieve study to destination AE."""
    try:
        from pynetdicom import AE
        from pynetdicom.sop_class import StudyRootQueryRetrieveInformationModelMove
    except ImportError as exc:  # pragma: no cover
        raise PacsConnectionError("pynetdicom is not installed") from exc

    logger.info(
        "PACS C-MOVE: study=%s dest_ae=%s called_ae=%s host=%s:%s",
        params.study_instance_uid,
        params.move_destination_ae,
        params.called_ae_title,
        params.host,
        params.port,
    )

    ae = AE(ae_title=params.local_ae_title[:16])
    ae.add_requested_context(StudyRootQueryRetrieveInformationModelMove)
    assoc = ae.associate(
        params.host,
        params.port,
        ae_title=params.called_ae_title[:16],
        max_pdu=16382,
    )
    if not assoc.is_established:
        reason = assoc.acceptor.primitive.result if assoc.acceptor else "unknown"
        assoc.release()
        raise PacsConnectionError(f"C-MOVE association başarısız: {reason}")

    move_ds = Dataset()
    move_ds.QueryRetrieveLevel = "STUDY"
    move_ds.StudyInstanceUID = params.study_instance_uid

    outcome: dict = {
        "study_instance_uid": params.study_instance_uid,
        "move_destination_ae": params.move_destination_ae,
        "status": "failed",
        "completed": 0,
        "failed": 0,
        "warning": 0,
    }

    try:
        for status, identifier in assoc.send_c_move(
            move_ds,
            params.move_destination_ae[:16],
            StudyRootQueryRetrieveInformationModelMove,
        ):
            if status is None:
                continue
            status_code = int(getattr(status, "Status", 0) or 0)
            if status_code in (0xFF00, 0xFF01):
                continue
            if status_code == 0x0000:
                outcome["status"] = "completed"
                if identifier is not None:
                    outcome["completed"] = int(getattr(identifier, "NumberOfCompletedSuboperations", 0) or 0)
                    outcome["failed"] = int(getattr(identifier, "NumberOfFailedSuboperations", 0) or 0)
                    outcome["warning"] = int(getattr(identifier, "NumberOfWarningSuboperations", 0) or 0)
                break
            if status_code in (0xA702, 0xA801, 0xA900):
                raise PacsConnectionError(f"C-MOVE başarısız (status=0x{status_code:04X})")
    finally:
        assoc.release()

    logger.info("PACS C-MOVE sonucu: %s", outcome)
    return outcome
