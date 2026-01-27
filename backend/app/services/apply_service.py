from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.db_models import JobListing


def _find_job(db: Session, job_id: str) -> Optional[JobListing]:
    """Locate a job in the database by ID."""

    try:
        job_int = int(job_id)
    except ValueError:
        return None
    return db.query(JobListing).filter(JobListing.id == job_int).first()


def prepare_cover_letter(db: Session, job_id: str, tone: str) -> dict:
    """Generate a placeholder cover letter for a job.

    This is a stub for the LLM-powered generator described in the PRD.
    """

    job = _find_job(db, job_id)
    if not job:
        return {"cover_letter_text": None, "apply_url": ""}

    cover_letter = (
        f"Dear Hiring Team at {job.company_name},\n\n"
        f"I'm excited to apply for the {job.title} role. "
        f"My experience aligns well with your needs, and I would love to contribute.\n\n"
        f"Tone: {tone}\n\n"
        "Best regards,\n"
        "Your Name"
    )
    return {"cover_letter_text": cover_letter, "apply_url": job.apply_url}
