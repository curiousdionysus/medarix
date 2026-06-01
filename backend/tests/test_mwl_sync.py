from datetime import date

from pydicom import Dataset

from app.services.mwl_sync import parse_mwl_dataset


def test_parse_mwl_dataset_minimal():
    ds = Dataset()
    ds.PatientID = "12345678901"
    ds.PatientName = "DEMO^HASTA"
    ds.AccessionNumber = "ACC2026001"
    ds.Modality = "CT"
    step = Dataset()
    step.ScheduledProcedureStepStartDate = "20260601"
    step.Modality = "CT"
    step.ScheduledProcedureStepDescription = "BT Toraks"
    ds.ScheduledProcedureStepSequence = [step]

    item = parse_mwl_dataset(ds)
    assert item is not None
    assert item.patient_id == "12345678901"
    assert item.patient_name == "DEMO HASTA"
    assert item.accession_number == "ACC2026001"
    assert item.modality == "CT"
    assert item.study_date == date(2026, 6, 1)
    assert item.study_description == "BT Toraks"


def test_parse_mwl_dataset_synthetic_uid_when_missing():
    ds = Dataset()
    ds.PatientID = "999"
    ds.AccessionNumber = "A1"
    item = parse_mwl_dataset(ds)
    assert item is not None
    assert item.study_instance_uid.startswith("2.25.")
