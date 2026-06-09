"""Sentence-level traceability between report and transcript."""

from __future__ import annotations

import re

from app.services.qa.types import SentenceTrace

SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def _token_set(text: str) -> set[str]:
    return {t for t in re.findall(r"\w+", text.lower()) if len(t) > 2}


def _similarity(a: str, b: str) -> float:
    ta = _token_set(a)
    tb = _token_set(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in SENTENCE_SPLIT.split(text or "") if p.strip()]
    return parts


def build_traceability(transcript: str, report: str) -> list[SentenceTrace]:
    transcript_sentences = split_sentences(transcript)
    report_sentences = split_sentences(report)
    traces: list[SentenceTrace] = []

    for report_sentence in report_sentences:
        if len(report_sentence) < 4:
            continue
        best_source = ""
        best_score = 0.0
        for source in transcript_sentences:
            score = _similarity(report_sentence, source)
            if score > best_score:
                best_score = score
                best_source = source
        traces.append(
            SentenceTrace(
                report_sentence=report_sentence,
                transcript_source=best_source,
                start_time=None,
                end_time=None,
                confidence=best_score,
            )
        )
    return traces
