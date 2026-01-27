from __future__ import annotations

import json
import logging
import re
from typing import Dict, List

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from app.config import OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger("llm")

class ResumeParseResult(BaseModel):
    """Structured resume fields returned by the LLM."""

    extracted_skills: List[str]
    inferred_titles: List[str]
    seniority: str
    years_experience: int
    summary: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    social_links: List[str] = []


class JobSkillsResult(BaseModel):
    """Structured skills list for a job description."""

    skills: List[str]

class SearchQueryResult(BaseModel):
    """Structured search query for matching jobs."""

    query: str
    title_terms: List[str]
    location_terms: List[str]
    remote_pref: str

def _fallback_search_query(
    titles: List[str],
    location_pref: str | None,
    remote_pref: str | bool | None,
) -> Dict[str, object]:
    title_terms = [title.strip() for title in titles if title.strip()]
    location_terms = (
        [term.strip() for term in (location_pref or "").split(",") if term.strip()]
        if location_pref
        else []
    )
    if isinstance(remote_pref, str):
        remote_value = remote_pref
    else:
        remote_value = (
            "remote" if remote_pref is True else "in_office" if remote_pref is False else "either"
        )
    query_parts = []
    if title_terms:
        query_parts.append("title:(" + " OR ".join(title_terms) + ")")
    if location_terms:
        query_parts.append("location:(" + " OR ".join(location_terms) + ")")
    if remote_value != "either":
        query_parts.append(f"remote:{remote_value}")
    return {
        "query": " AND ".join(query_parts) if query_parts else "",
        "title_terms": title_terms,
        "location_terms": location_terms,
        "remote_pref": remote_value,
    }


def _mock_resume_parse(resume_text: str) -> Dict[str, object]:
    """Fallback parser when no LLM key is configured."""

    skills = ["python", "fastapi", "postgres"] if resume_text else []
    titles = ["Software Engineer"] if resume_text else []
    return {
        "extracted_skills": skills,
        "inferred_titles": titles,
        "seniority": "mid",
        "years_experience": 5,
        "summary": "Experienced software engineer focused on backend APIs.",
        "first_name": None,
        "last_name": None,
        "email": None,
        "phone": None,
        "location": None,
        "social_links": [],
    }


def _normalize_text(text: str) -> str:
    """Normalize text for simple safety checks."""

    return re.sub(r"\\s+", " ", text.lower()).strip()


def _safety_checks(parsed: ResumeParseResult, resume_text: str) -> List[str]:
    """Return warnings for potential hallucinations or inconsistencies."""

    warnings: List[str] = []
    normalized = _normalize_text(resume_text)

    missing_skills = [
        skill
        for skill in parsed.extracted_skills
        if _normalize_text(skill) not in normalized
    ]
    if missing_skills:
        warnings.append(
            "Potential hallucinated skills: " + ", ".join(missing_skills[:10])
        )

    if parsed.years_experience < 0 or parsed.years_experience > 50:
        warnings.append("Years of experience looks unrealistic.")

    if not parsed.inferred_titles:
        warnings.append("No titles inferred from resume.")

    return warnings


def _call_openai(resume_text: str) -> Dict[str, object]:
    """Call OpenAI and return parsed JSON content."""

    client = OpenAI(api_key=OPENAI_API_KEY)
    system_prompt = (
        "You extract structured resume data for job matching. "
        "Return ONLY valid JSON with keys: extracted_skills (array), "
        "inferred_titles (array), seniority (string), years_experience (int), "
        "summary (string), first_name (string or null), last_name (string or null), "
        "email (string or null), phone (string or null), location (string or null), "
        "social_links (array). No extra keys."
    )

    response = client.responses.create(
        model=OPENAI_MODEL,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": resume_text[:12000]},
        ],
    )

    output_text = response.output_text
    return json.loads(output_text)


def extract_job_skills(job_text: str) -> List[str]:
    """Extract a skill list from a job description using the LLM."""

    if not OPENAI_API_KEY or not job_text.strip():
        return []

    client = OpenAI(api_key=OPENAI_API_KEY)
    system_prompt = (
        "Extract a concise list of technical skills and tools mentioned in the job "
        "description. Return ONLY valid JSON with a single key 'skills' as an array."
    )

    try:
        logger.info("LLM skill extract start: model=%s chars=%s", OPENAI_MODEL, len(job_text))
        response = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": job_text[:12000]},
            ],
        )
        parsed = json.loads(response.output_text)
        validated = JobSkillsResult(**parsed)
        logger.info("LLM skill extract success: skills=%s", len(validated.skills))
        return [skill.lower() for skill in validated.skills if isinstance(skill, str)]
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM skill extract failed.")
        return []

