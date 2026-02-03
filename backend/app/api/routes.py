from __future__ import annotations

import json
from typing import Dict
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.schemas import (
    ApplyPrepareRequest,
    ApplyPrepareResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    CoverLetterDocumentResponse,
    CoverLetterDraftRequest,
    CoverLetterDraftResponse,
    CoverLetterSuggestRequest,
    CoverLetterSuggestResponse,
    CoverLetterVersionCreateRequest,
    CoverLetterDocumentVersion,
    DeepAnalyzeRequest,
    DeepAnalyzeResponse,
    ResumeReviewRequest,
    ResumeReviewResponse,
    ResumeTextResponse,
    CheckoutRequest,
    CheckoutResponse,
    GreenhouseApplyRequest,
    JobSelectionRequest,
    JobSelectionResponse,
    MatchesRequest,
    MatchesResponse,
    TitleFiltersResponse,
    SelectedJobDetail,
    SelectedJobsResponse,
    SessionProfile,
    SubscriptionStatusResponse,
    RefreshEnqueueResponse,
    RefreshStatusResponse,
)
from app.services.apply_service import prepare_cover_letter
from app.services.analysis_service import (
    analyze_selected_jobs,
    deep_analyze_job,
    get_deep_analysis,
)
from app.services.greenhouse_service import retrieve_job_post, submit_application
from app.services.matching_service import build_matches
from app.services.jobs_service import list_jobs_by_ids
from app.services.refresh_queue import enqueue_refresh, get_job
from app.config import STRIPE_WEBHOOK_BYPASS
from app.services.payment_service import (
    create_checkout_session,
    get_subscription_status,
    set_subscription_active,
    verify_stripe_signature,
)
from app.db import get_db
from app.services.llm_service import parse_resume_text
from app.services.llm_service import suggest_cover_letter_edits
from app.models.db_models import JobListing
from app.services.llm_service import review_resume_for_job
from app.services.resume_parser import parse_resume_file
from app.services.session_service import (
    create_session,
    get_session,
    list_job_selections,
    save_job_selections,
)
from app.services.storage_service import save_resume_file
from app.services.cover_letter_service import (
    apply_ops,
    compute_diff,
    get_document_with_versions,
    get_or_create_document,
    hash_content,
    save_draft,
    save_version,
)
from app.rate_limiter import limiter
from pprint import pprint

router = APIRouter()


@router.post("/api/resume/upload", response_model=SessionProfile)
def upload_resume(
    file: UploadFile = File(...),
    location_pref: str | None = Form(None),
    remote_pref: bool | None = Form(None),
    db: Session = Depends(get_db),
) -> SessionProfile:
    """Create a temporary session profile from an uploaded resume file."""

    file_bytes = file.file.read()
    resume_text = parse_resume_file(file.filename, file_bytes)
    resume_s3_key = save_resume_file(file.filename, file_bytes)

    parsed = parse_resume_text(resume_text)
    record = create_session(
        db=db,
        resume_text=resume_text,
        resume_s3_key=resume_s3_key,
        extracted_skills=parsed.get("extracted_skills", []),
        inferred_titles=parsed.get("inferred_titles", []),
        seniority=parsed.get("seniority", "mid"),
        years_experience=int(parsed.get("years_experience", 0)),
        location_pref=location_pref,
        remote_pref=remote_pref,
        llm_summary=parsed.get("summary"),
        first_name=parsed.get("first_name"),
        last_name=parsed.get("last_name"),
        email=parsed.get("email"),
        phone=parsed.get("phone"),
        location=parsed.get("location"),
        social_links=parsed.get("social_links", []),
    )
    return SessionProfile(
        session_id=UUID(record.id),
        resume_s3_key=record.resume_s3_key,
        extracted_skills=record.extracted_skills,
        inferred_titles=record.inferred_titles,
        seniority=record.seniority,
        years_experience=record.years_experience,
        location_pref=record.location_pref,
        remote_pref=record.remote_pref,
        llm_summary=record.llm_summary,
        first_name=record.first_name,
        last_name=record.last_name,
        email=record.email,
        phone=record.phone,
        location=record.location,
        social_links=record.social_links or [],
        llm_model=parsed.get("llm_model"),
        llm_key_present=parsed.get("llm_key_present"),
        llm_warnings=parsed.get("warnings"),
        created_at=record.created_at,
        expires_at=record.expires_at,
    )


