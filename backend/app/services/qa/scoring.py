"""Quality score aggregation and risk classification."""

from __future__ import annotations

from app.services.qa.types import QAScores, RiskLevel


def classify_risk(overall_score: int) -> RiskLevel:
    if overall_score >= 95:
        return "low"
    if overall_score >= 80:
        return "medium"
    return "high"


def compute_scores(
    *,
    transcription_confidence: float,
    measurement_accuracy: float,
    laterality_accuracy: float,
    entity_preservation: float,
    reviewer_confidence: float,
) -> QAScores:
    weighted = (
        transcription_confidence * 0.15
        + measurement_accuracy * 0.30
        + laterality_accuracy * 0.20
        + entity_preservation * 0.25
        + reviewer_confidence * 0.10
    )
    overall = int(round(weighted * 100))
    overall = max(0, min(100, overall))
    return QAScores(
        transcription_confidence=transcription_confidence,
        measurement_accuracy=measurement_accuracy,
        laterality_accuracy=laterality_accuracy,
        entity_preservation=entity_preservation,
        reviewer_confidence=reviewer_confidence,
        overall_score=overall,
        risk_level=classify_risk(overall),
    )
