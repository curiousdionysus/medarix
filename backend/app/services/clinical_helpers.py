from app.models import Patient, ReportStatus, Study
from app.schemas import StudyOut
from app.services.patient_crypto import decrypt_value


def serialize_study(
    study: Study,
    patient: Patient | None = None,
    report_status: ReportStatus | None = None,
) -> StudyOut:
    patient_name = decrypt_value(patient.name_enc) if patient else None
    patient_tc = decrypt_value(patient.patient_id_enc) if patient else None
    return StudyOut(
        id=study.id,
        study_instance_uid=study.study_instance_uid,
        accession_number=study.accession_number,
        modality=study.modality,
        study_date=study.study_date,
        study_description=study.study_description,
        status=study.status,
        priority=getattr(study, "priority", "routine"),
        report_status=report_status,
        patient_name=patient_name,
        patient_tc=patient_tc,
    )
