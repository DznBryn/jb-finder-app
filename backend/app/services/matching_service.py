from __future__ import annotations

import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.db_models import JobListing, ResumeSessionRecord
from app.services.ai.llm_service import build_search_query
from pprint import pprint

logger = logging.getLogger("matching")

def _normalize_terms(terms: List[str]) -> List[str]:
    return [term.strip().lower() for term in terms if term and term.strip()]

def _title_matches(job_title: str | None, title_terms: List[str]) -> bool:
    if not title_terms:
        return True
    if not job_title:
        return False
    title_lower = job_title.lower()
    return any(term in title_lower for term in title_terms)

def _location_matches(job_location: str | None, location_terms: List[str]) -> bool:
    if not location_terms:
        return True
    if not job_location:
        return False
    location_lower = job_location.lower()
    return any(term in location_lower for term in location_terms)
def _score_match(job_skills: List[str], user_skills: List[str]) -> int:
    """Compute a simplified match score based on skill overlap.

    This is a placeholder for the weighted scoring model described in the PRD.
    """

    if not job_skills:
        return 0
    overlap = len(set(job_skills) & set(user_skills))
    return int((overlap / len(job_skills)) * 100)


def _tier_for_score(score: int) -> str:
    """Convert a numeric score into a tier label."""

    if score >= 90:
        return "strong"
    if score >= 60:
        return "medium"
    return "weak"


def _seniority_rank(level: str) -> int:
    """Map seniority labels to a numeric scale."""

    mapping = {
        "junior": 1,
        "mid": 2,
        "senior": 3,
        "lead": 4,
        "principal": 4,
        "staff": 4,
        "manager": 4,
        "director": 5,
        "executive": 6,
        "unknown": 0,
    }
    return mapping.get(level.lower(), 0)


def _passes_filters(
    job: JobListing,
    session: ResumeSessionRecord,
    title_terms: List[str],
    location_terms: List[str],
    remote_pref: str,
    pay_range: Optional[str],
) -> bool:
    """Apply filters based on LLM search query, location, remote, and seniority."""

    if not _title_matches(job.title, title_terms):
        return False

    job_location = (job.location or "").lower()
    if remote_pref == "remote":
        if "remote" not in job_location:
            return False
    elif remote_pref == "hybrid":
        if "hybrid" not in job_location:
            return False
    elif remote_pref in {"in_office", "onsite"}:
        if "remote" in job_location or "hybrid" in job_location:
            return False

    if location_terms and not _location_matches(job.location, location_terms):
        return False

    if pay_range == "with" and not (job.pay_ranges and len(job.pay_ranges) > 0):
        return False
    if pay_range == "without" and job.pay_ranges and len(job.pay_ranges) > 0:
        return False

    if session.seniority:
        job_rank = _seniority_rank(job.seniority or "unknown")
        session_rank = _seniority_rank(session.seniority or "unknown")
        if job_rank and session_rank and abs(job_rank - session_rank) > 1:
            return False

    return True


def build_matches( 
    db: Session,
    session: ResumeSessionRecord,
    page: int,
    page_size: int,
    filters: Optional[dict],
) -> tuple[List[dict], int, List[str]]:
    """Build a list of explainable job matches for the given session."""

    filters = filters or {}
    filter_titles = filters.get("title_terms") or []
    filter_location = filters.get("location_pref")
    filter_work_mode = filters.get("work_mode")
    filter_pay_range = filters.get("pay_range")
    titles_input = list(dict.fromkeys((session.inferred_titles or []) + filter_titles))

    matches = []
    pprint(filter_titles)
    query_payload = build_search_query(
        titles_input,
        filter_location or session.location_pref,
        filter_work_mode if filter_work_mode else session.remote_pref,
        locked_title_terms=filter_titles or None,
    )
    title_terms = _normalize_terms(query_payload.get("title_terms", []))
    location_terms = _normalize_terms(query_payload.get("location_terms", []))
    remote_pref = query_payload.get("remote_pref", "either")
    pay_range = filter_pay_range or "any"

    logger.info(
        "Match query: session=%s query=%s title_terms=%s location_terms=%s remote=%s pay_range=%s",
        session.id,
        query_payload.get("query", ""),
        len(title_terms),
        len(location_terms),
        remote_pref,
        pay_range,
    )

    jobs_query = (
        db.query(JobListing)
        .filter(JobListing.is_active.is_(True))
        .order_by(JobListing.updated_at.desc())
    )
    all_jobs = jobs_query.all()
    if not all_jobs:
        logger.warning(
            "No active jobs in database; matches will be empty. "
            "Run job ingestion (e.g. schedulers/run_refresh.py or load companies + Greenhouse refresh) to populate jobs."
        )
    filtered_jobs = []
    for job in all_jobs:
        if not _passes_filters(
            job,
            session,
            title_terms,
            location_terms,
            remote_pref,
            pay_range,
        ):
            continue
        filtered_jobs.append(job)

    total = len(filtered_jobs)
    start = (page - 1) * page_size
    end = start + page_size
    paged_jobs = filtered_jobs[start:end]
    for job in paged_jobs:

        job_skills: List[str] = []
        score = _score_match(job_skills, session.extracted_skills)

        # if score == 0:
        #     continue

        tier = _tier_for_score(score)
        missing_skills = list(set(job_skills) - set(session.extracted_skills))

        matches.append(
            {
                "job_id": str(job.id),
                "company": job.company_name,
                "title": job.title,
                "location": job.location,
                "pay_ranges": job.pay_ranges or [],
                "is_active": job.is_active,
                "score": score,
                "tier": tier,
                "reasons": [
                    f"Matched {len(job_skills) - len(missing_skills)}/{len(job_skills)} skills",
                    f"Tier: {tier}",
                ],
                "missing_skills": missing_skills,
                "apply_url": job.apply_url,
            }
        )
    logger.info(
        "Match results: session=%s total=%s page=%s page_size=%s filtered_out=%s returned=%s",
        session.id,
        total,
        page,
        page_size,
        len(all_jobs) - total,
        len(matches),
    )
    return matches, total, title_terms
