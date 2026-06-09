"""Laterality (side) consistency validation — Turkish and English."""

from __future__ import annotations

import re

from app.services.qa.types import QAFinding

LATERALITY_PATTERNS: dict[str, re.Pattern[str]] = {
    "right": re.compile(r"\b(right|sağ|sag)\b", re.IGNORECASE),
    "left": re.compile(r"\b(left|sol)\b", re.IGNORECASE),
    "bilateral": re.compile(r"\b(bilateral|bilaterally|bilateral|iki\s*taraf|her\s*iki\s*taraf)\b", re.IGNORECASE),
}


def _extract_lateralities(text: str) -> set[str]:
    found: set[str] = set()
    for side, pattern in LATERALITY_PATTERNS.items():
        if pattern.search(text or ""):
            found.add(side)
    return found


def validate_laterality(transcript: str, report: str) -> tuple[list[QAFinding], float]:
    transcript_sides = _extract_lateralities(transcript)
    report_sides = _extract_lateralities(report)
    findings: list[QAFinding] = []

    removed = transcript_sides - report_sides
    added = report_sides - transcript_sides

    for side in removed:
        findings.append(
            QAFinding(
                type="laterality_missing",
                severity="critical",
                message=f"Transkriptteki lateralite ({side}) raporda kayboldu.",
                original=side,
                report=None,
            )
        )
    for side in added:
        findings.append(
            QAFinding(
                type="laterality_added",
                severity="critical",
                message=f"Raporda transkriptte olmayan lateralite ({side}) eklendi.",
                original=None,
                report=side,
            )
        )

    # Conflicting sides without bilateral
    if {"left", "right"}.issubset(report_sides) and "bilateral" not in report_sides:
        if "bilateral" in transcript_sides or not ({"left", "right"} <= transcript_sides):
            findings.append(
                QAFinding(
                    type="laterality_conflict",
                    severity="warning",
                    message="Raporda hem sağ hem sol belirtilmiş; bilateral ifadesi yok.",
                )
            )

    total = max(len(transcript_sides), 1)
    errors = sum(1 for f in findings if f.severity == "critical")
    accuracy = max(0.0, 1.0 - (errors / total))
    if not transcript_sides and not report_sides:
        accuracy = 1.0
    return findings, accuracy
