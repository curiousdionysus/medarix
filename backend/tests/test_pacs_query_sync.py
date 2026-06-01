from datetime import date, time

from pydicom import Dataset

from app.services.pacs_query_sync import parse_study_find_dataset


def test_parse_study_find_dataset():
    ds = Dataset()
    ds.PatientID = "12345678901"
    ds.PatientName = "TEST^PATIENT"
    ds.StudyInstanceUID = "1.2.3.4.5"
    ds.AccessionNumber = "ACC001"
    ds.StudyDate = "20260601"
    ds.StudyTime = "143025"
    ds.ModalitiesInStudy = "CT\\SR"
    ds.StudyDescription = "BT Abdomen"

    item = parse_study_find_dataset(ds)
    assert item is not None
    assert item.study_instance_uid == "1.2.3.4.5"
    assert item.patient_id == "12345678901"
    assert item.modality == "CT"
    assert item.study_date == date(2026, 6, 1)
    assert item.study_time == time(14, 30, 25)