@router.get("/api/session/profile", response_model=SessionProfile)
def session_profile(session_id: UUID, db: Session = Depends(get_db)) -> SessionProfile:
    """Return the session profile for apply flow."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    return SessionProfile(
        session_id=UUID(session.id),
        resume_s3_key=session.resume_s3_key,
        extracted_skills=session.extracted_skills,
        inferred_titles=session.inferred_titles,
        seniority=session.seniority,
        years_experience=session.years_experience,
        location_pref=session.location_pref,
        remote_pref=session.remote_pref,
        llm_summary=session.llm_summary,
        first_name=session.first_name,
        last_name=session.last_name,
        email=session.email,
        phone=session.phone,
        location=session.location,
        social_links=session.social_links or [],
        created_at=session.created_at,
        expires_at=session.expires_at,
    )


@router.get("/api/session/resume", response_model=ResumeTextResponse)
def session_resume(session_id: UUID, db: Session = Depends(get_db)) -> ResumeTextResponse:
    """Return resume text for the current session."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    return ResumeTextResponse(session_id=UUID(session.id), resume_text=session.resume_text)


@router.get("/api/editor/document", response_model=CoverLetterDocumentResponse)
def cover_letter_document(
    session_id: UUID, job_id: str, db: Session = Depends(get_db)
) -> CoverLetterDocumentResponse:
    """Return cover letter document, draft, and versions."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    data = get_document_with_versions(db, str(session_id), job_id)
    draft_hash = hash_content(data.document.draft_content or "")
    return CoverLetterDocumentResponse(
        document_id=data.document.id,
        session_id=session_id,
        job_id=job_id,
        draft_content=data.document.draft_content or "",
        draft_hash=draft_hash,
        current_version_id=data.document.current_version_id,
        versions=[
            CoverLetterDocumentVersion(
                id=version.id,
                document_id=version.document_id,
                job_id=version.job_id,
                content=version.content,
                created_at=version.created_at,
                created_by=version.created_by,
                intent=version.intent,
                base_hash=version.base_hash,
                result_hash=version.result_hash,
            )
            for version in data.versions
        ],
    )


@router.post("/api/editor/draft", response_model=CoverLetterDraftResponse)
def cover_letter_draft(
    payload: CoverLetterDraftRequest, db: Session = Depends(get_db)
) -> CoverLetterDraftResponse:
    """Save cover letter draft content."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    document = get_or_create_document(db, str(payload.session_id), payload.job_id)
    current_hash = hash_content(document.draft_content or "")
    if payload.base_hash and payload.base_hash != current_hash:
        raise HTTPException(status_code=409, detail="Draft is out of date.")

    saved = save_draft(db, document, payload.content)
    return CoverLetterDraftResponse(
        document_id=saved.id,
        session_id=payload.session_id,
        job_id=payload.job_id,
        draft_content=saved.draft_content,
        draft_hash=hash_content(saved.draft_content or ""),
        updated_at=saved.updated_at,
    )


