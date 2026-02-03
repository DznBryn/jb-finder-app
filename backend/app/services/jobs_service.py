from __future__ import annotations

from datetime import datetime
import logging
from typing import Iterable, List

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

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
    company_industry: str | None = None,
) -> int:
    """Insert or update job listings from an ATS adapter."""

    job_list = list(jobs)
    if not job_list:
        return 0
    count = len(job_list)
    refresh_time = datetime.utcnow()
    rows = []
    for job in job_list:
        logger.info(
            "Processing job source_id=%s company=%s",
            job.get("source_job_id"),
            company_name or job.get("company"),
        )
        rows.append(
            {
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
                "is_active": True,
                "updated_at": refresh_time,
                "industry": company_industry,
            }
        )

    insert_stmt = insert(JobListing).values(rows)
    update_columns = {
        "company_id": insert_stmt.excluded.company_id,
        "company_name": insert_stmt.excluded.company_name,
        "title": insert_stmt.excluded.title,
        "location": insert_stmt.excluded.location,
        "remote": insert_stmt.excluded.remote,
        "seniority": insert_stmt.excluded.seniority,
        "description": insert_stmt.excluded.description,
        "pay_ranges": insert_stmt.excluded.pay_ranges,
        "apply_url": insert_stmt.excluded.apply_url,
        "is_active": insert_stmt.excluded.is_active,
        "updated_at": insert_stmt.excluded.updated_at,
        "industry": insert_stmt.excluded.industry,
    }
    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=["source", "source_job_id"],
        set_=update_columns,
    )
    db.execute(upsert_stmt)

    inactive_query = db.query(JobListing).filter(JobListing.source == source)
    if company_id is not None:
        inactive_query = inactive_query.filter(JobListing.company_id == company_id)
    elif company_name:
        inactive_query = inactive_query.filter(JobListing.company_name == company_name)
    inactive_query = inactive_query.filter(JobListing.updated_at < refresh_time)
    inactive_query.update(
        {"is_active": False, "updated_at": refresh_time}, synchronize_session=False
    )

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
