from __future__ import annotations

import json
import logging
import re
from typing import Dict, List
from openai import OpenAI
from pydantic import BaseModel, ValidationError


from app.config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    OPENAI_MODEL_CHEAP,
    OPENAI_RESUME_MAX_OUTPUT_TOKENS,
)

logger = logging.getLogger("llm")


def _log_usage(response: object, label: str) -> None:
    usage = getattr(response, "usage", None)
    if not usage:
        return
    if isinstance(usage, dict):
        input_tokens = usage.get("input_tokens")
        output_tokens = usage.get("output_tokens")
        total_tokens = usage.get("total_tokens")
    else:
        input_tokens = getattr(usage, "input_tokens", None)
        output_tokens = getattr(usage, "output_tokens", None)
        total_tokens = getattr(usage, "total_tokens", None)
    logger.info(
        "LLM %s usage: input_tokens=%s output_tokens=%s total_tokens=%s",
        label,
        input_tokens,
        output_tokens,
        total_tokens,
    )

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


class JobAnalysisItem(BaseModel):
    """LLM analysis result for a job."""

    job_id: str
    grade: str
    rationale: str
    missing_skills: List[str] = []


class JobAnalysisResult(BaseModel):
    """LLM analysis response wrapper."""

    results: List[JobAnalysisItem]
    best_match_job_id: str | None = None


class LearningResource(BaseModel):
    """Learning resource for a missing skill."""

    title: str
    type: str
    url: str | None = None
    notes: str | None = None


class LearningResourceGroup(BaseModel):
    """Resources grouped by skill."""

    skill: str
    category: str
    relevant: bool = True
    resources: List[LearningResource] = []


class DeepLearningResult(BaseModel):
    """Deep analysis response wrapper."""

    learning_resources: List[LearningResourceGroup]

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


def _fallback_job_analysis(
    profile: Dict[str, object], jobs: List[Dict[str, object]]
) -> Dict[str, object]:
    title_terms = [
        term.lower() for term in profile.get("title_terms", []) if isinstance(term, str)
    ]
    seniority = (profile.get("seniority") or "").lower()
    location_pref = (profile.get("location_pref") or "").lower()
    user_skills = [
        skill.lower() for skill in profile.get("skills", []) if isinstance(skill, str)
    ]

    scored = []
    for job in jobs:
        title = (job.get("title") or "").lower()
        location = (job.get("location") or "").lower()
        job_skills = [
            skill.lower()
            for skill in job.get("job_skills", [])
            if isinstance(skill, str)
        ]
        missing_skills = [
            skill for skill in job_skills if skill and skill not in user_skills
        ]
        score = 0
        if title_terms and any(term in title for term in title_terms):
            score += 2
        if seniority and seniority in title:
            score += 1
        if location_pref and location_pref in location:
            score += 1
        score -= min(len(missing_skills), 3)
        scored.append((job.get("job_id"), score))

    best_match_job_id = None
    if scored:
        best_match_job_id = max(scored, key=lambda item: item[1])[0]

    results = []
    for job in jobs:
        job_id = str(job.get("job_id"))
        score = next((val for key, val in scored if str(key) == job_id), 0)
        job_skills = [
            skill.lower()
            for skill in job.get("job_skills", [])
            if isinstance(skill, str)
        ]
        missing_skills = [
            skill for skill in job_skills if skill and skill not in user_skills
        ]
        grade = "D"
        if score >= 3:
            grade = "A"
        elif score == 2:
            grade = "B"
        elif score == 1:
            grade = "C"
        results.append(
            {
                "job_id": job_id,
                "grade": grade,
                "rationale": "Fallback match based on title and location overlap.",
                "missing_skills": missing_skills,
            }
        )

    return {"results": results, "best_match_job_id": best_match_job_id}


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
        "inferred_titles (array, top most relevant titles to the resume), seniority (string), years_experience (int),"
        "summary (string), first_name (string or null), last_name (string or null), "
        "email (string or null), phone (string or null), location (string or null), "
        "social_links (array). No extra keys."
    )

    response = client.responses.create(
        model=OPENAI_MODEL,
        max_output_tokens=10000,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": resume_text[:12000]},
        ],
    )

    _log_usage(response, "resume_parse")
    output_text = (response.output_text or "").strip()

    if not output_text:
        logger.error("LLM parse response was empty.")
        raise ValueError("Empty LLM response.")

    return json.loads(output_text)


