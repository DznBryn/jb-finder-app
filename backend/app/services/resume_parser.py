from __future__ import annotations

import io
from typing import Optional

from docx import Document
from pdfminer.high_level import extract_text


def parse_resume_file(filename: str, content: bytes) -> str:
    """Extract text from supported resume files (PDF, DOCX, TXT)."""

    lower = filename.lower()
    if lower.endswith(".pdf"):
        return extract_text(io.BytesIO(content))
    if lower.endswith(".docx"):
        document = Document(io.BytesIO(content))
        return "\n".join([paragraph.text for paragraph in document.paragraphs])
    if lower.endswith(".txt"):
        return content.decode(errors="ignore")
    return ""
