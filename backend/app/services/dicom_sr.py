from datetime import datetime
from io import BytesIO

from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

from app.models import Report, Study


def build_basic_text_sr(report: Report, study: Study, author_name: str) -> bytes:
    sop_instance_uid = generate_uid()
    series_instance_uid = generate_uid()

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.88.11"
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

    dataset.SOPClassUID = file_meta.MediaStorageSOPClassUID
    dataset.SOPInstanceUID = sop_instance_uid
    dataset.StudyInstanceUID = study.study_instance_uid
    dataset.SeriesInstanceUID = series_instance_uid
    dataset.Modality = "SR"
    dataset.PatientName = "ANON^PATIENT"
    dataset.PatientID = str(study.patient_id)
    dataset.AccessionNumber = study.accession_number or ""
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
