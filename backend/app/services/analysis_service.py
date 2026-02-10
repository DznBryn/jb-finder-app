from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.config import LLM_SKILL_EXTRACT_MAX_WORKERS
from app.models.db_models import DeepAnalysisRecord, JobListing, ResumeSessionRecord
from app.services.ai.llm_service import (
    analyze_job_matches,
    extract_job_skills,
    generate_learning_resources,
)


def analyze_selected_jobs(
    db: Session,
    session: ResumeSessionRecord,
    job_ids: List[str],
) -> tuple[Dict[str, object], int]:
    """Analyze selected jobs and return LLM grades. Returns (result, total_tokens)."""

    int_ids = []
    for job_id in job_ids:
        try:
            int_ids.append(int(job_id))
        except ValueError:
            continue

    if not int_ids:
        return {"results": [], "best_match_job_id": None}, 0

    jobs = (
        db.query(JobListing)
        .filter(JobListing.id.in_(int_ids))
        .all()
    )
    job_map = {str(job.id): job for job in jobs}
    ordered_jobs = [job_map[job_id] for job_id in job_ids if job_id in job_map]

    profile = {
        "summary": session.llm_summary or "",
        "title_terms": session.inferred_titles or [],
        "seniority": session.seniority,
        "years_experience": session.years_experience,
        "location_pref": session.location_pref,
        "skills": session.extracted_skills or [],
    }

    user_skills = [
        skill.lower()
        for skill in session.extracted_skills or []
        if isinstance(skill, str)
    ]

    # Run skill extraction in parallel (I/O-bound LLM calls) to reduce latency.
    def _extract_for_job(job: JobListing) -> tuple[List[str], int]:
        return extract_job_skills(job.description or "")

    with ThreadPoolExecutor(max_workers=LLM_SKILL_EXTRACT_MAX_WORKERS) as executor:
        skill_results = list(
            executor.map(_extract_for_job, ordered_jobs)
        )

    job_payload = []
    missing_skills_map: Dict[str, List[str]] = {}
    job_skills_map: Dict[str, List[str]] = {}
    skill_extract_tokens = 0
    for job, (job_skills, tokens) in zip(ordered_jobs, skill_results):
        skill_extract_tokens += tokens
        missing_skills = [
            skill for skill in job_skills if skill and skill not in user_skills
        ]
        job_id = str(job.id)
        missing_skills_map[job_id] = missing_skills
        job_skills_map[job_id] = job_skills
        
        job_payload.append(
            {
                "job_id": job_id,
                "title": job.title,
                "company": job.company_name,
                "location": job.location,
                "description": (job.description or "")[:2000],
                "job_skills": job_skills,
                "missing_skills": missing_skills,
            }
        )

    analysis, match_tokens = analyze_job_matches(profile, job_payload)
    total_tokens = skill_extract_tokens + match_tokens
    results = {item.get("job_id"): item for item in analysis.get("results", [])}

    grade_order = ["A", "B", "C", "D"]
    
    def _apply_missing_penalty(grade: str, missing_count: int) -> str:
        """Apply a light penalty only when there are many missing skills."""

        if grade not in grade_order:
            return grade
        penalty = 0
        if missing_count >= 8:
            penalty = 1
        new_index = min(len(grade_order) - 1, grade_order.index(grade) + penalty)
        return grade_order[new_index]

    normalized = []
    for job in ordered_jobs:
        job_id = str(job.id)
        job_skills = job_skills_map.get(job_id, [])
        item = results.get(job_id)
        if not item:
            normalized.append(
                {
                    "job_id": job_id,
                    "grade": "D",
                    "rationale": "No analysis returned for this job.",
                    "missing_skills": missing_skills_map.get(job_id, []),
                }
            )
        else:
            missing_skills = (
                item.get("missing_skills") or missing_skills_map.get(job_id, [])
            )
            matching_count = max(len(job_skills) - len(missing_skills), 0)
            if matching_count == 0:
                adjusted_grade = "D"
            else:
                adjusted_grade = _apply_missing_penalty(
                    item.get("grade", "C"), len(missing_skills)
                )
            normalized.append(
                {
                    "job_id": job_id,
                    "grade": adjusted_grade,
                    "rationale": item.get("rationale", "")
                    or (
                        "No matching skills found for this job."
                        if matching_count == 0
                        else ""
                    ),
                    "missing_skills": missing_skills,
                }
            )

    best_match_job_id = analysis.get("best_match_job_id")
    if normalized:
        normalized_sorted = sorted(
            normalized,
            key=lambda item: grade_order.index(item.get("grade", "D"))
            if item.get("grade") in grade_order
            else len(grade_order),
        )
        best_match_job_id = normalized_sorted[0].get("job_id")

    return {
        "results": normalized,
        "best_match_job_id": best_match_job_id,
    }, total_tokens


