from __future__ import annotations

from typing import Dict, Optional

import requests
from requests.auth import HTTPBasicAuth
from sqlalchemy.orm import Session

from app.config import GREENHOUSE_API_KEY
from app.models.db_models import Company, JobListing, SessionRecord


def _find_job_and_token(db: Session, job_id: str) -> tuple[JobListing, str]:
    try:
        job_int = int(job_id)
    except ValueError as exc:
        raise ValueError("Invalid job id.") from exc

    job = db.query(JobListing).filter(JobListing.id == job_int).first()
    if not job:
        raise ValueError("Job not found.")

    token = None
    if job.company_id is not None:
        company = db.query(Company).filter(Company.id == job.company_id).first()
        if company:
            token = company.greenhouse_token

    if not token:
        raise ValueError("Greenhouse token missing for this company.")

    return job, token


def retrieve_job_post(db: Session, job_id: str) -> Dict[str, object]:
    job, token = _find_job_and_token(db, job_id)
    url = (
        f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs/"
        f"{job.source_job_id}"
    )
    response = requests.get(
        url,
        params={"questions": "true", "pay_transparency": "true"},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def submit_application(
    db: Session,
    session: SessionRecord,
    job_id: str,
    fields: Dict[str, object],
    data_compliance: Optional[Dict[str, bool]] = None,
    demographic_answers: Optional[list] = None,
    mapped_url_token: Optional[str] = None,
    applicant_ip: Optional[str] = None,
) -> Dict[str, object]:
    job, token = _find_job_and_token(db, job_id)

    if not GREENHOUSE_API_KEY:
        raise ValueError("GREENHOUSE_API_KEY is not configured.")

    url = (
        f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs/"
        f"{job.source_job_id}"
    )

    payload: Dict[str, object] = dict(fields or {})
    payload.setdefault("first_name", session.first_name or "")
    payload.setdefault("last_name", session.last_name or "")
    payload.setdefault("email", session.email or "")
    if session.phone and "phone" not in payload:
        payload["phone"] = session.phone
    if session.location and "location" not in payload:
        payload["location"] = session.location
    if session.resume_text and "resume_text" not in payload:
        payload["resume_text"] = session.resume_text

    if data_compliance:
        payload["data_compliance"] = data_compliance
    if demographic_answers:
        payload["demographic_answers"] = demographic_answers
    if mapped_url_token:
        payload["mapped_url_token"] = mapped_url_token
    if applicant_ip:
        payload["applicant_ip"] = applicant_ip

    response = requests.post(
        url,
        json=payload,
        auth=HTTPBasicAuth(GREENHOUSE_API_KEY, ""),
        timeout=30,
    )
    response.raise_for_status()
    return response.json() if response.content else {"status": "ok"}