def build_search_query(
    titles: List[str],
    location_pref: str | None,
    remote_pref: str | bool | None,
    locked_title_terms: List[str] | None = None,
) -> Dict[str, object]:
    """Build a search query for matching jobs using the LLM when available."""

    if locked_title_terms:
        logger.info("Search query locked: using %s title terms", len(locked_title_terms))
        return _fallback_search_query(locked_title_terms, location_pref, remote_pref)

    if not OPENAI_API_KEY:
        return _fallback_search_query(titles, location_pref, remote_pref)

    normalized_titles = [title.strip() for title in titles if title.strip()]
    normalized_location = (location_pref or "").strip()
    if isinstance(remote_pref, str):
        remote_value = remote_pref
    else:
        remote_value = (
            "remote" if remote_pref is True else "in_office" if remote_pref is False else "either"
        )

    client = OpenAI(api_key=OPENAI_API_KEY)
    system_prompt = (
        "You create a concise job search query for matching. "
        "Return ONLY valid JSON with keys: query (string), title_terms (array), "
        "location_terms (array), remote_pref (string: remote|hybrid|in_office|either). "
        "Title terms should include close or adjacent titles. No extra keys."
    )
    user_prompt = (
        f"Titles: {normalized_titles}\n"
        f"Location preference: {normalized_location or 'none'}\n"
        f"Remote preference: {remote_value}\n"
        "Build a concise search query and structured terms."
    )

    try:
        logger.info(
            "LLM search query start: model=%s titles=%s location=%s remote=%s",
            OPENAI_MODEL,
            len(normalized_titles),
            normalized_location or "none",
            remote_value,
        )
        response = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt[:4000]},
            ],
        )
        logger.info("User prompt:\n%s\nLLM search query response: %s", user_prompt[:4000], response.output_text)
        parsed = json.loads(response.output_text)
        validated = SearchQueryResult(**parsed)
        logger.info(
            "LLM search query success: title_terms=%s location_terms=%s",
            len(validated.title_terms),
            len(validated.location_terms),
        )
        return validated.model_dump()
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM search query failed, using fallback.")
        return _fallback_search_query(normalized_titles, normalized_location, remote_pref)


def parse_resume_text(resume_text: str) -> Dict[str, object]:
    """Parse resume text using OpenAI when available, otherwise fallback."""

    if not resume_text.strip():
        return {
            "extracted_skills": [],
            "inferred_titles": [],
            "seniority": "unknown",
            "years_experience": 0,
            "summary": "Resume text could not be extracted from the file.",
            "first_name": None,
            "last_name": None,
            "email": None,
            "phone": None,
            "location": None,
            "social_links": [],
            "llm_model": OPENAI_MODEL,
            "llm_key_present": bool(OPENAI_API_KEY),
            "warnings": ["Resume text is empty after extraction."],
        }

    if not OPENAI_API_KEY:
        parsed = _mock_resume_parse(resume_text)
        warnings = []
        return {
            **parsed,
            "llm_model": OPENAI_MODEL,
            "llm_key_present": False,
            "warnings": warnings,
        }

    try:
        logger.info("LLM parse start: model=%s chars=%s", OPENAI_MODEL, len(resume_text))
        parsed = _call_openai(resume_text)
        validated = ResumeParseResult(**parsed)
        warnings = _safety_checks(validated, resume_text)
        logger.info(
            "LLM parse success: skills=%s titles=%s seniority=%s years=%s",
            len(validated.extracted_skills),
            len(validated.inferred_titles),
            validated.seniority,
            validated.years_experience,
        )
        return {
            **validated.model_dump(),
            "llm_model": OPENAI_MODEL,
            "llm_key_present": True,
            "warnings": warnings,
        }
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM parse failed, using fallback.")
        parsed = _mock_resume_parse(resume_text)
        warnings = []
        return {
            **parsed,
            "llm_model": OPENAI_MODEL,
            "llm_key_present": True,
            "warnings": warnings,
        }