def deep_analyze_job(
    db: Session, session: ResumeSessionRecord, job_id: str
) -> Dict[str, object]:
    """Return a deep analysis with learning resources for a single job."""

    cached = get_deep_analysis(db, session.id, job_id)
    if cached:
        return cached, 0

    analysis, match_tokens = analyze_selected_jobs(db, session, [job_id])
    result = (analysis.get("results") or [{}])[0]

    try:
        job_int = int(job_id)
    except ValueError as exc:
        raise ValueError("Invalid job id.") from exc

    job = db.query(JobListing).filter(JobListing.id == job_int).first()
    if not job:
        raise ValueError("Job not found.")

    profile = {
        "summary": session.llm_summary or "",
        "skills": session.extracted_skills or [],
    }

    job_payload = {
        "title": job.title,
        "company": job.company_name,
        "description": job.description or "",
    }

    job_summary, learning_resources, resources_tokens = generate_learning_resources(
        profile,
        job_payload,
        result.get("missing_skills", []),
    )
    total_tokens = match_tokens + resources_tokens

    payload = {
        **result,
        "learning_resources": learning_resources,
    }
    if job_summary is not None:
        payload["job_summary"] = job_summary
    payload["session_id"] = session.id
    payload["job_id"] = job_id

    existing = (
        db.query(DeepAnalysisRecord)
        .filter(
            DeepAnalysisRecord.session_id == session.id,
            DeepAnalysisRecord.job_id == str(job_id),
        )
        .first()
    )
    if existing:
        existing.user_id = getattr(session, "user_id", None)
        existing.payload = {**existing.payload, **payload}
        db.commit()
    else:
        record = DeepAnalysisRecord(
            session_id=session.id,
            user_id=getattr(session, "user_id", None),
            job_id=str(job_id),
            payload=payload,
            created_at=datetime.utcnow(),
        )
        db.add(record)
        db.commit()

    return payload, total_tokens


def get_deep_analysis(
    db: Session, session_id: str, job_id: str
) -> Optional[Dict[str, object]]:
    """Return cached deep analysis for a session + job if available."""

    record = (
        db.query(DeepAnalysisRecord)
        .filter(
            DeepAnalysisRecord.session_id == str(session_id),
            DeepAnalysisRecord.job_id == str(job_id),
        )
        .first()
    )
    if not record:
        return None
    return record.payload


def persist_match_analysis(
    db: Session,
    session_id: str,
    user_id: str,
    results: List[Dict[str, object]],
) -> None:
    """Persist match analysis results (grade, rationale, missing_skills) so they are linked to user and session."""

    for item in results:
        job_id = item.get("job_id")
        if not job_id:
            continue
        job_id = str(job_id)
        payload = {
            "grade": item.get("grade", "D"),
            "rationale": item.get("rationale", ""),
            "missing_skills": item.get("missing_skills", []),
            "learning_resources": [],
        }
        existing = (
            db.query(DeepAnalysisRecord)
            .filter(
                DeepAnalysisRecord.session_id == str(session_id),
                DeepAnalysisRecord.job_id == job_id,
            )
            .first()
        )
        if existing:
            existing.user_id = user_id
            existing.payload = {
                **existing.payload,
                "grade": payload["grade"],
                "rationale": payload["rationale"],
                "missing_skills": payload["missing_skills"],
            }
            db.commit()
        else:
            record = DeepAnalysisRecord(
                session_id=str(session_id),
                user_id=user_id,
                job_id=job_id,
                payload=payload,
                created_at=datetime.utcnow(),
            )
            db.add(record)
            db.commit()
