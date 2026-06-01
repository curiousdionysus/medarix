from app.models import Patient, ReportStatus, Study
from app.schemas import StudyOut
from app.services.pacs_imaging import StudyImagingInfo
from app.services.patient_crypto import decrypt_value


def serialize_study(
    study: Study,
    patient: Patient | None = None,
    report_status: ReportStatus | None = None,
    imaging: StudyImagingInfo | None = None,
) -> StudyOut:
    patient_name = decrypt_value(patient.name_enc) if patient else None
    patient_tc = decrypt_value(patient.patient_id_enc) if patient else None
    return StudyOut(
        id=study.id,
        study_instance_uid=study.study_instance_uid,
        accession_number=study.accession_number,
        modality=study.modality,
        study_date=study.study_date,
        study_time=study.study_time,
        study_description=study.study_description,
        status=study.status,
        priority=getattr(study, "priority", "routine"),
        report_status=report_status,
        patient_name=patient_name,
        patient_tc=patient_tc,
        has_images=imaging.has_images if imaging else False,
        image_count=imaging.image_count if imaging else 0,
        pacs_viewer_url=imaging.pacs_viewer_url if imaging else None,
    )
