"""Report QA validation unit tests."""

import asyncio

import pytest

from app.services.qa.entities import extract_entities, validate_entities
from app.services.qa.laterality import validate_laterality
from app.services.qa.measurements import extract_measurements, validate_measurements
from app.services.qa.scoring import classify_risk, compute_scores
from app.services.qa.traceability import build_traceability
from app.services.qa.validator import validate_report_qa


def test_measurement_mismatch_detected():
    transcript = "Sol akciğerde 12 mm nodül izlendi."
    report = "Sol akciğerde 21 mm nodül izlendi."
    findings, accuracy = validate_measurements(transcript, report)
    assert any(f.type == "measurement_mismatch" for f in findings)
    assert accuracy < 1.0


def test_measurement_added_hallucination():
    transcript = "Akciğer grafisi değerlendirildi."
    report = "Akciğer grafisinde 15 mm opasite izlendi."
    findings, _ = validate_measurements(transcript, report)
    assert any(f.type == "measurement_added" for f in findings)


def test_extract_measurements_units():
    text = "Lezyon 2.5 cm, 4.2 SUVmax, yoğunluk 45 HU"
    ms = extract_measurements(text)
    units = {m.unit for m in ms}
    assert "cm" in units
    assert "SUVmax" in units
    assert "HU" in units


def test_laterality_missing():
    transcript = "Sağ böbrekte kist izlendi."
    report = "Böbrekte kist izlendi."
    findings, accuracy = validate_laterality(transcript, report)
    assert any(f.type == "laterality_missing" for f in findings)
    assert accuracy < 1.0


def test_laterality_english_turkish():
    transcript = "Right lung is clear."
    report = "Sol akciğer temiz."
    findings, _ = validate_laterality(transcript, report)
    assert findings


def test_entity_removed():
    transcript = "Karaciğerde kist ve nodül izlendi."
    report = "Karaciğerde kist izlendi."
    findings, preservation = validate_entities(transcript, report)
    assert any(f.type == "entity_removed" for f in findings)
    assert preservation < 1.0


def test_entity_added_hallucination():
    transcript = "Akciğer grafisi normal."
    report = "Akciğer grafisinde nodül izlendi."
    findings, _ = validate_entities(transcript, report)
    assert any(f.type == "entity_added" for f in findings)


def test_entity_extraction_bilingual():
    entities = extract_entities("Akciğer nodülü ve pleural effusion")
    assert "nodülü" in entities or "nodül" in entities or "nodule" in entities


def test_scoring_risk_bands():
    assert classify_risk(97) == "low"
    assert classify_risk(85) == "medium"
    assert classify_risk(70) == "high"


def test_compute_overall_score():
    scores = compute_scores(
        transcription_confidence=0.97,
        measurement_accuracy=1.0,
        laterality_accuracy=1.0,
        entity_preservation=0.96,
        reviewer_confidence=0.94,
    )
    assert scores.overall_score >= 95
    assert scores.risk_level == "low"


def test_traceability_maps_sentences():
    transcript = "Akciğer grafisi değerlendirildi. Sol akciğerde opasite yok."
    report = "BULGULAR: Sol akciğerde opasite saptanmadı."
    traces = build_traceability(transcript, report)
    assert len(traces) >= 1
    assert traces[0].transcript_source


def test_validator_orchestrator_no_modify():
    transcript = "Sağ akciğerde 10 mm nodül."
    report = "Sağ akciğerde 10 mm nodül izlendi."
    result = asyncio.run(
        validate_report_qa(
            transcript=transcript,
            report=report,
            enable_traceability=True,
            enable_secondary_review=False,
        )
    )
    assert result.scores.overall_score >= 80
    assert report == "Sağ akciğerde 10 mm nodül izlendi."


def test_validator_critical_measurement_low_score():
    transcript = "Sağ akciğerde 12 mm lezyon."
    report = "Sağ akciğerde 25 mm lezyon."
    result = asyncio.run(
        validate_report_qa(transcript=transcript, report=report, enable_secondary_review=False)
    )
    assert result.scores.overall_score < 95
    assert any(f.severity == "critical" for f in result.findings)
