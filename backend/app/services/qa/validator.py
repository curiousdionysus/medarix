"""Report QA validation orchestrator — read-only; never modifies report text."""

from __future__ import annotations

from app.services.qa.entities import validate_entities
from app.services.qa.laterality import validate_laterality
from app.services.qa.measurements import validate_measurements
from app.services.qa.reviewer import run_secondary_reviewer
from app.services.qa.scoring import compute_scores
from app.services.qa.traceability import build_traceability
from app.services.qa.types import QAValidationResult


async def validate_report_qa(
    *,
    transcript: str,
    report: str,
    transcription_confidence: float = 0.97,
    enable_traceability: bool = True,
    enable_secondary_review: bool = False,
    text_base_url: str | None = None,
    primary_model: str | None = None,
    review_model: str | None = None,
) -> QAValidationResult:
    if not transcript.strip() or not report.strip():
        scores = compute_scores(
            transcription_confidence=transcription_confidence,
            measurement_accuracy=0.0,
            laterality_accuracy=0.0,
            entity_preservation=0.0,
            reviewer_confidence=0.0,
        )
        return QAValidationResult(
            findings=[],
            scores=scores,
            traceability=[],
            primary_model=primary_model,
            review_model=review_model,
        )

    findings: list = []
    m_findings, measurement_accuracy = validate_measurements(transcript, report)
    findings.extend(m_findings)

    l_findings, laterality_accuracy = validate_laterality(transcript, report)
    findings.extend(l_findings)

    e_findings, entity_preservation = validate_entities(transcript, report)
    findings.extend(e_findings)

    traceability = build_traceability(transcript, report) if enable_traceability else []

    reviewer_payload = None
    reviewer_confidence = 1.0
    if enable_secondary_review and text_base_url and review_model:
        reviewer_payload, reviewer_findings, reviewer_confidence = await run_secondary_reviewer(
            text_base_url=text_base_url,
            review_model=review_model,
            transcript=transcript,
            report=report,
        )
        findings.extend(reviewer_findings)
    elif enable_secondary_review:
        reviewer_confidence = 0.0

    scores = compute_scores(
        transcription_confidence=transcription_confidence,
        measurement_accuracy=measurement_accuracy,
        laterality_accuracy=laterality_accuracy,
        entity_preservation=entity_preservation,
        reviewer_confidence=reviewer_confidence,
    )

    return QAValidationResult(
        findings=findings,
        scores=scores,
        traceability=traceability,
        reviewer_findings=reviewer_payload,
        primary_model=primary_model,
        review_model=review_model if enable_secondary_review else None,
    )
