from __future__ import annotations

import json
import logging
import re
from typing import Dict, List, Optional
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


def _get_total_tokens(response: object) -> int:
    """Extract total_tokens from OpenAI response for credit settlement."""
    usage = getattr(response, "usage", None)
    if not usage:
        return 0
    if isinstance(usage, dict):
        total = usage.get("total_tokens")
    else:
        total = getattr(usage, "total_tokens", None)
    return int(total) if total is not None else 0

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
    summary: str | None = None
    resources: List[LearningResource] = []


class JobSummary(BaseModel):
    """Structured job summary from deep analysis prompt."""

    title: str
    seniority: str | None = None
    domain: str | None = None
    core_responsibilities: List[str] = []
    must_have_skills: List[str] = []
    nice_to_have_skills: List[str] = []
    tools_and_stack: List[str] = []
    signals: List[str] = []


class DeepLearningResult(BaseModel):
    """Deep analysis response wrapper (job_summary + learning_resources)."""

    job_summary: JobSummary
    learning_resources: List[LearningResourceGroup]


class ResumeReviewResult(BaseModel):
    """Resume review response wrapper."""

    summary: str
    strengths: List[str] = []
    gaps: List[str] = []
    missing_required_skills: List[str] = []
    changes: List[str] = []
    rewording: List[str] = []
    vocabulary: List[str] = []


class CoverLetterPatchResult(BaseModel):
    """Patch ops for cover letter edits."""

    ops: List[dict]
    explanation: str
    warnings: List[str] = []

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


def extract_job_skills(job_text: str) -> tuple[List[str], int]:
    """Extract a skill list from a job description using the LLM. Returns (skills, total_tokens)."""

    if not OPENAI_API_KEY or not job_text.strip():
        return [], 0

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
        skills = [skill.lower() for skill in validated.skills if isinstance(skill, str)]
        return skills, _get_total_tokens(response)
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM skill extract failed.")
        return [], 0

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
        "resume summary and job data. Prioritize strong and excellent alignment on "
        "core/required skills and must-have qualifications. Missing skills should only "
        "lower the grade if they are clearly required for the role. Do NOT penalize "
        "nice-to-have, preferred, or optional skills. If missing skills are listed "
        "without clear requirement, treat them as informational only. "
        "Return ONLY valid JSON with keys: results (array of {job_id, grade, rationale, "
        "missing_skills}) and best_match_job_id. Grades must be one of: A, B, C, D. "
        "Keep rationale short and emphasize core skill alignment."
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
        return validated.model_dump(), _get_total_tokens(response)
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM analyze failed, using fallback.")
        return _fallback_job_analysis(profile, jobs), 0


