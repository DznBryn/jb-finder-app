from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.db_models import JobSelection, ResumeSessionRecord


def _now_utc() -> datetime:
    """Return a naive UTC timestamp for SQLite compatibility."""

    return datetime.utcnow()


def create_session(
    db: Session,
    resume_text: str,
    resume_s3_key: Optional[str],
    resume_content_hash: Optional[str],
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
    user_id: Optional[str] = None,
    uploaded_filename: Optional[str] = None,
) -> ResumeSessionRecord:
    """Persist a new session record for the uploaded resume."""

    now = _now_utc()
    record = ResumeSessionRecord(
        id=str(uuid4()),
        user_id=user_id,
        resume_text=resume_text,
        resume_s3_key=resume_s3_key,
        resume_content_hash=resume_content_hash,
        uploaded_filename=uploaded_filename,
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


def get_session(db: Session, session_id: UUID) -> Optional[ResumeSessionRecord]:
    """Fetch a session by ID and ensure it hasn't expired.
    Expired rows are treated as missing (return None) but are not deleted here.
    Run delete_expired_sessions() periodically (e.g. cron) to remove them from the DB."""

    record = db.query(ResumeSessionRecord).filter(ResumeSessionRecord.id == str(session_id)).first()
    if not record:
        return None
    if record.expires_at <= _now_utc():
        return None
    return record


def delete_expired_sessions(db: Session) -> int:
    """Delete resume_sessions rows where expires_at is in the past. Returns count deleted."""
    now = _now_utc()
    deleted = db.query(ResumeSessionRecord).filter(ResumeSessionRecord.expires_at <= now).delete(synchronize_session=False)
    db.commit()
    return deleted


def update_session_from_upload(
    db: Session,
    session_id: UUID,
    resume_text: str,
    resume_s3_key: Optional[str],
    resume_content_hash: Optional[str],
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
    uploaded_filename: Optional[str] = None,
) -> ResumeSessionRecord:
    """Update an existing session with new resume content (re-upload replaces storage)."""

    record = get_session(db, session_id)
    if not record:
        raise ValueError(f"Session {session_id} not found or expired")
    record.resume_text = resume_text
    record.resume_s3_key = resume_s3_key
    record.resume_content_hash = resume_content_hash
    record.uploaded_filename = uploaded_filename
    record.extracted_skills = extracted_skills
    record.inferred_titles = inferred_titles
    record.seniority = seniority
    record.years_experience = years_experience
    record.location_pref = location_pref
    record.remote_pref = remote_pref
    record.llm_summary = llm_summary
    record.first_name = first_name
    record.last_name = last_name
    record.email = email
    record.phone = phone
    record.location = location
    record.social_links = social_links
    db.commit()
    db.refresh(record)
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


def save_job_selections(
    db: Session, session_id: UUID, job_ids: list[str], user_id: Optional[str] = None
) -> None:
    """Persist job selections for a session and (optionally) a user."""

    unique_job_ids = list(dict.fromkeys(job_ids))
    session_key = str(session_id)

    if user_id:
        db.query(JobSelection).filter(
            or_(
                JobSelection.user_id == user_id,
                and_(JobSelection.session_id == session_key, JobSelection.user_id == None),
            )
        ).delete(synchronize_session=False)
    else:
        db.query(JobSelection).filter(
            JobSelection.session_id == session_key, JobSelection.user_id == None
        ).delete(synchronize_session=False)

    now = _now_utc()
    for job_id in unique_job_ids:
        db.add(
            JobSelection(
                session_id=session_key,
                user_id=user_id,
                job_id=job_id,
                created_at=now,
            )
        )
    db.commit()


def list_job_selections(
    db: Session, session_id: UUID, user_id: Optional[str] = None
) -> list[str]:
    """Return selected job IDs for a session or user."""

    query = db.query(JobSelection)
    if user_id:
        query = query.filter(JobSelection.user_id == user_id)
    else:
        query = query.filter(
            JobSelection.session_id == str(session_id),
            JobSelection.user_id == None,
        )
    rows = query.order_by(JobSelection.created_at.asc()).all()
    return list(dict.fromkeys([row.job_id for row in rows]))