@router.post("/api/editor/version", response_model=CoverLetterDocumentVersion)
def cover_letter_version(
    payload: CoverLetterVersionCreateRequest, db: Session = Depends(get_db)
) -> CoverLetterDocumentVersion:
    """Create a new cover letter version."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    document = get_or_create_document(db, str(payload.session_id), payload.job_id)
    current_hash = hash_content(document.draft_content or "")
    if payload.base_hash and payload.base_hash != current_hash:
        raise HTTPException(status_code=409, detail="Draft is out of date.")

    version = save_version(
        db,
        document,
        payload.content,
        intent=payload.intent,
        created_by="user",
        base_hash=payload.base_hash,
    )
    return CoverLetterDocumentVersion(
        id=version.id,
        document_id=version.document_id,
        job_id=version.job_id,
        content=version.content,
        created_at=version.created_at,
        created_by=version.created_by,
        intent=version.intent,
        base_hash=version.base_hash,
        result_hash=version.result_hash,
    )


@router.post("/api/editor/suggest", response_model=CoverLetterSuggestResponse)
@limiter.limit("12/minute")
def cover_letter_suggest(
    payload: CoverLetterSuggestRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> CoverLetterSuggestResponse:
    """Generate AI patch ops for cover letter content."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    _ = get_or_create_document(db, str(payload.session_id), payload.job_id)
    base_hash = hash_content(payload.content or "")
    if payload.base_hash and payload.base_hash != base_hash:
        raise HTTPException(status_code=409, detail="Draft hash mismatch.")

    job_context = ""
    try:
        job_payload = retrieve_job_post(db, payload.job_id)
        job_context = str(job_payload.get("content") or "")
    except Exception:
        try:
            job_int = int(payload.job_id)
        except ValueError:
            job_int = None
        if job_int is not None:
            job = db.query(JobListing).filter(JobListing.id == job_int).first()
            if job:
                job_context = job.description or ""

    resume_facts = payload.resume_facts or []
    if not resume_facts:
        if session.llm_summary:
            resume_facts.append(f"Summary: {session.llm_summary}")
        if session.extracted_skills:
            resume_facts.append("Skills: " + ", ".join(session.extracted_skills[:25]))
        if session.inferred_titles:
            resume_facts.append("Titles: " + ", ".join(session.inferred_titles[:5]))
        if session.years_experience:
            resume_facts.append(f"Years of experience: {session.years_experience}")

    result = suggest_cover_letter_edits(
        content=payload.content or "",
        resume_facts=resume_facts,
        job_context=job_context,
        intent=payload.intent,
        constraints=payload.constraints,
        selection=payload.selection,
    )
    ops = result.get("ops", [])
    explanation = result.get("explanation", "")
    warnings = list(result.get("warnings", []) or [])

    try:
        preview = apply_ops(payload.content or "", ops)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    diff = compute_diff(payload.content or "", preview)
    word_count = len(preview.split())
    if word_count > 400:
        warnings.append("Cover letter exceeds 400 words; consider shortening.")

    return CoverLetterSuggestResponse(
        base_hash=base_hash,
        ops=ops,
        preview=preview,
        diff=diff,
        explanation=explanation,
        warnings=warnings,
    )


