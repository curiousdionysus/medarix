"""Optional secondary AI reviewer for hallucination / omission detection."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.services.ai_gateway import ai_gateway
from app.services.qa.types import QAFinding

logger = logging.getLogger(__name__)

REVIEWER_SYSTEM_PROMPT = """Sen bir radyoloji rapor kalite denetçisisin.
Görevin transkript ile oluşturulmuş raporu karşılaştırmaktır.
Raporu ASLA yeniden yazma veya düzeltme.

Yalnızca geçerli JSON döndür:
{
  "confidence": 0.0-1.0,
  "hallucinations": ["..."],
  "omissions": ["..."],
  "meaning_alterations": ["..."],
  "summary": "kısa Türkçe özet"
}
"""


def _parse_reviewer_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        payload = json.loads(text)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        logger.warning("QA reviewer returned non-JSON response")
    return {
        "confidence": 0.5,
        "hallucinations": [],
        "omissions": [],
        "meaning_alterations": [],
        "summary": raw[:500],
    }


async def run_secondary_reviewer(
    *,
    text_base_url: str,
    review_model: str,
    transcript: str,
    report: str,
) -> tuple[dict[str, Any], list[QAFinding], float]:
    user_prompt = (
        "TRANSKRİPT:\n"
        f"{transcript}\n\n"
        "RAPOR:\n"
        f"{report}\n\n"
        "Halüsinasyon, eksiklik ve anlam değişikliklerini JSON olarak listele."
    )
    try:
        raw = await ai_gateway._chat(  # noqa: SLF001 — internal reuse for isolated QA module
            text_base_url,
            review_model,
            REVIEWER_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.0,
        )
    except httpx.HTTPError as exc:
        logger.warning("Secondary QA reviewer failed: %s", exc)
        payload = {
            "confidence": 0.0,
            "hallucinations": [],
            "omissions": [],
            "meaning_alterations": [],
            "summary": f"Reviewer unavailable: {exc}",
            "error": True,
        }
        return payload, [], 0.0

    payload = _parse_reviewer_json(raw)
    confidence = float(payload.get("confidence", 0.5))
    confidence = max(0.0, min(1.0, confidence))
    findings: list[QAFinding] = []

    for item in payload.get("hallucinations") or []:
        findings.append(
            QAFinding(
                type="reviewer_hallucination",
                severity="critical",
                message="İkincil denetçi: olası halüsinasyon.",
                report=str(item),
            )
        )
    for item in payload.get("omissions") or []:
        findings.append(
            QAFinding(
                type="reviewer_omission",
                severity="warning",
                message="İkincil denetçi: olası eksiklik.",
                original=str(item),
            )
        )
    for item in payload.get("meaning_alterations") or []:
        findings.append(
            QAFinding(
                type="reviewer_meaning_alteration",
                severity="critical",
                message="İkincil denetçi: anlam değişikliği.",
                details={"detail": str(item)},
            )
        )
    return payload, findings, confidence
