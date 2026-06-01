"""Shared DICOM value parsing helpers."""

from __future__ import annotations

import re
from datetime import date, time

_DICOM_DATE_RE = re.compile(r"^(\d{4})(\d{2})(\d{2})")


def decode_str(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        text = value.decode("utf-8", errors="replace").strip()
    else:
        text = str(value).strip()
    return text or None


_DICOM_TIME_RE = re.compile(r"^(\d{2})(\d{2})(\d{2})")


def parse_dicom_date(value: object | None) -> date | None:
    text = decode_str(value)
    if not text:
        return None
    token = text.split("-", 1)[0]
    match = _DICOM_DATE_RE.match(token)
    if not match:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def parse_dicom_time(value: object | None) -> time | None:
    text = decode_str(value)
    if not text:
        return None
    token = text.split("-", 1)[0].strip()
    digits = re.sub(r"[^0-9]", "", token.split(".", 1)[0])
    if len(digits) < 4:
        return None
    if len(digits) < 6:
        digits = digits.ljust(6, "0")
    match = _DICOM_TIME_RE.match(digits[:6])
    if not match:
        return None
    try:
        hour, minute, second = (int(match.group(1)), int(match.group(2)), int(match.group(3)))
        return time(hour, minute, second)
    except ValueError:
        return None


def parse_patient_name(value: object | None) -> str | None:
    text = decode_str(value)
    if not text:
        return None
    return text.replace("^", " ").strip()


def parse_modality(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    if not isinstance(value, str):
        try:
            for entry in value:
                parsed = parse_modality(entry)
                if parsed:
                    return parsed
        except TypeError:
            pass
        value = str(value)
    text = value.strip()
    if not text:
        return None
    first = text.split("\\")[0].split(",")[0].strip().strip("'\"")
    return first.upper() if first else None