@router.get("/api/matches", response_model=MatchesResponse)
def get_matches(
    session_id: UUID,
    page: int = 1,
    db: Session = Depends(get_db),
) -> MatchesResponse:
    """Return ranked job matches for the given session."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    page = max(page, 1)
    page_size = 25
    matches, total, title_terms = build_matches(
        db, session, page=page, page_size=page_size, filters=None
    )
    return MatchesResponse(
        session_id=session_id,
        matches=matches,
        title_terms=title_terms,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("/api/matches", response_model=MatchesResponse)
def post_matches(payload: MatchesRequest, db: Session = Depends(get_db)) -> MatchesResponse:
    """Return ranked job matches with optional filters."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    page = max(payload.page, 1)
    page_size = 25
    matches, total, title_terms = build_matches(
        db,
        session,
        page=page,
        page_size=page_size,
        filters=payload.filters.model_dump() if payload.filters else None,
    )
    return MatchesResponse(
        session_id=payload.session_id,
        matches=matches,
        title_terms=title_terms,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/api/filters/titles", response_model=TitleFiltersResponse)
def list_title_filters(limit: int = 100, db: Session = Depends(get_db)) -> TitleFiltersResponse:
    """Return top job titles with counts for filter dropdowns."""

    safe_limit = max(1, min(limit, 500))
    rows = (
        db.query(JobListing.title, func.count(JobListing.id))
        .filter(JobListing.is_active.is_(True))
        .group_by(JobListing.title)
        .order_by(func.count(JobListing.id).desc(), JobListing.title.asc())
        .limit(safe_limit)
        .all()
    )
    return TitleFiltersResponse(
        titles=[{"title": title, "count": count} for title, count in rows]
    )


@router.post("/api/jobs/select", response_model=JobSelectionResponse)
def select_jobs(
    payload: JobSelectionRequest, db: Session = Depends(get_db)
) -> JobSelectionResponse:
    """Store job selections for the session."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    accepted = list(payload.job_ids)
    rejected: list[str] = []

    if accepted:
        save_job_selections(db, payload.session_id, accepted)

    return JobSelectionResponse(
        accepted_job_ids=accepted,
        rejected_job_ids=rejected,
    )


@router.post("/api/apply/prepare", response_model=ApplyPrepareResponse)
def prepare_application(
    payload: ApplyPrepareRequest, db: Session = Depends(get_db)
) -> ApplyPrepareResponse:
    """Generate cover letter content and return apply URL."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    tone = payload.cover_letter_tone or "concise"
    cover_letter = prepare_cover_letter(db, payload.job_id, tone)
    return ApplyPrepareResponse(
        cover_letter_text=cover_letter.get("cover_letter_text"),
        apply_url=cover_letter.get("apply_url", ""),
    )


@router.post("/api/checkout/create", response_model=CheckoutResponse)
def create_checkout(payload: CheckoutRequest) -> CheckoutResponse:
    """Create a Stripe Checkout session and return the hosted URL."""

    try:
        checkout_url = create_checkout_session(payload.session_id, payload.plan)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CheckoutResponse(checkout_url=checkout_url)


@router.post("/api/analyze", response_model=AnalyzeResponse)
@limiter.limit("10/minute")
def analyze_selections(
    payload: AnalyzeRequest, request: Request, db: Session = Depends(get_db)
) -> AnalyzeResponse:
    """Analyze selected jobs with the LLM and return grades."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    analysis = analyze_selected_jobs(db, session, payload.job_ids)
    return AnalyzeResponse(
        session_id=payload.session_id,
        results=analysis.get("results", []),
        best_match_job_id=analysis.get("best_match_job_id"),
    )


@router.post("/api/analyze/deep", response_model=DeepAnalyzeResponse)
@limiter.limit("3/minute")
def analyze_deep(
    payload: DeepAnalyzeRequest, request: Request, db: Session = Depends(get_db)
) -> DeepAnalyzeResponse:
    """Deep analysis with learning resources for a single job."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    cached = get_deep_analysis(db, str(payload.session_id), payload.job_id)
    if cached:
        return DeepAnalyzeResponse(**cached)

    try:
        result = deep_analyze_job(db, session, payload.job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return DeepAnalyzeResponse(
        session_id=payload.session_id,
        job_id=result.get("job_id", payload.job_id),
        grade=result.get("grade", "D"),
        rationale=result.get("rationale", ""),
        missing_skills=result.get("missing_skills", []),
        learning_resources=result.get("learning_resources", []),
    )


@router.get("/api/analyze/deep", response_model=DeepAnalyzeResponse)
def get_deep_analyze(
    session_id: UUID, job_id: str, db: Session = Depends(get_db)
) -> DeepAnalyzeResponse:
    """Return cached deep analysis for a session + job."""

    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    cached = get_deep_analysis(db, str(session_id), job_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Deep analysis not found.")

    return DeepAnalyzeResponse(**cached)


@router.post("/api/resume/review", response_model=ResumeReviewResponse)
@limiter.limit("5/minute")
def resume_review(
    payload: ResumeReviewRequest, request: Request, db: Session = Depends(get_db)
) -> ResumeReviewResponse:
    """Review a resume against a job posting."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    try:
        job_int = int(payload.job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid job id.") from exc

    job = db.query(JobListing).filter(JobListing.id == job_int).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    review = review_resume_for_job(
        session.resume_text,
        {
            "title": job.title,
            "company": job.company_name,
            "description": job.description or "",
        },
    )

    return ResumeReviewResponse(
        session_id=payload.session_id,
        job_id=str(payload.job_id),
        summary=review.get("summary", ""),
        strengths=review.get("strengths", []),
        gaps=review.get("gaps", []),
        missing_required_skills=review.get("missing_required_skills", []),
        changes=review.get("changes", []),
        rewording=review.get("rewording", []),
        vocabulary=review.get("vocabulary", []),
    )


@router.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request) -> Dict[str, str]:
    """Handle Stripe webhook payload and update subscription status."""

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    if STRIPE_WEBHOOK_BYPASS:
        # Dev-only fallback for simple payloads from the simulate button.
        data = json.loads(payload.decode("utf-8"))
        session_id_raw = data.get("session_id")
        plan = data.get("plan", "monthly")
        if session_id_raw:
            set_subscription_active(UUID(session_id_raw), plan)
        return {"status": "ok"}

    try:
        event = verify_stripe_signature(payload, signature)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        session_id_raw = session_obj["metadata"].get("session_id")
        plan = session_obj["metadata"].get("plan", "monthly")
        if session_id_raw:
            set_subscription_active(UUID(session_id_raw), plan)

    return {"status": "ok"}


@router.get("/api/subscription/status", response_model=SubscriptionStatusResponse)
def subscription_status(session_id: UUID) -> SubscriptionStatusResponse:
    """Return the current plan and subscription status for a session."""

    status = get_subscription_status(session_id)
    return SubscriptionStatusResponse(plan=status.plan, status=status.status)


@router.get("/api/jobs/selected")
def selected_jobs(session_id: UUID, db: Session = Depends(get_db)) -> Dict[str, list]:
    """Return the job IDs selected for this session."""

    selected = list_job_selections(db, session_id)
    return {"job_ids": selected}


@router.get("/api/jobs/selected/details", response_model=SelectedJobsResponse)
def selected_job_details(
    session_id: UUID, db: Session = Depends(get_db)
) -> SelectedJobsResponse:
    """Return job details for the selected job IDs."""

    selected = list_job_selections(db, session_id)
    jobs = list_jobs_by_ids(db, selected)
    mapped = [
        SelectedJobDetail(
            job_id=str(job.id),
            company=job.company_name,
            title=job.title,
            location=job.location,
            apply_url=job.apply_url,
            is_active=job.is_active,
        )
        for job in jobs
    ]
    return SelectedJobsResponse(jobs=mapped)


@router.get("/api/greenhouse/job")
def greenhouse_job(job_id: str, db: Session = Depends(get_db)) -> Dict[str, object]:
    """Fetch Greenhouse job questions for a selected job."""

    try:
        return retrieve_job_post(db, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/api/greenhouse/apply")
def greenhouse_apply(
    payload: GreenhouseApplyRequest, request: Request, db: Session = Depends(get_db)
) -> Dict[str, object]:
    """Submit a Greenhouse application for a selected job."""

    session = get_session(db, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    client_ip = request.client.host if request.client else None
    try:
        response = submit_application(
            db,
            session,
            payload.job_id,
            payload.fields,
            data_compliance=payload.data_compliance,
            demographic_answers=payload.demographic_answers,
            mapped_url_token=payload.mapped_url_token,
            applicant_ip=client_ip,
        )
        return {"status": "ok", "response": response}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/api/ingest/refresh", response_model=RefreshEnqueueResponse)
def ingest_refresh(db: Session = Depends(get_db)) -> RefreshEnqueueResponse:
    """Enqueue a manual ATS ingestion refresh (dev only)."""

    job = enqueue_refresh(db, requested_by="api")
    return RefreshEnqueueResponse(job_id=job.id, status=job.status)


@router.get("/api/ingest/refresh/{job_id}", response_model=RefreshStatusResponse)
def ingest_refresh_status(job_id: int, db: Session = Depends(get_db)) -> RefreshStatusResponse:
    """Check status for a queued refresh job."""

    job = get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Refresh job not found.")
    return RefreshStatusResponse(
        job_id=job.id,
        status=job.status,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        totals=job.totals if isinstance(job.totals, dict) else None,
        error=job.error,
    )
