from datetime import date, time

from app.services.dicom_util import parse_dicom_date, parse_dicom_time


def test_parse_dicom_time_hhmmss():
    assert parse_dicom_time("143025") == time(14, 30, 25)
    assert parse_dicom_time("093000.5") == time(9, 30, 0)


def test_parse_dicom_time_short():
    assert parse_dicom_time("0800") == time(8, 0, 0)


def test_parse_study_date_and_time_together():
    assert parse_dicom_date("20260601") == date(2026, 6, 1)
    assert parse_dicom_time("") is None
