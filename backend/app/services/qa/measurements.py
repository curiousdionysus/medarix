"""Extract and compare numeric measurements between transcript and report."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.qa.types import QAFinding

MEASUREMENT_PATTERN = re.compile(
    r"(?P<value>\d+(?:[.,]\d+)?)\s*(?P<unit>mm|cm|mm²|mm2|ml|cc|%|hu|suv|suvmax|mm³|mm3)\b",
    re.IGNORECASE,
)

NORMALIZE_UNIT = {
    "mm2": "mm²",
    "mm3": "mm³",
    "hu": "HU",
    "suv": "SUV",
    "suvmax": "SUVmax",
}


@dataclass(frozen=True)
class Measurement:
    value: float
    unit: str
    raw: str

    @property
    def key(self) -> tuple[float, str]:
        return (self.value, self.unit)


def _normalize_unit(unit: str) -> str:
    lowered = unit.lower()
    return NORMALIZE_UNIT.get(lowered, unit if unit == "HU" or unit == "SUVmax" else lowered)


def _parse_value(raw: str) -> float:
    return float(raw.replace(",", "."))


def extract_measurements(text: str) -> list[Measurement]:
    results: list[Measurement] = []
    for match in MEASUREMENT_PATTERN.finditer(text or ""):
        unit = _normalize_unit(match.group("unit"))
        value = _parse_value(match.group("value"))
        results.append(Measurement(value=value, unit=unit, raw=match.group(0)))
    return results


def validate_measurements(transcript: str, report: str) -> tuple[list[QAFinding], float]:
    transcript_ms = extract_measurements(transcript)
    report_ms = extract_measurements(report)
    findings: list[QAFinding] = []

    transcript_keys = [m.key for m in transcript_ms]
    report_keys = [m.key for m in report_ms]

    # Missing measurements (in transcript but not in report)
    for m in transcript_ms:
        if m.key not in report_keys:
            findings.append(
                QAFinding(
                    type="measurement_missing",
                    severity="critical",
                    message="Transkriptteki ölçüm raporda bulunamadı.",
                    original=m.raw,
                    report=None,
                )
            )

    # Added measurements (in report but not in transcript)
    for m in report_ms:
        if m.key not in transcript_keys:
            findings.append(
                QAFinding(
                    type="measurement_added",
                    severity="critical",
                    message="Raporda transkriptte olmayan yeni ölçüm tespit edildi.",
                    original=None,
                    report=m.raw,
                )
            )

    # Modified measurements (same unit, different value)
    transcript_by_unit: dict[str, list[Measurement]] = {}
    report_by_unit: dict[str, list[Measurement]] = {}
    for m in transcript_ms:
        transcript_by_unit.setdefault(m.unit, []).append(m)
    for m in report_ms:
        report_by_unit.setdefault(m.unit, []).append(m)

    for unit, t_list in transcript_by_unit.items():
        r_list = report_by_unit.get(unit, [])
        for idx, t_m in enumerate(t_list):
            if idx >= len(r_list):
                break
            r_m = r_list[idx]
            if t_m.value != r_m.value:
                findings.append(
                    QAFinding(
                        type="measurement_mismatch",
                        severity="critical",
                        message="Ölçüm değeri transkript ile uyuşmuyor.",
                        original=t_m.raw,
                        report=r_m.raw,
                        details={"unit": unit},
                    )
                )

    total = max(len(transcript_ms), 1)
    critical = sum(1 for f in findings if f.severity == "critical")
    accuracy = max(0.0, 1.0 - (critical / total))
    if not transcript_ms and not report_ms:
        accuracy = 1.0
    return findings, accuracy
