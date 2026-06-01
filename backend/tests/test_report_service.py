from app.models import ReportStatus
from app.services.report_service import upsert_study_report


class DummyUser:
    id = "00000000-0000-0000-0000-000000000001"


def test_upsert_increments_version_on_draft(monkeypatch):
    class FakeReport:
        def __init__(self):
            self.id = "report-1"
            self.study_id = "study-1"
            self.author_id = DummyUser.id
            self.status = ReportStatus.draft
            self.content = "old"
            self.transcript = "old transcript"
            self.version = 1

    latest = FakeReport()
    calls = {"commit": 0, "added": []}

    class FakeSession:
        def get(self, model, study_id):
            return object()

        def add(self, obj):
            calls["added"].append(obj)

        def commit(self):
            calls["commit"] += 1

        def refresh(self, report):
            pass

    from app.services import report_service

    monkeypatch.setattr(report_service, "get_latest_report", lambda db, study_id: latest)
    report = upsert_study_report(
        FakeSession(),
        study_id="study-1",
        author=DummyUser(),
        content="new content",
        transcript="new transcript",
        status=ReportStatus.draft,
    )
    assert report.content == "new content"
    assert report.version == 2
    # One commit for the report update, one for the version snapshot.
    assert calls["commit"] == 2
    # A ReportVersion snapshot is persisted.
    assert len(calls["added"]) == 1