def extract_job_skills(job_text: str) -> List[str]:
    """Extract a skill list from a job description using the LLM."""

    if not OPENAI_API_KEY or not job_text.strip():
        return []

    client = OpenAI(api_key=OPENAI_API_KEY)
    system_prompt = (
        "Extract a concise list of core technical skills and tools required for the job "
        "description. Core requirements are usually in the \"Responsibilities\", \"Required Skills\", \"Preferred Skills\", \"Nice to Have\", \"Your Expertise:\", etc. sections."
        "Return ONLY valid JSON with a single key 'skills' as an array."
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
        _log_usage(response, "job_skill_extract")
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
            OPENAI_MODEL_CHEAP,
            len(normalized_titles),
            normalized_location or "none",
            remote_value,
        )
        response = client.responses.create(
            model=OPENAI_MODEL_CHEAP,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt[:4000]},
            ],
        )
        _log_usage(response, "search_query")
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


def analyze_job_matches(
    profile: Dict[str, object],
    jobs: List[Dict[str, object]],
) -> Dict[str, object]:
    """Analyze selected jobs and grade fit for the user."""

    if not jobs:
        return {"results": [], "best_match_job_id": None}

    if not OPENAI_API_KEY:
        return _fallback_job_analysis(profile, jobs)

    system_prompt = (
        "You grade how well each job matches the candidate based on the provided "
        "resume summary and job data. Missing skills should lower the grade. "
        "Return ONLY valid JSON with keys: results (array of {job_id, grade, rationale, "
        "missing_skills}) and best_match_job_id. Grades must be one of: A, B, C, D. "
        "Keep rationale short."
    )

    user_prompt = json.dumps(
        {
            "candidate": profile,
            "jobs": jobs,
        }
    )

    try:
        logger.info("LLM analyze start: model=%s jobs=%s", OPENAI_MODEL, len(jobs))
        response = OpenAI(api_key=OPENAI_API_KEY).responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt[:12000]},
            ],
        )
        _log_usage(response, "job_match_analysis")
        parsed = json.loads(response.output_text)
        validated = JobAnalysisResult(**parsed)
        logger.info(
            "LLM analyze success: results=%s best=%s",
            len(validated.results),
            validated.best_match_job_id,
        )
        return validated.model_dump()
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM analyze failed, using fallback.")
        return _fallback_job_analysis(profile, jobs)


def generate_learning_resources(
    profile: Dict[str, object],
    job: Dict[str, object],
    missing_skills: List[str],
) -> List[Dict[str, object]]:
    """Return learning resources for missing skills."""

    if not missing_skills:
        return []

    if not OPENAI_API_KEY:
        return [
            {
                "skill": skill,
                "category": "characteristic",
                "relevant": False,
                "resources": [],
            }
            for skill in missing_skills
        ]

    system_prompt = (
        "You are a career coach. Provide concise, high-confidence learning resources "
        "for the candidate's missing skills based on the job description. "
        "Use the web_search tool to find the most relevant resources. "
        "Return ONLY valid JSON with key: learning_resources (array of {skill, category, "
        "relevant, resources}). Categories MUST be one of: tool, framework, software, "
        "characteristic, system. Mark relevant=false for vague or non-actionable items "
        "(examples: workflow orchestration systems, scalability and reliability engineering). "
        "Exclude any group where relevant=false. Each resources item is {title, type, url?, notes?}. "
        "Limit to 3-4 resources per skill. For framework skills (e.g., Ruby on Rails), "
        "include an official documentation link and a beginner-friendly tutorial/video. "
        "If unsure about a URL, omit it and provide a short notes and message to the user. "
        "If the web_search tool is not available, use the fallback resources."
    )

    user_prompt = json.dumps(
        {
            "candidate": {
                "summary": profile.get("summary", ""),
                "skills": profile.get("skills", []),
            },
            "job": {
                "title": job.get("title"),
                "company": job.get("company"),
                "description": (job.get("description") or "")[:4000],
            },
            "missing_skills": missing_skills[:20],
        }
    )

    try:
        logger.info(
            "LLM deep analysis start: model=%s skills=%s",
            OPENAI_MODEL,
            len(missing_skills),
        )
        response = OpenAI(api_key=OPENAI_API_KEY).responses.create(
            model=OPENAI_MODEL,
            tools=[{"type": "web_search"}],
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        _log_usage(response, "deep_analysis_resources")
        parsed = json.loads(response.output_text)
        validated = DeepLearningResult(**parsed)
        resources = validated.model_dump().get("learning_resources", [])
        trimmed = []
        for group in resources:
            if not group.get("relevant", True):
                continue
            group["resources"] = (group.get("resources") or [])[:4]
            trimmed.append(group)
        return trimmed
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM deep analysis failed, using fallback.")
        return [
            {
                "skill": skill,
                "category": "characteristic",
                "relevant": False,
                "resources": [],
            }
            for skill in missing_skills
        ]


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
