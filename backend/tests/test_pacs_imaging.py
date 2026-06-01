from app.services.pacs_imaging import build_pacs_viewer_url


def test_build_pacs_viewer_url_accession():
    url = build_pacs_viewer_url(
        "https://pacs.example/viewer?AccessionNumber={accession}",
        accession_number="ACC123",
        study_instance_uid="1.2.3",
    )
    assert url == "https://pacs.example/viewer?AccessionNumber=ACC123"


def test_build_pacs_viewer_url_study_uid():
    url = build_pacs_viewer_url(
        "https://pacs.example/study/{study_instance_uid}",
        accession_number=None,
        study_instance_uid="1.2.3.4",
    )
    assert url == "https://pacs.example/study/1.2.3.4"


def test_build_pacs_viewer_url_requires_accession_placeholder():
    assert (
        build_pacs_viewer_url(
            "https://pacs.example/?a={accession}",
            accession_number=None,
            study_instance_uid="1.2.3",
        )
        is None
    )


def test_build_pacs_viewer_url_empty_template():
    assert build_pacs_viewer_url("", accession_number="A", study_instance_uid="B") is None
