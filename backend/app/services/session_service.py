from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models.db_models import JobSelection, SessionRecord


def _now_utc() -> datetime:
    """Return a naive UTC timestamp for SQLite compatibility."""

    return datetime.utcnow()


def create_session(
    db: Session,
    resume_text: str,
    resume_s3_key: Optional[str],
    extracted_skills: list,
    inferred_titles: list,
    seniority: str,
    years_experience: int,
    location_pref: Optional[str],
    remote_pref: Optional[bool],
    llm_summary: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    location: Optional[str],
    social_links: list,
) -> SessionRecord:
    """Persist a new session record for the uploaded resume."""

    now = _now_utc()
    record = SessionRecord(
        id=str(uuid4()),
        resume_text=resume_text,
        resume_s3_key=resume_s3_key,
        extracted_skills=extracted_skills,
        inferred_titles=inferred_titles,
        seniority=seniority,
        years_experience=years_experience,
        location_pref=location_pref,
        remote_pref=remote_pref,
        llm_summary=llm_summary,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        location=location,
        social_links=social_links,
        created_at=now,
        expires_at=now + timedelta(hours=24),
        daily_selections=0,
        daily_selection_date=now.date().isoformat(),
        plan="free",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_session(db: Session, session_id: UUID) -> Optional[SessionRecord]:
    """Fetch a session by ID and ensure it hasn't expired."""

    record = db.query(SessionRecord).filter(SessionRecord.id == str(session_id)).first()
    if not record:
        return None
    if record.expires_at <= _now_utc():
        return None
    return record


def increment_daily_selection(
    db: Session, session_id: UUID, limit: int
) -> tuple[bool, int]:
    """Increment daily selection count and enforce the daily limit."""

    record = get_session(db, session_id)
    if not record:
        return False, 0

    today = _now_utc().date().isoformat()
    if record.daily_selection_date != today:
        record.daily_selection_date = today
        record.daily_selections = 0

    if record.daily_selections >= limit:
        return False, 0

    record.daily_selections += 1
    db.commit()
    return True, max(0, limit - record.daily_selections)


def save_job_selections(db: Session, session_id: UUID, job_ids: list[str]) -> None:
    """Persist job selections for a session."""

    now = _now_utc()
    for job_id in job_ids:
        db.add(
            JobSelection(
                session_id=str(session_id),
                job_id=job_id,
                created_at=now,
            )
        )
    db.commit()


def list_job_selections(db: Session, session_id: UUID) -> list[str]:
    """Return selected job IDs for a session."""

    rows = (
        db.query(JobSelection)
        .filter(JobSelection.session_id == str(session_id))
        .all()
    )
    return [row.job_id for row in rows]
