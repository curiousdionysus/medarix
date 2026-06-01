"""DICOM Modality Worklist (MWL) C-FIND client."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta

from pydicom import Dataset

logger = logging.getLogger(__name__)


class MwlConnectionError(RuntimeError):
    """Raised when association or C-FIND fails."""


@dataclass(frozen=True)
class MwlQueryParams:
    local_ae_title: str
    called_ae_title: str
    host: str
    port: int
    from_date: date
    to_date: date
    modality: str | None = None
    patient_id: str | None = None
    accession_number: str | None = None


def _format_dicom_date(value: date) -> str:
    return value.strftime("%Y%m%d")


def _build_query_dataset(params: MwlQueryParams) -> Dataset:
    ds = Dataset()
    ds.PatientName = ""
    ds.PatientID = params.patient_id or ""
    ds.PatientBirthDate = ""
    ds.PatientSex = ""
    ds.AccessionNumber = params.accession_number or ""
    ds.StudyInstanceUID = ""
    ds.RequestedProcedureID = ""
    ds.RequestedProcedureDescription = ""
    ds.Modality = params.modality or ""
    ds.StudyDate = ""
    ds.ReferringPhysicianName = ""

    step = Dataset()
    step.ScheduledStationAETitle = ""
    step.ScheduledProcedureStepStartDate = (
        f"{_format_dicom_date(params.from_date)}-{_format_dicom_date(params.to_date)}"
    )
    step.ScheduledProcedureStepStartTime = ""
    step.Modality = params.modality or ""
    step.ScheduledProcedureStepDescription = ""
    step.ScheduledProcedureStepID = ""
    step.ScheduledStationName = ""
    ds.ScheduledProcedureStepSequence = [step]

    return ds


def find_modality_worklist(params: MwlQueryParams, *, timeout: int = 60) -> list[Dataset]:
    """Perform C-FIND against the configured PACS MWL SCP."""
    try:
        from pynetdicom import AE
        from pynetdicom.sop_class import ModalityWorklistInformationFind
    except ImportError as exc:  # pragma: no cover
        raise MwlConnectionError("pynetdicom is not installed") from exc

    ae = AE(ae_title=params.local_ae_title[:16])
    ae.add_requested_context(ModalityWorklistInformationFind)

    logger.info(
        "MWL C-FIND: local_ae=%s called_ae=%s host=%s port=%s dates=%s..%s",
        params.local_ae_title,
        params.called_ae_title,
        params.host,
        params.port,
        params.from_date,
        params.to_date,
    )

    assoc = ae.associate(
        params.host,
        params.port,
        ae_title=params.called_ae_title[:16],
        max_pdu=16382,
    )
    if not assoc.is_established:
        reason = assoc.acceptor.primitive.result if assoc.acceptor else "unknown"
        assoc.release()
        raise MwlConnectionError(
            f"PACS ile DICOM association kurulamadı ({params.host}:{params.port}, "
            f"called AE={params.called_ae_title}): {reason}"
        )

    query_ds = _build_query_dataset(params)
    results: list[Dataset] = []

    try:
        for status, identifier in assoc.send_c_find(query_ds, ModalityWorklistInformationFind):
            if status is None:
                continue
            status_code = int(getattr(status, "Status", 0) or 0)
            if status_code in (0xFF00, 0xFF01) and identifier is not None:
                results.append(identifier)
            elif status_code not in (0x0000, 0xFF00, 0xFF01):
                raise MwlConnectionError(f"MWL C-FIND başarısız (status=0x{status_code:04X})")
    finally:
        assoc.release()

    logger.info("MWL C-FIND tamamlandı: %s kayıt", len(results))
    return results
