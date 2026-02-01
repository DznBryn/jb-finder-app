from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from typing import Iterable, List, Optional
import difflib

from sqlalchemy.orm import Session

from app.models.db_models import CoverLetterDocument, CoverLetterVersion


@dataclass
class CoverLetterDocumentData:
    document: CoverLetterDocument
    versions: List[CoverLetterVersion]


def _hash_content(content: str) -> str:
    return sha256(content.encode("utf-8")).hexdigest()


def get_or_create_document(db: Session, session_id: str, job_id: str) -> CoverLetterDocument:
    document = (
        db.query(CoverLetterDocument)
        .filter(
            CoverLetterDocument.session_id == session_id,
            CoverLetterDocument.job_id == job_id,
        )
        .first()
    )
    if document:
        return document
    now = datetime.utcnow()
    document = CoverLetterDocument(
        session_id=session_id,
        job_id=job_id,
        draft_content="",
        created_at=now,
        updated_at=now,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def get_document_with_versions(
    db: Session, session_id: str, job_id: str
) -> CoverLetterDocumentData:
    document = get_or_create_document(db, session_id, job_id)
    versions = (
        db.query(CoverLetterVersion)
        .filter(CoverLetterVersion.document_id == document.id)
        .order_by(CoverLetterVersion.created_at.desc())
        .all()
    )
    return CoverLetterDocumentData(document=document, versions=versions)


def save_draft(
    db: Session, document: CoverLetterDocument, content: str
) -> CoverLetterDocument:
    document.draft_content = content
    document.updated_at = datetime.utcnow()
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def save_version(
    db: Session,
    document: CoverLetterDocument,
    content: str,
    intent: Optional[str] = None,
    created_by: str = "user",
    base_hash: Optional[str] = None,
) -> CoverLetterVersion:
    now = datetime.utcnow()
    version = CoverLetterVersion(
        document_id=document.id,
        session_id=document.session_id,
        job_id=document.job_id,
        content=content,
        created_at=now,
        created_by=created_by,
        intent=intent,
        base_hash=base_hash,
        result_hash=_hash_content(content),
    )
    db.add(version)
    db.flush()
    document.current_version_id = version.id
    document.draft_content = content
    document.updated_at = now
    db.add(document)
    db.commit()
    db.refresh(version)
    return version


def compute_diff(original: str, updated: str) -> str:
    original_lines = original.splitlines()
    updated_lines = updated.splitlines()
    diff = difflib.unified_diff(
        original_lines,
        updated_lines,
        fromfile="base",
        tofile="preview",
        lineterm="",
    )
    return "\n".join(diff)


def _normalize_op(op: dict) -> dict:
    op_type = op.get("type")
    print("Normalizing op: %s", op)
    if op_type not in {"replace", "insert", "delete"}:
        raise ValueError("Invalid op type.")
    if op_type == "insert":
        pos = op.get("pos")
        start = op.get("start")
        end = op.get("end")
        offset = op.get("offset")
        at = op.get("at")
        if pos is not None:
            return {
                "type": "replace",
                "start": int(pos),
                "end": int(pos),
                "text": op.get("text", op.get("content", "")),
            }
        if offset is not None:
            insert_at = int(offset)
            return {
                "type": "replace",
                "start": insert_at,
                "end": insert_at,
                "text": op.get("text", op.get("content", "")),
            }
        if at is not None:
            insert_at = int(at)
            return {
                "type": "replace",
                "start": insert_at,
                "end": insert_at,
                "text": op.get("text", op.get("content", "")),
            }
        if start is not None:
            insert_at = int(start)
            return {
                "type": "replace",
                "start": insert_at,
                "end": insert_at if end is None else int(end),
                "text": op.get("text", op.get("content", "")),
            }
        raise ValueError("Insert op missing pos, offset, or start.")
    if op_type == "delete":
        start = op.get("start")
        end = op.get("end")
        if start is None or end is None:
            raise ValueError("Delete op missing start/end.")
        return {"type": "replace", "start": int(start), "end": int(end), "text": ""}
    start = op.get("start")
    end = op.get("end")
    if start is None or end is None:
        raise ValueError("Replace op missing start/end.")
    return {"type": "replace", "start": int(start), "end": int(end), "text": op.get("text", "")}


def apply_ops(content: str, ops: Iterable[dict]) -> str:
    normalized = [_normalize_op(op) for op in ops]
    # Apply from the end to avoid index shifting.
    for op in sorted(normalized, key=lambda item: item["start"], reverse=True):
        start = op["start"]
        end = op["end"]
        if start < 0:
            start = 0
        if end < 0:
            end = 0
        if start > len(content):
            start = len(content)
        if end > len(content):
            end = len(content)
        if start > end:
            start = end
        content = content[:start] + op.get("text", "") + content[end:]
    return content


def hash_content(content: str) -> str:
    return _hash_content(content)
