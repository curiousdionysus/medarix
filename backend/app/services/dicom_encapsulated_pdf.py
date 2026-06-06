"""Build DICOM Encapsulated PDF Storage objects for PACS C-STORE."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO

from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.encaps import encapsulate
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

from app.models import Report, Study
from app.services.dicom_sr import _format_dicom_patient_name, _format_dicom_study_date

ENCAPSULATED_PDF_SOP_CLASS = "1.2.840.10008.5.1.4.1.1.104.1"


def build_encapsulated_pdf(
    pdf_bytes: bytes,
    report: Report,
    study: Study,
    author_name: str,
    *,
    patient_dicom_id: str | None = None,
    patient_name: str | None = None,
) -> bytes:
    if not pdf_bytes:
        raise ValueError("PDF payload is empty")

    sop_instance_uid = generate_uid()
    series_instance_uid = generate_uid()

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = ENCAPSULATED_PDF_SOP_CLASS
    file_meta.MediaStorageSOPInstanceUID = sop_instance_uid
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = generate_uid()

    now = datetime.now()
    dataset = FileDataset(
        None,
        {},
        file_meta=file_meta,
        preamble=b"\0" * 128,
    )
    dataset.is_little_endian = True
    dataset.is_implicit_VR = False

    dataset.SOPClassUID = ENCAPSULATED_PDF_SOP_CLASS
    dataset.SOPInstanceUID = sop_instance_uid
    dataset.StudyInstanceUID = study.study_instance_uid
    dataset.SeriesInstanceUID = series_instance_uid
    dataset.Modality = "DOC"
    dataset.PatientName = _format_dicom_patient_name(patient_name)
    dataset.PatientID = (patient_dicom_id or study.accession_number or str(study.patient_id))[:64]
    dataset.AccessionNumber = (study.accession_number or "")[:16]
    dataset.StudyDate = _format_dicom_study_date(study.study_date)
    dataset.SeriesNumber = 998
    dataset.InstanceNumber = 1
    dataset.StudyDescription = (study.study_description or "Radiology Report")[:64]
    dataset.SeriesDescription = "Radiology Report PDF"
    dataset.ContentDate = now.strftime("%Y%m%d")
    dataset.ContentTime = now.strftime("%H%M%S")
    dataset.Manufacturer = "Medarix"
    dataset.InstitutionName = author_name[:64]
    dataset.MIMETypeOfEncapsulatedDocument = "application/pdf"
    dataset.DocumentTitle = "Medarix Raporu"
    dataset.BurnedInAnnotation = "NO"
    dataset.ConversionType = "WSD"
    dataset.EncapsulatedDocument = encapsulate([pdf_bytes])

    buffer = BytesIO()
    dataset.save_as(buffer, write_like_original=False)
    return buffer.getvalue()
