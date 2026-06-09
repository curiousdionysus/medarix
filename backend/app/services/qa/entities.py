"""Rule-based clinical entity extraction and preservation checks."""

from __future__ import annotations

import re

from app.services.qa.types import QAFinding

# Turkish + English radiology entity lexicon (extendable without schema changes).
ENTITY_TERMS: tuple[str, ...] = (
    "akciğer",
    "lung",
    "karaciğer",
    "liver",
    "böbrek",
    "kidney",
    "dalak",
    "spleen",
    "pankreas",
    "pancreas",
    "mediasten",
    "mediastinum",
    "plevra",
    "pleura",
    "nodule",
    "nodül",
    "nodülü",
    "kitle",
    "mass",
    "lezyon",
    "lesion",
    "kist",
    "cyst",
    "kalsifikasyon",
    "calcification",
    "fracture",
    "kırık",
    "kırığı",
    "hemoraji",
    "hemorrhage",
    "kanama",
    "ödem",
    "edema",
    "infiltrasyon",
    "infiltration",
    "efüzyon",
    "effusion",
    "pnömotoraks",
    "pneumothorax",
    "lenf nodu",
    "lymph node",
    "tumor",
    "tümör",
    "metastaz",
    "metastasis",
    "stenoz",
    "stenosis",
    "anevrizma",
    "aneurysm",
)

ENTITY_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(term) for term in sorted(ENTITY_TERMS, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)


def extract_entities(text: str) -> set[str]:
    normalized: set[str] = set()
    for match in ENTITY_PATTERN.finditer(text or ""):
        normalized.add(match.group(1).lower())
    return normalized


def validate_entities(transcript: str, report: str) -> tuple[list[QAFinding], float]:
    transcript_entities = extract_entities(transcript)
    report_entities = extract_entities(report)
    findings: list[QAFinding] = []

    for entity in sorted(transcript_entities - report_entities):
        findings.append(
            QAFinding(
                type="entity_removed",
                severity="critical",
                message="Transkriptteki klinik bulgu raporda eksik.",
                original=entity,
                report=None,
            )
        )
    for entity in sorted(report_entities - transcript_entities):
        findings.append(
            QAFinding(
                type="entity_added",
                severity="critical",
                message="Raporda transkriptte olmayan yeni bulgu eklendi (olası halüsinasyon).",
                original=None,
                report=entity,
            )
        )

    if not transcript_entities:
        preservation = 1.0
    else:
        preserved = len(transcript_entities & report_entities)
        preservation = preserved / len(transcript_entities)
    return findings, preservation