def generate_learning_resources(
    profile: Dict[str, object],
    job: Dict[str, object],
    missing_skills: List[str],
) -> tuple[Dict[str, object] | None, List[Dict[str, object]], int]:
    """Return (job_summary, learning_resources, tokens) for missing skills."""

    fallback_resources = [
        {"skill": skill, "category": "characteristic", "relevant": False, "resources": []}
        for skill in missing_skills
    ]

    if not missing_skills:
        return None, [], 0

    if not OPENAI_API_KEY:
        return None, fallback_resources, 0

    system_prompt = (
        "You are a career coach and job analyst. Analyze the job description and produce "
        "a structured summary and targeted learning resources. "
        "Use the web_search tool ONLY to find precise learning resources when needed. "
        "Return ONLY valid JSON with the following top-level keys:\n"
        "1) job_summary\n"
        "2) learning_resources\n\n"

        "JOB_SUMMARY OBJECT (REQUIRED):\n"
        "{\n"
        "  title: string,\n"
        "  seniority: string | null,\n"
        "  domain: string | null,\n"
        "  core_responsibilities: string[],\n"
        "  must_have_skills: string[],\n"
        "  nice_to_have_skills: string[],\n"
        "  tools_and_stack: string[],\n"
        "  signals: string[]\n"
        "}\n"
        "- Extract ONLY information explicitly stated or strongly implied by the job description.\n"
        "- Keep each list concise (3–7 items where possible).\n"
        "- 'signals' may include items such as: remote, hybrid, on-call, security, scale, "
        "regulated environment, customer-facing, infra-heavy, data-intensive, etc.\n\n"

        "LEARNING_RESOURCES ARRAY:\n"
        "Array of objects: {skill, category, relevant, summary, resources}.\n"
        "Categories MUST be one of: tool, framework, software, system.\n"
        "Mark relevant=false for vague, non-actionable, or overly broad skills "
        "(examples: workflow orchestration systems, scalability and reliability engineering).\n"
        "EXCLUDE any group where relevant=false from the final output.\n\n"

        "For each skill:\n"
        "- Include a short 'summary' (1–2 sentences) explaining what the skill is AND why "
        "the selected resources are the best match for THIS specific job.\n"
        "- LIMIT to a MAXIMUM of 3 resources per skill. Fewer is preferred if sufficient.\n"
        "- Prioritize resources that match the job’s stated stack, tools, seniority level, "
        "and real-world usage.\n"
        "- For framework skills (e.g., Ruby on Rails), include at most ONE official documentation "
        "link and ONE role-relevant tutorial or video if needed.\n"
        "- Each resource item is {title, type, url?, notes?}.\n"
        "- If unsure about a URL, omit it and include a short explanatory note instead.\n\n"

        "The final JSON must exactly match the specified structure. "
        "Do NOT include commentary, explanations, or markdown."
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
        job_summary_dict = validated.job_summary.model_dump()
        resources = validated.model_dump().get("learning_resources", [])
        trimmed = []
        for group in resources:
            if not group.get("relevant", True):
                continue
            group["resources"] = (group.get("resources") or [])[:4]
            trimmed.append(group)
        return job_summary_dict, trimmed, _get_total_tokens(response)
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM deep analysis failed, using fallback.")
        return None, fallback_resources, 0


def review_resume_for_job(resume_text: str, job: Dict[str, object]) -> Dict[str, object]:
    """Review a resume against a job posting and return actionable feedback."""

    if not resume_text.strip():
        return {
            "summary": "Resume text is empty or could not be extracted.",
            "strengths": [],
            "gaps": ["Resume text missing; unable to evaluate fit."],
            "missing_required_skills": [],
            "changes": [],
            "rewording": [],
            "vocabulary": [],
        }

    if not OPENAI_API_KEY:
        return {
            "summary": "LLM key missing; resume review unavailable.",
            "strengths": [],
            "gaps": [],
            "missing_required_skills": [],
            "changes": [],
            "rewording": [],
            "vocabulary": [],
        }

    system_prompt = (
        "You are an expert resume reviewer and ATS optimization specialist. "
        "Use ONLY the provided resume text and job details. Do NOT invent experience. "
        "Identify core/required skills from the job description vs nice-to-haves. "
        "Missing required skills should be called out explicitly. "
        "Provide concise, actionable feedback for improving the resume to match this role."
        "Return ONLY valid JSON with keys: summary (string), strengths (array), gaps (array), "
        "missing_required_skills (array), changes (array of bullet points), "
        "rewording (array of suggested reworded bullets), vocabulary (array of key terms)."
    )

    user_prompt = json.dumps(
        {
            "job": {
                "title": job.get("title"),
                "company": job.get("company"),
                "description": (job.get("description") or "")[:6000],
            },
            "resume_text": resume_text[:8000],
        }
    )

    try:
        logger.info("LLM resume review start: model=%s", OPENAI_MODEL)
        response = OpenAI(api_key=OPENAI_API_KEY).responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        _log_usage(response, "resume_review")
        parsed = json.loads(response.output_text)
        validated = ResumeReviewResult(**parsed)
        return validated.model_dump(), _get_total_tokens(response)
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM resume review failed.")
        return {
            "summary": "Resume review failed. Please try again.",
            "strengths": [],
            "gaps": [],
            "missing_required_skills": [],
            "changes": [],
            "rewording": [],
            "vocabulary": [],
        }, 0


def suggest_cover_letter_edits(
    content: str,
    resume_facts: List[str],
    job_context: str,
    intent: str,
    constraints: Optional[Dict[str, object]] = None,
    selection: Optional[Dict[str, int]] = None,
) -> Dict[str, object]:
    """Generate patch ops for cover letter edits."""

    if not OPENAI_API_KEY:
        return {
            "ops": [],
            "explanation": "LLM is not configured. No edits were generated.",
            "warnings": ["OpenAI key missing."],
        }

    system_prompt = (
        "You are a cover letter editor. You must ONLY use facts from the resume facts "
        "and the provided job description. Do NOT invent metrics, company names, or experience. "
        "Return ONLY valid JSON with keys: ops (array), explanation (string), warnings (array). "
        "Ops MUST use this exact schema:\n"
        "- replace: {\"type\":\"replace\",\"start\":int,\"end\":int,\"text\":string}\n"
        "- insert: {\"type\":\"insert\",\"pos\":int,\"text\":string}\n"
        "- delete: {\"type\":\"delete\",\"start\":int,\"end\":int}\n"
        "Do NOT use alternative keys like at, offset, content. Character offsets must apply "
        "to the provided content. If content is empty and intent is generate, insert a full draft "
        "grounded in resume facts + job context. Keep output within 250-400 words unless constrained."
    )
    user_prompt = json.dumps(
        {
            "intent": intent,
            "constraints": constraints or {},
            "selection": selection or {},
            "content": content,
            "resume_facts": resume_facts,
            "job_context": job_context[:6000],
        }
    )

    try:
        logger.info("LLM cover letter suggest start: model=%s intent=%s", OPENAI_MODEL, intent)
        response = OpenAI(api_key=OPENAI_API_KEY).responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        _log_usage(response, "cover_letter_suggest")
        parsed = json.loads(response.output_text)
        validated = CoverLetterPatchResult(**parsed)
        return validated.model_dump(), _get_total_tokens(response)
    except (json.JSONDecodeError, ValidationError, Exception):
        logger.exception("LLM cover letter suggest failed.")
        return {
            "ops": [],
            "explanation": "Unable to generate edits at this time.",
            "warnings": ["LLM request failed."],
        }, 0


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
