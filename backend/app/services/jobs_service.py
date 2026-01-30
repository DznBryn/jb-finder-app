from __future__ import annotations

from datetime import datetime
import logging
from typing import Iterable, List

from sqlalchemy.orm import Session

from app.models.db_models import JobListing

logger = logging.getLogger("jobs")

def _infer_seniority(title: str) -> str:
    """Infer seniority from job title keywords."""

    lowered = title.lower()
    if any(word in lowered for word in ["intern", "junior", "jr"]):
        return "junior"
    if any(word in lowered for word in ["senior", "sr", "staff", "principal"]):
        return "senior"
    if any(word in lowered for word in ["lead", "manager", "director", "head"]):
        return "lead"
    return "mid"


def upsert_jobs(
    db: Session,
    source: str,
    jobs: Iterable[dict],
    company_id: int | None = None,
    company_name: str | None = None,
) -> int:
    """Insert or update job listings from an ATS adapter."""

    count = 0
    for job in jobs:
        logger.info("Processing job source_id=%s company=%s", job.get("source_job_id"), company_name or job.get("company"))
        existing = (
            db.query(JobListing)
            .filter(
                JobListing.source == source,
                JobListing.source_job_id == job["source_job_id"],
            )
            .first()
        )

        payload = {
            "company_id": company_id,
            "company_name": company_name or job.get("company", ""),
            "title": job.get("title", ""),
            "location": job.get("location", ""),
            "remote": "remote" in job.get("location", "").lower(),
            "seniority": _infer_seniority(job.get("title", "")),
            "description": job.get("description", ""),
            "pay_ranges": job.get("pay_ranges", []),
            "source": source,
            "source_job_id": job.get("source_job_id", ""),
            "apply_url": job.get("apply_url", ""),
            "updated_at": datetime.utcnow(),
        }

        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
        else:
            db.add(JobListing(**payload))
        count += 1

    db.commit()
    logger.info("Upserted %s jobs for %s", count, company_name or source)
    return count


def list_jobs(db: Session) -> List[JobListing]:
    """Return all jobs currently stored."""

    return db.query(JobListing).all()


def list_jobs_by_ids(db: Session, job_ids: List[str]) -> List[JobListing]:
    """Return jobs for the provided IDs."""

    int_ids = []
    for job_id in job_ids:
        try:
            int_ids.append(int(job_id))
        except ValueError:
            continue
    if not int_ids:
        return []
    return db.query(JobListing).filter(JobListing.id.in_(int_ids)).all()
