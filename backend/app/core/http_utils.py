"""Safe HTTP response helpers."""

import re


_UNSAFE_FILENAME = re.compile(r'[\r\n"\\<>|:*?%]')


def safe_content_disposition_filename(filename: str, *, fallback: str = "download") -> str:
    cleaned = (filename or fallback).strip()
    cleaned = _UNSAFE_FILENAME.sub("_", cleaned)
    cleaned = cleaned.replace("/", "_").replace("\\", "_")[:200] or fallback
    return cleaned
