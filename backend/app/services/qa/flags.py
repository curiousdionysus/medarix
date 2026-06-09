"""QA feature flag helpers."""

from __future__ import annotations

from app.services.system_settings import is_setting_enabled


def is_qa_enabled(settings: dict[str, str]) -> bool:
    return is_setting_enabled(settings, "qa.enabled", default=False)


def is_secondary_review_enabled(settings: dict[str, str]) -> bool:
    return is_qa_enabled(settings) and is_setting_enabled(settings, "qa.secondary_review_enabled", default=False)


def is_traceability_enabled(settings: dict[str, str]) -> bool:
    return is_qa_enabled(settings) and is_setting_enabled(settings, "qa.traceability_enabled", default=True)
