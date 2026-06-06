from datetime import date, datetime
from io import BytesIO

from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.uid import ImplicitVRLittleEndian, generate_uid

from app.models import Report, Study


def _format_dicom_patient_name(name: str | None) -> str:
    if not name or not name.strip():
        return "UNKNOWN"
    cleaned = name.strip()[:64]
    if "^" in cleaned:
        return cleaned
    parts = cleaned.split(None, 1)
    if len(parts) == 2:
        return f"{parts[1]}^{parts[0]}"[:64]
    return cleaned


def _format_dicom_study_date(study_date: date | None) -> str:
    if study_date:
        return study_date.strftime("%Y%m%d")
    return datetime.now().strftime("%Y%m%d")


def build_basic_text_sr(
    report: Report,
    study: Study,
    author_name: str,
    *,
    patient_dicom_id: str | None = None,
    patient_name: str | None = None,
) -> bytes:
    sop_instance_uid = generate_uid()
    series_instance_uid = generate_uid()

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.88.11"
    file_meta.MediaStorageSOPInstanceUID = sop_instance_uid
    file_meta.TransferSyntaxUID = ImplicitVRLittleEndian
    file_meta.ImplementationClassUID = generate_uid()

    now = datetime.now()
    dataset = FileDataset(
        None,
        {},
        file_meta=file_meta,
        preamble=b"\0" * 128,
    )
    dataset.is_little_endian = True
    dataset.is_implicit_VR = True

    dataset.SOPClassUID = file_meta.MediaStorageSOPClassUID
    dataset.SOPInstanceUID = sop_instance_uid
    dataset.StudyInstanceUID = study.study_instance_uid
    dataset.SeriesInstanceUID = series_instance_uid
    dataset.Modality = "SR"
    dataset.PatientName = _format_dicom_patient_name(patient_name)
    dataset.PatientID = (patient_dicom_id or study.accession_number or str(study.patient_id))[:64]
    dataset.AccessionNumber = (study.accession_number or "")[:16]
    dataset.StudyDate = _format_dicom_study_date(study.study_date)
    dataset.SeriesNumber = 999
    dataset.InstanceNumber = 1
    dataset.StudyDescription = (study.study_description or "Radiology Report")[:64]
    dataset.SeriesDescription = "Structured Report"
    dataset.ContentDate = now.strftime("%Y%m%d")
    dataset.ContentTime = now.strftime("%H%M%S")
    dataset.Manufacturer = "Radiology Platform"
    dataset.CompletionFlag = "COMPLETE"
    dataset.VerificationFlag = "UNVERIFIED"
    dataset.InstitutionName = author_name[:64]

    content = Dataset()
    content.RelationshipType = "CONTAINS"
    content.ValueType = "TEXT"
    concept = Dataset()
    concept.CodeValue = "18726-0"
    concept.CodingSchemeDesignator = "LN"
    concept.CodeMeaning = "Radiology Report"
    content.ConceptNameCodeSequence = [concept]
    content.TextValue = report.content[:1024 * 512]
    content.ContinuityOfContent = "SEPARATE"
    dataset.ContentSequence = [content]

    buffer = BytesIO()
    dataset.save_as(buffer, write_like_original=False)
    return buffer.getvalue()
