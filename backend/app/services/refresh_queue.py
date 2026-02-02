from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.db_models import RefreshJob


def enqueue_refresh(db: Session, requested_by: Optional[str] = None) -> RefreshJob:
    job = RefreshJob(
        status="queued",
        requested_by=requested_by,
        created_at=datetime.utcnow(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def claim_next_job(db: Session) -> Optional[RefreshJob]:
    job = (
        db.query(RefreshJob)
        .filter(RefreshJob.status == "queued")
        .order_by(RefreshJob.created_at.asc())
        .with_for_update(skip_locked=True)
        .first()
    )
    if not job:
        return None
    job.status = "running"
    job.started_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


def mark_job_success(db: Session, job: RefreshJob, totals: dict) -> RefreshJob:
    job.status = "succeeded"
    job.totals = totals
    job.finished_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


def mark_job_failed(db: Session, job: RefreshJob, error: str) -> RefreshJob:
    job.status = "failed"
    job.error = error
    job.finished_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: int) -> Optional[RefreshJob]:
    return db.query(RefreshJob).filter(RefreshJob.id == job_id).first()
