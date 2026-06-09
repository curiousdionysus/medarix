"""Shared types for the Report QA subsystem."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Severity = Literal["info", "warning", "critical"]
RiskLevel = Literal["low", "medium", "high"]


@dataclass(frozen=True)
class QAFinding:
    type: str
    severity: Severity
    message: str
    original: str | None = None
    report: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "type": self.type,
            "severity": self.severity,
            "message": self.message,
        }
        if self.original is not None:
            payload["original"] = self.original
        if self.report is not None:
            payload["report"] = self.report
        if self.details:
            payload["details"] = self.details
        return payload


@dataclass(frozen=True)
class QAScores:
    transcription_confidence: float
    measurement_accuracy: float
    laterality_accuracy: float
    entity_preservation: float
    reviewer_confidence: float
    overall_score: int
    risk_level: RiskLevel

    def to_dict(self) -> dict[str, Any]:
        return {
            "transcription_confidence": round(self.transcription_confidence, 4),
            "measurement_accuracy": round(self.measurement_accuracy, 4),
            "laterality_accuracy": round(self.laterality_accuracy, 4),
            "entity_preservation": round(self.entity_preservation, 4),
            "reviewer_confidence": round(self.reviewer_confidence, 4),
            "overall_score": self.overall_score,
            "risk_level": self.risk_level,
        }


@dataclass(frozen=True)
class SentenceTrace:
    report_sentence: str
    transcript_source: str
    start_time: str | None = None
    end_time: str | None = None
    confidence: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "report_sentence": self.report_sentence,
            "transcript_source": self.transcript_source,
            "confidence": round(self.confidence, 4),
        }
        if self.start_time is not None:
            payload["start_time"] = self.start_time
        if self.end_time is not None:
            payload["end_time"] = self.end_time
        return payload


@dataclass
class QAValidationResult:
    findings: list[QAFinding]
    scores: QAScores
    traceability: list[SentenceTrace] = field(default_factory=list)
    reviewer_findings: dict[str, Any] | None = None
    primary_model: str | None = None
    review_model: str | None = None

    def findings_dicts(self) -> list[dict[str, Any]]:
        return [f.to_dict() for f in self.findings]

    def traceability_dicts(self) -> list[dict[str, Any]]:
        return [t.to_dict() for t in self.traceability]
