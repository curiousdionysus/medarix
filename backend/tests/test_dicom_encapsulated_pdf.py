import uuid
from io import BytesIO

from pydicom import dcmread

from app.models import Report, ReportStatus, Study
from app.services.dicom_encapsulated_pdf import ENCAPSULATED_PDF_SOP_CLASS, build_encapsulated_pdf


def test_build_encapsulated_pdf_sop_class():
    study_id = uuid.uuid4()
    report = Report(
        id=uuid.uuid4(),
        study_id=study_id,
        author_id=uuid.uuid4(),
        status=ReportStatus.signed,
        content="BULGULAR:\nTest bulgu.",
        version=1,
    )
    study = Study(
        id=study_id,
        patient_id=uuid.uuid4(),
        study_instance_uid="1.2.3.4.5",
        accession_number="ACC001",
        modality="CT",
    )
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    dicom_bytes = build_encapsulated_pdf(
        pdf_bytes,
        report,
        study,
        "Dr Test",
        patient_dicom_id="12345",
        patient_name="Doe^John",
    )
    ds = dcmread(BytesIO(dicom_bytes))
    assert ds.SOPClassUID == ENCAPSULATED_PDF_SOP_CLASS
    assert ds.Modality == "DOC"
    assert ds.MIMETypeOfEncapsulatedDocument == "application/pdf"
    assert ds.PatientID == "12345"
    assert ds.AccessionNumber == "ACC001"
